import { Router } from 'express';
import { db } from '../db/index.js';
import { runResearch } from '../research/pipeline.js';
import { normalizeCompanyName } from '../research/normalize.js';

export const researchRouter = Router();

const MAX_RESULTS_CAP = 50;
const DEFAULT_MAX_RESULTS = 20;

interface ResearchRunRow {
  id: number;
  branche: string;
  region: string;
  exclusions: string | null;
  max_results: number;
  status: string;
  started_at: string;
  finished_at: string | null;
  error: string | null;
}

interface CandidateRow {
  id: number;
  research_run_id: number;
  name: string;
  domain: string | null;
  url: string | null;
  quelle_url: string;
  quelle_typ: string;
  hat_online_shop: number;
  selected: number;
  committed: number;
}

function runDetail(runId: number) {
  const run = db.prepare('SELECT * FROM research_runs WHERE id = ?').get(runId) as ResearchRunRow | undefined;
  const candidates = db
    .prepare('SELECT * FROM research_candidates WHERE research_run_id = ? ORDER BY id')
    .all(runId) as CandidateRow[];
  const log = db.prepare('SELECT * FROM research_log WHERE research_run_id = ? ORDER BY id').all(runId);
  return { run, candidates, log };
}

// Startet einen neuen Recherche-Lauf (Zusatzmodul "Automatisierte Firmenrecherche").
// Bewusst synchron: bei max. 50 Treffern und wenigen Quellen mit eingebautem
// Rate-Limit bleibt das innerhalb einer normalen Request-Laufzeit.
researchRouter.post('/runs', async (req, res) => {
  const { branche, region, exclusions, maxResults } = req.body ?? {};
  if (!branche || typeof branche !== 'string' || !region || typeof region !== 'string') {
    return res.status(400).json({ error: 'branche und region sind Pflichtfelder.' });
  }
  const cappedMaxResults = Math.min(MAX_RESULTS_CAP, Math.max(1, Number(maxResults) || DEFAULT_MAX_RESULTS));

  const info = db
    .prepare(
      `INSERT INTO research_runs (branche, region, exclusions, max_results, status)
       VALUES (?, ?, ?, ?, 'running')`,
    )
    .run(branche.trim(), region.trim(), exclusions ? String(exclusions).trim() : null, cappedMaxResults);
  const runId = info.lastInsertRowid as number;

  try {
    await runResearch(runId);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler beim Recherche-Lauf.';
    db.prepare(`UPDATE research_runs SET status = 'failed', error = ? WHERE id = ?`).run(message, runId);
  }

  res.status(201).json(runDetail(runId));
});

researchRouter.get('/runs', (_req, res) => {
  const runs = db.prepare('SELECT * FROM research_runs ORDER BY started_at DESC').all();
  res.json(runs);
});

researchRouter.get('/runs/:id', (req, res) => {
  const detail = runDetail(Number(req.params.id));
  if (!detail.run) return res.status(404).json({ error: 'Recherche-Lauf nicht gefunden.' });
  res.json(detail);
});

// Uebernimmt ausgewaehlte Kandidaten aus der Vorschau in die companies-Tabelle.
// Kein Kandidat ohne quelle_url/quelle_typ kann hier ankommen (DB-Constraint) -
// die Belegpflicht ist damit auch am Uebernahme-Punkt technisch erzwungen.
researchRouter.post('/runs/:id/commit', (req, res) => {
  const runId = Number(req.params.id);
  const run = db.prepare('SELECT * FROM research_runs WHERE id = ?').get(runId) as ResearchRunRow | undefined;
  if (!run) return res.status(404).json({ error: 'Recherche-Lauf nicht gefunden.' });

  const { candidateIds } = req.body ?? {};
  if (!Array.isArray(candidateIds) || candidateIds.length === 0) {
    return res.status(400).json({ error: 'candidateIds muss ein nicht-leeres Array sein.' });
  }

  const created: unknown[] = [];
  const skipped: { candidateId: number; reason: string }[] = [];

  const insertCompany = db.prepare(`
    INSERT INTO companies (name, name_normalized, domain, url, branche, region, quelle_url, quelle_typ, gefunden_am, verifiziert, hat_online_shop, status)
    VALUES (@name, @name_normalized, @domain, @url, @branche, @region, @quelle_url, @quelle_typ, @gefunden_am, 0, @hat_online_shop, 'neu')
  `);
  const markCommitted = db.prepare('UPDATE research_candidates SET committed = 1, selected = 1 WHERE id = ?');
  const existsCheck = db.prepare('SELECT id FROM companies WHERE name_normalized = ? AND domain IS ?');

  const tx = db.transaction(() => {
    for (const rawId of candidateIds) {
      const candidateId = Number(rawId);
      const candidate = db
        .prepare('SELECT * FROM research_candidates WHERE id = ? AND research_run_id = ?')
        .get(candidateId, runId) as CandidateRow | undefined;
      if (!candidate) {
        skipped.push({ candidateId, reason: 'Kandidat nicht gefunden.' });
        continue;
      }
      if (candidate.committed) {
        skipped.push({ candidateId, reason: 'Bereits uebernommen.' });
        continue;
      }
      const nameNormalized = normalizeCompanyName(candidate.name);
      if (existsCheck.get(nameNormalized, candidate.domain)) {
        skipped.push({ candidateId, reason: 'Firma existiert bereits in der Datenbank (Duplikat).' });
        continue;
      }

      const info = insertCompany.run({
        name: candidate.name,
        name_normalized: nameNormalized,
        domain: candidate.domain,
        url: candidate.url,
        branche: run.branche,
        region: run.region,
        quelle_url: candidate.quelle_url,
        quelle_typ: candidate.quelle_typ,
        gefunden_am: run.started_at,
        hat_online_shop: candidate.hat_online_shop,
      });
      markCommitted.run(candidateId);
      created.push(db.prepare('SELECT * FROM companies WHERE id = ?').get(info.lastInsertRowid));
    }
  });
  tx();

  res.json({ created, skipped });
});
