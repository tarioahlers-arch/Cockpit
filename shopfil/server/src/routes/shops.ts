import { Router } from 'express';
import { db } from '../db/index.js';
import { computeScoring, type ResultRow } from '../scoring.js';

export const shopsRouter = Router();

interface ShopRow {
  id: number;
  name: string;
  url: string;
  product_url: string | null;
  created_at: string;
}

interface AuditRunRow {
  id: number;
  shop_id: number;
  created_at: string;
  status: string;
  overall_score: number | null;
  error: string | null;
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

shopsRouter.get('/', (_req, res) => {
  const shops = db.prepare('SELECT * FROM shops ORDER BY created_at DESC').all() as ShopRow[];

  const withScores = shops.map((shop) => {
    const runs = db
      .prepare(
        `SELECT id, created_at, status, overall_score FROM audit_runs
         WHERE shop_id = ? AND status = 'completed'
         ORDER BY created_at ASC`,
      )
      .all(shop.id) as Pick<AuditRunRow, 'id' | 'created_at' | 'status' | 'overall_score'>[];

    return {
      ...shop,
      latestScore: runs.length ? runs[runs.length - 1].overall_score : null,
      history: runs.map((r) => ({ id: r.id, createdAt: r.created_at, overallScore: r.overall_score })),
    };
  });

  res.json(withScores);
});

shopsRouter.post('/', (req, res) => {
  const { name, url, productUrl } = req.body ?? {};
  if (!name || typeof name !== 'string' || !url || typeof url !== 'string') {
    return res.status(400).json({ error: 'name und url sind Pflichtfelder.' });
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return res.status(400).json({ error: 'url ist keine gueltige URL.' });
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return res.status(400).json({ error: 'Nur http/https URLs sind erlaubt.' });
  }

  const info = db
    .prepare('INSERT INTO shops (name, url, product_url) VALUES (?, ?, ?)')
    .run(name.trim(), url.trim(), productUrl ? String(productUrl).trim() : null);

  const shop = db.prepare('SELECT * FROM shops WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(shop);
});

shopsRouter.get('/:id', (req, res) => {
  const shop = db.prepare('SELECT * FROM shops WHERE id = ?').get(req.params.id) as ShopRow | undefined;
  if (!shop) return res.status(404).json({ error: 'Shop nicht gefunden.' });

  const runs = db
    .prepare('SELECT * FROM audit_runs WHERE shop_id = ? ORDER BY created_at DESC')
    .all(shop.id) as AuditRunRow[];

  const completedRuns = runs.filter((r) => r.status === 'completed');
  const history = [...completedRuns]
    .reverse()
    .map((r) => ({ id: r.id, createdAt: r.created_at, overallScore: r.overall_score }));

  const latestRun = runs[0] ?? null;
  let latest: ReturnType<typeof computeScoring> | null = null;
  if (latestRun) {
    latest = computeScoring(resultRowsForRun(latestRun.id));
  }

  res.json({
    shop,
    history,
    latestRun: latestRun
      ? { id: latestRun.id, createdAt: latestRun.created_at, status: latestRun.status, error: latestRun.error }
      : null,
    latestScoring: latest,
    allRuns: runs.map((r) => ({ id: r.id, createdAt: r.created_at, status: r.status, overallScore: r.overall_score })),
  });
});

shopsRouter.delete('/:id', (req, res) => {
  const info = db.prepare('DELETE FROM shops WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Shop nicht gefunden.' });
  res.status(204).end();
});
