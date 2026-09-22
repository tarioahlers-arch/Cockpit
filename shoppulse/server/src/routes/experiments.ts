import { Router } from 'express';
import { ownedShop, ownsShop } from '../auth/index.js';
import { db, recentEvents, type ExperimentRow } from '../db/index.js';
import { analyzeExperiment } from '../analytics/experiments.js';
import { NUDGES, isNudgeType } from '../analytics/nudges.js';

export const experimentsRouter = Router();

const PAGE_TYPES = ['home', 'category', 'product', 'cart', 'checkout', 'other'];

function withAnalysis(exp: ExperimentRow) {
  const since = exp.started_at ?? exp.created_at;
  const events = recentEvents(exp.shop_id, 90).filter((e) => e.ts >= since);
  return { ...exp, config: JSON.parse(exp.config), analysis: analyzeExperiment(exp, events) };
}

experimentsRouter.get('/nudges', (_req, res) => {
  res.json(Object.values(NUDGES));
});

experimentsRouter.get('/shops/:id/experiments', (req, res) => {
  const shop = ownedShop(req, req.params.id);
  if (!shop) return res.status(404).json({ error: 'Shop nicht gefunden.' });
  const rows = db
    .prepare('SELECT * FROM experiments WHERE shop_id = ? ORDER BY created_at DESC')
    .all(shop.id) as ExperimentRow[];
  res.json(rows.map(withAnalysis));
});

experimentsRouter.post('/shops/:id/experiments', (req, res) => {
  const shop = ownedShop(req, req.params.id);
  if (!shop) return res.status(404).json({ error: 'Shop nicht gefunden.' });
  const { name, nudgeType, pageType, config, trafficSplit } = req.body ?? {};
  if (!isNudgeType(nudgeType)) return res.status(400).json({ error: 'Unbekannter Nudge-Typ.' });
  const page = typeof pageType === 'string' && PAGE_TYPES.includes(pageType) ? pageType : 'product';
  const split = typeof trafficSplit === 'number' && trafficSplit > 0 && trafficSplit < 1 ? trafficSplit : 0.5;
  const merged = { ...NUDGES[nudgeType].defaultConfig, ...(config && typeof config === 'object' ? config : {}) };
  if (nudgeType === 'decoy' && !merged.targetSku) {
    return res.status(400).json({ error: 'Für den Decoy-Test ist targetSku (Zielvariante) nötig.' });
  }
  const info = db
    .prepare(
      'INSERT INTO experiments (shop_id, name, nudge_type, page_type, config, traffic_split) VALUES (?, ?, ?, ?, ?, ?)',
    )
    .run(
      shop.id,
      typeof name === 'string' && name.trim() ? name.trim() : NUDGES[nudgeType].label,
      nudgeType,
      page,
      JSON.stringify(merged),
      split,
    );
  const row = db.prepare('SELECT * FROM experiments WHERE id = ?').get(info.lastInsertRowid) as ExperimentRow;
  res.status(201).json(withAnalysis(row));
});

experimentsRouter.patch('/experiments/:id', (req, res) => {
  const exp = db.prepare('SELECT * FROM experiments WHERE id = ?').get(req.params.id) as ExperimentRow | undefined;
  if (!exp || !ownsShop(req, exp.shop_id)) return res.status(404).json({ error: 'Experiment nicht gefunden.' });
  const { status } = req.body ?? {};
  if (status === 'running' && exp.status === 'draft') {
    db.prepare(`UPDATE experiments SET status = 'running', started_at = datetime('now') WHERE id = ?`).run(exp.id);
  } else if (status === 'stopped' && exp.status === 'running') {
    db.prepare(`UPDATE experiments SET status = 'stopped', stopped_at = datetime('now') WHERE id = ?`).run(exp.id);
  } else {
    return res.status(400).json({ error: `Statuswechsel ${exp.status} → ${status} ist nicht erlaubt.` });
  }
  const row = db.prepare('SELECT * FROM experiments WHERE id = ?').get(exp.id) as ExperimentRow;
  res.json(withAnalysis(row));
});

experimentsRouter.delete('/experiments/:id', (req, res) => {
  const info = db
    .prepare('DELETE FROM experiments WHERE id = ? AND shop_id IN (SELECT id FROM shops WHERE org_id = ?)')
    .run(req.params.id, req.user!.orgId);
  if (info.changes === 0) return res.status(404).json({ error: 'Experiment nicht gefunden.' });
  res.status(204).end();
});
