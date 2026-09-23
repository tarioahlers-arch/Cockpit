import { Router } from 'express';
import { ownedShop } from '../auth/index.js';
import { clickDepth, elementStats, frustrationSummary, pageStats } from '../analytics/clicks.js';
import { signToken } from '../security/secrets.js';

export const clicksRouter = Router();

const DEVICES = ['mobile', 'tablet', 'desktop'];
const daysOf = (v: unknown) => Math.min(90, Math.max(1, Number(v) || 30));
const deviceOf = (v: unknown) => (typeof v === 'string' && DEVICES.includes(v) ? v : undefined);

clicksRouter.get('/shops/:id/clicks', (req, res) => {
  const shop = ownedShop(req, req.params.id);
  if (!shop) return res.status(404).json({ error: 'Shop nicht gefunden.' });
  const days = daysOf(req.query.days);
  res.json({ summary: frustrationSummary(shop.id, days), pages: pageStats(shop.id, days), problemElements: elementStats(shop.id, days, undefined, undefined, 10) });
});

clicksRouter.get('/shops/:id/clicks/page', (req, res) => {
  const shop = ownedShop(req, req.params.id);
  if (!shop) return res.status(404).json({ error: 'Shop nicht gefunden.' });
  const page = typeof req.query.page === 'string' ? req.query.page.slice(0, 120) : '';
  if (!page) return res.status(400).json({ error: 'page fehlt.' });
  const days = daysOf(req.query.days);
  const device = deviceOf(req.query.device);
  res.json({ pageKey: page, device: device ?? null, elements: elementStats(shop.id, days, page, device, 30), depth: clickDepth(shop.id, page, days, device) });
});

/** Kurzlebiger, signierter Link fuer die Heatmap-Ansicht direkt auf der Shopseite (15 Minuten gueltig). */
clicksRouter.post('/shops/:id/clicks/heatmap-link', (req, res) => {
  const shop = ownedShop(req, req.params.id);
  if (!shop) return res.status(404).json({ error: 'Shop nicht gefunden.' });
  const page = pageStats(shop.id, 90).find((p) => p.pageKey === req.body?.page);
  if (!page) return res.status(404).json({ error: 'Für diese Seite liegen keine Klicks vor.' });
  const days = daysOf(req.body?.days);
  const device = deviceOf(req.body?.device);
  const token = signToken('heatmap', { s: shop.id, p: page.pageKey, d: device ?? null, n: days }, 15 * 60);
  res.json({ token, pagePath: page.pagePath, domain: shop.domain, isDemo: !!shop.is_demo });
});
