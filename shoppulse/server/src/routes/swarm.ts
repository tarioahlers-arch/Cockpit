import { Router } from 'express';
import { ownedShop, requireOwner } from '../auth/index.js';
import { getBenchmarks, getNudgeEvidence, MIN_SHOPS, networkSize, optIn, optOut, sourceHash } from '../swarm/swarm.js';
import { db } from '../db/index.js';
import { logAction } from '../autopilot/engine.js';

export const swarmRouter = Router();

swarmRouter.get('/shops/:id/swarm', (req, res) => {
  const shop = ownedShop(req, req.params.id);
  if (!shop) return res.status(404).json({ error: 'Shop nicht gefunden.' });
  const participating = !!sourceHash(shop);
  const contributions = participating
    ? (db.prepare('SELECT COUNT(*) as n FROM swarm_results WHERE source_hash = ?').get(sourceHash(shop)) as { n: number }).n
    : 0;
  res.json({
    participating,
    minShops: MIN_SHOPS,
    niche: shop.niche,
    network: networkSize(shop),
    contributions,
    // Geben und Nehmen: Auswertungen nur fuer teilnehmende Shops
    benchmarks: participating ? getBenchmarks(shop) : null,
    evidence: participating ? getNudgeEvidence(shop) : null,
  });
});

/** Teilnahme ist eine Entscheidung ueber Unternehmensdaten – nur Inhaber:innen. */
swarmRouter.put('/shops/:id/swarm', requireOwner, (req, res) => {
  const shop = ownedShop(req, req.params.id);
  if (!shop) return res.status(404).json({ error: 'Shop nicht gefunden.' });
  if (req.body?.participate === true) {
    optIn(shop.id);
    logAction(shop.id, 'settings', 'Teilnahme am Schwarmwissen gestartet', `durch ${req.user!.name}`);
    return res.json({ ok: true });
  }
  if (req.body?.participate === false) {
    const removed = optOut(shop.id);
    logAction(shop.id, 'settings', 'Teilnahme am Schwarmwissen beendet', `durch ${req.user!.name}; ${removed} Beiträge gelöscht`);
    return res.json({ ok: true, removed });
  }
  res.status(400).json({ error: 'participate (true/false) fehlt.' });
});
