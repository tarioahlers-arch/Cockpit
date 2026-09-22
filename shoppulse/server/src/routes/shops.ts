import { Router } from 'express';
import { ownedShop } from '../auth/index.js';
import crypto from 'node:crypto';
import { db, invalidateEvents, recentEvents, type ShopRow } from '../db/index.js';
import { computeFunnel, monthlyRevenue } from '../analytics/metrics.js';
import { computeOverview } from '../services/overview.js';
import { createDemoShop } from '../db/demoData.js';

export const shopsRouter = Router();

const PLATFORMS = ['shopify', 'shopware', 'woocommerce', 'custom'];

shopsRouter.get('/', (req, res) => {
  const shops = db.prepare('SELECT * FROM shops WHERE org_id = ? ORDER BY created_at DESC').all(req.user!.orgId) as ShopRow[];
  res.json(
    shops.map((s) => {
      const funnel = computeFunnel(recentEvents(s.id));
      const running = (
        db.prepare(`SELECT COUNT(*) as n FROM experiments WHERE shop_id = ? AND status = 'running'`).get(s.id) as {
          n: number;
        }
      ).n;
      return {
        ...s,
        sessions30d: funnel.sessions,
        conversionRate: funnel.conversionRate,
        monthlyRevenue: Math.round(monthlyRevenue(funnel)),
        runningExperiments: running,
      };
    }),
  );
});

shopsRouter.post('/', (req, res) => {
  const { name, domain, platform, niche } = req.body ?? {};
  if (!name || typeof name !== 'string' || !domain || typeof domain !== 'string') {
    return res.status(400).json({ error: 'name und domain sind Pflichtfelder.' });
  }
  const cleanDomain = domain.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '').toLowerCase();
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(cleanDomain) && cleanDomain !== 'localhost') {
    return res.status(400).json({ error: 'domain ist ungültig (z. B. mein-shop.de).' });
  }
  const p = typeof platform === 'string' && PLATFORMS.includes(platform) ? platform : 'custom';
  const key = 'pk_' + crypto.randomBytes(12).toString('hex');
  const info = db
    .prepare('INSERT INTO shops (name, domain, platform, niche, public_key, org_id) VALUES (?, ?, ?, ?, ?, ?)')
    .run(name.trim(), cleanDomain, p, typeof niche === 'string' && niche.trim() ? niche.trim() : 'allgemein', key, req.user!.orgId);
  res.status(201).json(ownedShop(req, Number(info.lastInsertRowid)));
});

shopsRouter.post('/demo', (req, res) => {
  res.status(201).json(createDemoShop(req.user!.orgId));
});

shopsRouter.get('/:id', (req, res) => {
  const shop = ownedShop(req, req.params.id);
  if (!shop) return res.status(404).json({ error: 'Shop nicht gefunden.' });
  res.json(shop);
});

shopsRouter.delete('/:id', (req, res) => {
  const info = db.prepare('DELETE FROM shops WHERE id = ? AND org_id = ?').run(req.params.id, req.user!.orgId);
  if (info.changes === 0) return res.status(404).json({ error: 'Shop nicht gefunden.' });
  invalidateEvents(Number(req.params.id));
  res.status(204).end();
});

/** Beratungs-Dashboard: KPIs, Segmente, priorisierte Empfehlungen, Tagesverlauf. */
shopsRouter.get('/:id/overview', (req, res) => {
  const shop = ownedShop(req, req.params.id);
  if (!shop) return res.status(404).json({ error: 'Shop nicht gefunden.' });
  const days = Math.min(90, Math.max(1, Number(req.query.days) || 30));
  res.json(computeOverview(shop, days));
});
