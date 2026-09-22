import { Router } from 'express';
import { ownedShop, ownsShop } from '../auth/index.js';
import { db } from '../db/index.js';
import { AUTOPILOT_NUDGES, allowedNudges, getAutopilotSettings, logAction, runAutopilot } from '../autopilot/engine.js';
import { computeUplift, monthRange } from '../autopilot/uplift.js';
import { isNudgeType } from '../analytics/nudges.js';

export const autopilotRouter = Router();

autopilotRouter.get('/shops/:id/autopilot', (req, res) => {
  const shop = ownedShop(req, req.params.id);
  if (!shop) return res.status(404).json({ error: 'Shop nicht gefunden.' });
  const settings = getAutopilotSettings(shop.id);
  const now = new Date();
  const [from] = monthRange(now.toISOString().slice(0, 7));
  const to = new Date(Date.now() + 86_400_000).toISOString().slice(0, 19).replace('T', ' ');
  res.json({
    settings: { ...settings, allowed_nudges: allowedNudges(settings) },
    availableNudges: AUTOPILOT_NUDGES,
    // "undoable": nur solange der Rollout aktiv bzw. der Test noch laeuft oder als Entwurf wartet
    log: db
      .prepare(
        `SELECT l.*,
           CASE
             WHEN l.undone_at IS NOT NULL THEN 0
             WHEN l.action = 'rollout' THEN COALESCE((SELECT r.active FROM nudge_rollouts r WHERE r.id = l.rollout_id), 0)
             WHEN l.action IN ('test_started', 'test_proposed') THEN
               COALESCE((SELECT e.status IN ('running', 'draft') FROM experiments e WHERE e.id = l.experiment_id), 0)
             ELSE 0
           END AS undoable
         FROM autopilot_log l WHERE l.shop_id = ? ORDER BY l.id DESC LIMIT 50`,
      )
      .all(shop.id),
    rollouts: db.prepare('SELECT * FROM nudge_rollouts WHERE shop_id = ? ORDER BY id DESC').all(shop.id),
    runningTest: db
      .prepare(`SELECT id, name, nudge_type, status, started_at FROM experiments WHERE shop_id = ? AND created_by_autopilot = 1 AND status IN ('running','draft') ORDER BY id DESC LIMIT 1`)
      .get(shop.id) ?? null,
    upliftMonthToDate: computeUplift(shop.id, from, to),
  });
});

/** Einschalten = einmalige Freigabe; nur Bearbeiten/Inhaber (Lesezugriff wird global abgewiesen). */
autopilotRouter.put('/shops/:id/autopilot', (req, res) => {
  const shop = ownedShop(req, req.params.id);
  if (!shop) return res.status(404).json({ error: 'Shop nicht gefunden.' });
  const cur = getAutopilotSettings(shop.id);
  const b = req.body ?? {};
  const enabled = typeof b.enabled === 'boolean' ? Number(b.enabled) : cur.enabled;
  const mode = b.mode === 'auto' || b.mode === 'suggest' ? b.mode : cur.mode;
  const holdout = Number.isFinite(Number(b.holdoutShare)) ? Math.min(0.3, Math.max(0.02, Number(b.holdoutShare))) : cur.holdout_share;
  const nudges = Array.isArray(b.allowedNudges)
    ? (b.allowedNudges as unknown[]).filter(isNudgeType).filter((n) => AUTOPILOT_NUDGES.includes(n))
    : allowedNudges(cur);
  db.prepare(
    `INSERT INTO autopilot_settings (shop_id, enabled, mode, holdout_share, allowed_nudges, updated_by, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(shop_id) DO UPDATE SET enabled = excluded.enabled, mode = excluded.mode, holdout_share = excluded.holdout_share,
       allowed_nudges = excluded.allowed_nudges, updated_by = excluded.updated_by, updated_at = excluded.updated_at`,
  ).run(shop.id, enabled, mode, holdout, JSON.stringify(nudges), req.user!.id);
  if (enabled !== cur.enabled || mode !== cur.mode) {
    logAction(
      shop.id,
      'settings',
      enabled ? `Autopilot ${cur.enabled ? 'geändert' : 'eingeschaltet'} (${mode === 'auto' ? 'startet Tests selbst' : 'schlägt Tests vor'})` : 'Autopilot ausgeschaltet',
      `durch ${req.user!.name}`,
    );
  }
  res.json({ ok: true });
});

autopilotRouter.post('/shops/:id/autopilot/run', (req, res) => {
  const shop = ownedShop(req, req.params.id);
  if (!shop) return res.status(404).json({ error: 'Shop nicht gefunden.' });
  res.json(runAutopilot(shop));
});

/** Aktion rueckgaengig machen: Rollout beenden bzw. gestarteten/vorgeschlagenen Test stoppen. */
autopilotRouter.post('/autopilot/log/:id/undo', (req, res) => {
  const entry = db.prepare('SELECT * FROM autopilot_log WHERE id = ?').get(req.params.id) as
    | { id: number; shop_id: number; action: string; experiment_id: number | null; rollout_id: number | null; undone_at: string | null }
    | undefined;
  if (!entry || !ownsShop(req, entry.shop_id)) return res.status(404).json({ error: 'Eintrag nicht gefunden.' });
  if (entry.undone_at) return res.status(400).json({ error: 'Bereits rückgängig gemacht.' });
  let changed = 0;
  if (entry.action === 'rollout' && entry.rollout_id) {
    changed = db
      .prepare(`UPDATE nudge_rollouts SET active = 0, ended_at = datetime('now') WHERE id = ? AND shop_id = ? AND active = 1`)
      .run(entry.rollout_id, entry.shop_id).changes;
  } else if ((entry.action === 'test_started' || entry.action === 'test_proposed') && entry.experiment_id) {
    changed = db
      .prepare(
        `UPDATE experiments SET status = 'stopped', stopped_at = datetime('now')
         WHERE id = ? AND shop_id = ? AND status IN ('running', 'draft')`,
      )
      .run(entry.experiment_id, entry.shop_id).changes;
  } else {
    return res.status(400).json({ error: 'Diese Aktion lässt sich nicht rückgängig machen.' });
  }
  if (!changed) return res.status(400).json({ error: 'Die Aktion ist nicht mehr aktiv (Test beendet bzw. Rollout bereits zurückgenommen).' });
  db.prepare(`UPDATE autopilot_log SET undone_at = datetime('now'), undone_by = ? WHERE id = ?`).run(req.user!.id, entry.id);
  logAction(entry.shop_id, 'undo', 'Aktion rückgängig gemacht', `durch ${req.user!.name} (Eintrag #${entry.id})`);
  res.json({ ok: true });
});

/** Monatlicher Wirkungsbericht (Uplift-Nachweis gegenueber der Kontrollgruppe). */
autopilotRouter.get('/shops/:id/uplift', (req, res) => {
  const shop = ownedShop(req, req.params.id);
  if (!shop) return res.status(404).json({ error: 'Shop nicht gefunden.' });
  const m = typeof req.query.month === 'string' && /^\d{4}-\d{2}$/.test(req.query.month) ? req.query.month : new Date().toISOString().slice(0, 7);
  const [from, to] = monthRange(m);
  res.json({ month: m, ...computeUplift(shop.id, from, to) });
});
