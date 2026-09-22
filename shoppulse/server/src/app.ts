import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import './db/index.js';
import { authRouter, enforceReadOnly, requireAuth, requireCsrfHeader, requireOwner } from './auth/index.js';
import { teamRouter } from './routes/team.js';
import { autopilotRouter } from './routes/autopilot.js';
import { aiRouter } from './routes/ai.js';
import { config } from './config.js';
import fs from 'node:fs';
import { shopsRouter } from './routes/shops.js';
import { experimentsRouter } from './routes/experiments.js';
import { pricingRouter } from './routes/pricing.js';
import { publicRouter } from './routes/public.js';
import { inventoryPushRouter, inventoryRouter } from './routes/inventory.js';
import { demoShopRouter } from './demoShop.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Zugriffsmodell:
 *  - Oeffentlich, CORS offen (Aufruf aus beliebigen Shop-Domains): Snippet, /api/collect, /api/public/*
 *    -> Mandant ergibt sich ausschliesslich aus dem Shop-Key.
 *  - Server-zu-Server: /api/inventory/push -> Mandant ergibt sich ausschliesslich aus dem Push-Token.
 *  - Dashboard (/api/...): Login-Session (HttpOnly-Cookie, SameSite=Strict) + CSRF-Header,
 *    CORS nur fuer ausdruecklich erlaubte Dashboard-Origins; jede Route prueft die Organisation.
 */
export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  if (process.env.SHOPPULSE_TRUST_PROXY) app.set('trust proxy', process.env.SHOPPULSE_TRUST_PROXY);

  app.use((_req, res, next) => {
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.set('X-Frame-Options', 'DENY');
    // HTTPS erzwingen, sobald Cookies nur noch ueber HTTPS laufen (Produktivbetrieb)
    if (config.cookieSecure) res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    next();
  });

  // --- oeffentlich (Shop-Seiten) --------------------------------------------
  const openCors = cors({ origin: '*', methods: ['GET', 'POST'], credentials: false });
  app.get('/snippet.js', openCors, (_req, res) => {
    res.type('application/javascript');
    res.set('Cache-Control', 'public, max-age=300');
    res.sendFile(path.join(__dirname, 'public', 'snippet.js'));
  });
  app.use('/api/collect', openCors, express.text({ type: 'text/plain', limit: '64kb' }), express.json({ limit: '256kb' }));
  app.use('/api/public', openCors);
  app.use('/api', publicRouter);

  // --- Server-zu-Server (eigener Token, grosse Bestandslisten) ----------------
  app.use('/api/inventory/push', express.json({ limit: '10mb' }));
  app.use('/api', inventoryPushRouter);

  // --- Demo-/Test-Shop-Seiten -----------------------------------------------
  app.use('/demo-shop', demoShopRouter);
  app.get('/api/health', (_req, res) => res.json({ ok: true, name: 'ShopPulse API' }));

  // --- Dashboard ------------------------------------------------------------
  const dashboardOrigins = (process.env.SHOPPULSE_DASHBOARD_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  // Ohne Konfiguration keinerlei CORS-Freigabe: das Dashboard laeuft dann nur same-origin (bzw. ueber den Vite-Proxy)
  app.use('/api', cors({ origin: dashboardOrigins.length ? dashboardOrigins : false, credentials: true }));
  // CSV-Uploads (Bestaende, Wettbewerbspreise) koennen gross sein – nur fuer angemeldete Personen relevant
  app.use('/api', express.json({ limit: '10mb' }), requireCsrfHeader);
  app.use('/api/auth', authRouter);
  app.use('/api', requireAuth, enforceReadOnly);
  app.use('/api/org', teamRouter);
  // Shops loeschen nur fuer Inhaber:innen
  app.delete('/api/shops/:id', requireOwner);
  app.use('/api/shops', shopsRouter);
  app.use('/api', experimentsRouter);
  app.use('/api', pricingRouter);
  app.use('/api', inventoryRouter);
  app.use('/api', autopilotRouter);
  app.use('/api', aiRouter);
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Nicht gefunden.' }));

  // --- Dashboard-Oberflaeche (Produktivbetrieb: API und Oberflaeche unter einer Adresse) ---
  if (fs.existsSync(path.join(config.webDist, 'index.html'))) {
    const csp = [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:",
      "connect-src 'self'",
      "font-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join('; ');
    const setCsp = (res: express.Response) => res.set('Content-Security-Policy', csp);
    app.use(express.static(config.webDist, { index: false, setHeaders: setCsp }));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/') || req.path.startsWith('/demo-shop')) return next();
      setCsp(res);
      res.sendFile(path.join(config.webDist, 'index.html'));
    });
  }

  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const status = (err as { status?: number })?.status;
    if (status && status >= 400 && status < 500) return res.status(status).json({ error: 'Ungültige Anfrage.' });
    console.error(err);
    res.status(500).json({ error: 'Interner Serverfehler.' });
  });
  return app;
}
