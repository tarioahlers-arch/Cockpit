import express from 'express';
import cors from 'cors';
import './db/index.js';
import { shopsRouter } from './routes/shops.js';
import { auditsRouter } from './routes/audits.js';
import { criteriaRouter } from './routes/criteria.js';
import { researchRouter } from './routes/research.js';
import { companiesRouter } from './routes/companies.js';

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

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Interner Serverfehler.' });
});

app.listen(PORT, () => {
  console.log(`ShopFil API laeuft auf http://localhost:${PORT}`);
});
