import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import './db/index.js';
import { shopsRouter } from './routes/shops.js';
import { auditsRouter } from './routes/audits.js';
import { criteriaRouter } from './routes/criteria.js';
import { researchRouter } from './routes/research.js';
import { companiesRouter } from './routes/companies.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;

app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true, name: 'ShopFil API' }));
app.use('/api/shops', shopsRouter);
app.use('/api', auditsRouter);
app.use('/api/criteria', criteriaRouter);
app.use('/api/research', researchRouter);
app.use('/api/companies', companiesRouter);

// Im Produktivbetrieb (z. B. Docker-Image fuer Render) liegt das gebaute
// Web-Frontend unter server/public und wird direkt vom API-Server mitgeliefert -
// spart einen zweiten Service und CORS-Konfiguration. Im lokalen Dev-Setup
// (zwei separate `npm run dev:*`-Prozesse) existiert dieser Ordner nicht,
// die Bloecke greifen dann einfach nicht.
const STATIC_DIR = process.env.STATIC_DIR || path.resolve(__dirname, '../public');
if (fs.existsSync(STATIC_DIR)) {
  app.use(express.static(STATIC_DIR));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(STATIC_DIR, 'index.html'));
  });
}

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Interner Serverfehler.' });
});

app.listen(PORT, () => {
  console.log(`ShopFil API laeuft auf http://localhost:${PORT}`);
});
