import { Router } from 'express';
import { db } from '../db/index.js';
import { runAutomatedScan } from '../scanner/index.js';
import { computeScoring, type ResultRow } from '../scoring.js';

export const auditsRouter = Router();

interface CriterionRow {
  id: number;
  key: string;
  category: string;
  label: string;
  description: string;
  weight: number;
  automated: number;
  recommendation: string;
  source: string;
}

function resultRowsForRun(auditRunId: number): ResultRow[] {
  return db
    .prepare(
      `SELECT c.id as criterion_id, c.key, c.category, c.label, c.description, c.weight,
              c.automated, c.recommendation, c.source,
              cr.score, cr.passed, cr.notes, cr.detail
       FROM criteria c
       LEFT JOIN criterion_results cr ON cr.criterion_id = c.id AND cr.audit_run_id = ?
       ORDER BY c.category, c.weight DESC`,
    )
    .all(auditRunId) as ResultRow[];
}

// Neuen Audit-Run starten: fuehrt den automatisierten Scan aus und legt
// Ergebnisse fuer alle automatisierten Kriterien an. Die manuellen
// (goodFil-artigen) Kriterien bleiben offen und werden vom "digitalen
// Mystery Shopper" per PATCH .../manual nachgetragen.
auditsRouter.post('/shops/:shopId/audits', async (req, res) => {
  const shop = db.prepare('SELECT * FROM shops WHERE id = ?').get(req.params.shopId) as
    | { id: number; url: string; product_url: string | null }
    | undefined;
  if (!shop) return res.status(404).json({ error: 'Shop nicht gefunden.' });

  const runInfo = db
    .prepare(`INSERT INTO audit_runs (shop_id, status) VALUES (?, 'automated_pending')`)
    .run(shop.id);
  const auditRunId = runInfo.lastInsertRowid as number;

  try {
    const scanResults = await runAutomatedScan(shop.url, shop.product_url);
    const criteria = db.prepare('SELECT * FROM criteria WHERE automated = 1').all() as CriterionRow[];

    const insert = db.prepare(
      `INSERT INTO criterion_results (audit_run_id, criterion_id, score, passed, detail)
       VALUES (?, ?, ?, ?, ?)`,
    );
    const insertAll = db.transaction(() => {
      for (const criterion of criteria) {
        const result = scanResults[criterion.key];
        if (!result) continue;
        insert.run(auditRunId, criterion.id, result.score, result.passed ? 1 : 0, result.detail);
      }
      db.prepare(`UPDATE audit_runs SET status = 'awaiting_manual' WHERE id = ?`).run(auditRunId);
    });
    insertAll();
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler beim Scan.';
    db.prepare(`UPDATE audit_runs SET status = 'failed', error = ? WHERE id = ?`).run(message, auditRunId);
    return res.status(502).json({
      error: `Der Shop konnte nicht automatisiert gescannt werden: ${message}`,
      auditRunId,
    });
  }

  const manualCriteria = db
    .prepare('SELECT * FROM criteria WHERE automated = 0 ORDER BY category, weight DESC')
    .all() as CriterionRow[];

  res.status(201).json({
    auditRunId,
    status: 'awaiting_manual',
    manualCriteria: manualCriteria.map((c) => ({
      id: c.id,
      key: c.key,
      category: c.category,
      label: c.label,
      description: c.description,
      weight: c.weight,
      source: c.source,
    })),
    automatedResults: resultRowsForRun(auditRunId).filter((r) => r.automated === 1),
  });
});

auditsRouter.get('/audits/:id', (req, res) => {
  const run = db.prepare('SELECT * FROM audit_runs WHERE id = ?').get(req.params.id) as
    | { id: number; shop_id: number; created_at: string; status: string; overall_score: number | null; error: string | null }
    | undefined;
  if (!run) return res.status(404).json({ error: 'Audit nicht gefunden.' });

  const rows = resultRowsForRun(run.id);
  const scoring = computeScoring(rows);

  res.json({
    run,
    results: rows,
    scoring,
  });
});

// Manuelle (goodFil-artige) Checklisten-Ergebnisse eines digitalen Testkaufs eintragen.
auditsRouter.patch('/audits/:id/manual', (req, res) => {
  const run = db.prepare('SELECT * FROM audit_runs WHERE id = ?').get(req.params.id) as
    | { id: number; status: string }
    | undefined;
  if (!run) return res.status(404).json({ error: 'Audit nicht gefunden.' });
  if (run.status === 'failed') {
    return res.status(409).json({ error: 'Dieser Audit-Run ist fehlgeschlagen und kann nicht ergaenzt werden.' });
  }

  const { results } = req.body ?? {};
  if (!Array.isArray(results)) {
    return res.status(400).json({ error: 'results muss ein Array sein.' });
  }

  const manualCriteria = db.prepare('SELECT id FROM criteria WHERE automated = 0').all() as { id: number }[];
  const manualIds = new Set(manualCriteria.map((c) => c.id));

  const upsert = db.prepare(`
    INSERT INTO criterion_results (audit_run_id, criterion_id, score, passed, notes)
    VALUES (@auditRunId, @criterionId, @score, @passed, @notes)
    ON CONFLICT(audit_run_id, criterion_id) DO UPDATE SET
      score = excluded.score, passed = excluded.passed, notes = excluded.notes
  `);

  const tx = db.transaction(() => {
    for (const r of results) {
      const criterionId = Number(r.criterionId);
      const score = Math.max(0, Math.min(100, Number(r.score)));
      if (!manualIds.has(criterionId) || Number.isNaN(score)) continue;
      upsert.run({
        auditRunId: run.id,
        criterionId,
        score,
        passed: score >= 70 ? 1 : 0,
        notes: r.notes ? String(r.notes).slice(0, 2000) : null,
      });
    }
  });
  tx();

  const rows = resultRowsForRun(run.id);
  const scoring = computeScoring(rows);

  if (scoring.isComplete) {
    db.prepare(`UPDATE audit_runs SET status = 'completed', overall_score = ? WHERE id = ?`).run(
      scoring.overallScore,
      run.id,
    );
  }

  const updatedRun = db.prepare('SELECT * FROM audit_runs WHERE id = ?').get(run.id);
  res.json({ run: updatedRun, results: rows, scoring });
});
