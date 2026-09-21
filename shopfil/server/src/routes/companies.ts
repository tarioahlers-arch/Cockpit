import { Router } from 'express';
import { db } from '../db/index.js';
import { runAutomatedScan } from '../scanner/index.js';
import { computeScoring, type ResultRow } from '../scoring.js';

export const companiesRouter = Router();

const BATCH_DELAY_MS = Number(process.env.BATCH_ANALYZE_DELAY_MS ?? 1000);

interface CompanyRow {
  id: number;
  name: string;
  url: string | null;
  domain: string | null;
  shop_id: number | null;
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Modul 2: Batch-Analyzer. Laesst den bestehenden automatisierten ShopFil-
// Scanner (ohne manuelle Checkliste) sequenziell ueber mehrere Companies
// laufen, um Leads nach Schwachstellen-Score zu priorisieren. Wird NIE
// automatisch nach einem Recherche-Lauf ausgefuehrt - der Nutzer muss das
// explizit anstossen (siehe Punkt 6 im Auftrag).
companiesRouter.post('/batch-analyze', async (req, res) => {
  const { companyIds } = req.body ?? {};
  if (!Array.isArray(companyIds) || companyIds.length === 0) {
    return res.status(400).json({ error: 'companyIds muss ein nicht-leeres Array sein.' });
  }

  const results: { companyId: number; status: 'completed' | 'failed' | 'skipped'; overallScore?: number | null; error?: string }[] = [];

  for (const rawId of companyIds) {
    const companyId = Number(rawId);
    const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(companyId) as CompanyRow | undefined;
    if (!company) {
      results.push({ companyId, status: 'skipped', error: 'Firma nicht gefunden.' });
      continue;
    }
    const targetUrl = company.url || (company.domain ? `https://${company.domain}` : null);
    if (!targetUrl) {
      results.push({ companyId, status: 'skipped', error: 'Keine URL/Domain fuer diese Firma hinterlegt.' });
      continue;
    }

    let shopId = company.shop_id;
    if (!shopId) {
      const shopInfo = db.prepare('INSERT INTO shops (name, url) VALUES (?, ?)').run(company.name, targetUrl);
      shopId = shopInfo.lastInsertRowid as number;
      db.prepare('UPDATE companies SET shop_id = ? WHERE id = ?').run(shopId, companyId);
    }

    const runInfo = db
      .prepare(`INSERT INTO audit_runs (shop_id, status, mode) VALUES (?, 'automated_pending', 'lead_scan')`)
      .run(shopId);
    const auditRunId = runInfo.lastInsertRowid as number;

    try {
      const scanResults = await runAutomatedScan(targetUrl, null);
      const automatedCriteria = db.prepare('SELECT id, key FROM criteria WHERE automated = 1').all() as {
        id: number;
        key: string;
      }[];
      const insert = db.prepare(
        `INSERT INTO criterion_results (audit_run_id, criterion_id, score, passed, detail) VALUES (?, ?, ?, ?, ?)`,
      );
      const tx = db.transaction(() => {
        for (const criterion of automatedCriteria) {
          const result = scanResults[criterion.key];
          if (!result) continue;
          insert.run(auditRunId, criterion.id, result.score, result.passed ? 1 : 0, result.detail);
        }
      });
      tx();

      const rows = resultRowsForRun(auditRunId);
      const scoring = computeScoring(rows, { onlyAutomated: true });
      db.prepare(`UPDATE audit_runs SET status = 'completed', overall_score = ? WHERE id = ?`).run(
        scoring.overallScore,
        auditRunId,
      );
      db.prepare(`UPDATE companies SET status = 'analysiert' WHERE id = ?`).run(companyId);
      results.push({ companyId, status: 'completed', overallScore: scoring.overallScore });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unbekannter Fehler beim Lead-Scan.';
      db.prepare(`UPDATE audit_runs SET status = 'failed', error = ? WHERE id = ?`).run(message, auditRunId);
      results.push({ companyId, status: 'failed', error: message });
    }

    await sleep(BATCH_DELAY_MS);
  }

  res.json({ results });
});

companiesRouter.get('/', (req, res) => {
  const { status, verified } = req.query;
  const clauses: string[] = [];
  const args: unknown[] = [];
  if (status && typeof status === 'string') {
    clauses.push('status = ?');
    args.push(status);
  }
  if (verified !== undefined) {
    clauses.push('verifiziert = ?');
    args.push(verified === 'true' ? 1 : 0);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const companies = db.prepare(`SELECT * FROM companies ${where} ORDER BY created_at DESC`).all(...args);
  res.json(companies);
});

companiesRouter.get('/:id', (req, res) => {
  const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(req.params.id);
  if (!company) return res.status(404).json({ error: 'Firma nicht gefunden.' });

  let latestAudit = null;
  const row = company as { shop_id: number | null };
  if (row.shop_id) {
    latestAudit = db
      .prepare('SELECT * FROM audit_runs WHERE shop_id = ? ORDER BY created_at DESC LIMIT 1')
      .get(row.shop_id);
  }
  res.json({ company, latestAudit });
});

companiesRouter.patch('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM companies WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Firma nicht gefunden.' });

  const { verifiziert, status, notes } = req.body ?? {};
  const fields: string[] = [];
  const args: unknown[] = [];
  if (verifiziert !== undefined) {
    fields.push('verifiziert = ?');
    args.push(verifiziert ? 1 : 0);
  }
  if (status !== undefined) {
    if (!['neu', 'analysiert', 'qualifiziert', 'abgelehnt'].includes(status)) {
      return res.status(400).json({ error: 'Ungueltiger status.' });
    }
    fields.push('status = ?');
    args.push(status);
  }
  if (notes !== undefined) {
    fields.push('notes = ?');
    args.push(String(notes).slice(0, 2000));
  }
  if (fields.length === 0) {
    return res.status(400).json({ error: 'Keine aktualisierbaren Felder uebergeben.' });
  }
  args.push(req.params.id);
  db.prepare(`UPDATE companies SET ${fields.join(', ')} WHERE id = ?`).run(...args);
  res.json(db.prepare('SELECT * FROM companies WHERE id = ?').get(req.params.id));
});

companiesRouter.delete('/:id', (req, res) => {
  const info = db.prepare('DELETE FROM companies WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Firma nicht gefunden.' });
  res.status(204).end();
});
