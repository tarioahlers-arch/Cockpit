import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import './db/index.js';
import { shopsRouter } from './routes/shops.js';
import { experimentsRouter } from './routes/experiments.js';
import { pricingRouter } from './routes/pricing.js';
import { publicRouter } from './routes/public.js';
import { demoShopRouter } from './demoShop.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 4100;

app.use(cors());
app.use(express.json({ limit: '2mb' }));
// navigator.sendBeacon sendet text/plain
app.use('/api/collect', express.text({ type: 'text/plain', limit: '64kb' }));

app.get('/snippet.js', (_req, res) => {
  res.type('application/javascript');
  res.set('Cache-Control', 'public, max-age=300');
  res.sendFile(path.join(__dirname, 'public', 'snippet.js'));
});

app.get('/api/health', (_req, res) => res.json({ ok: true, name: 'ShopPulse API' }));
app.use('/api/shops', shopsRouter);
app.use('/api', experimentsRouter);
app.use('/api', pricingRouter);
app.use('/api', publicRouter);
app.use('/demo-shop', demoShopRouter);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Interner Serverfehler.' });
});

app.listen(PORT, () => {
  console.log(`ShopPulse API läuft auf http://localhost:${PORT}`);
});
