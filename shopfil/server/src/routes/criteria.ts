import { Router } from 'express';
import { db } from '../db/index.js';

export const criteriaRouter = Router();

criteriaRouter.get('/', (_req, res) => {
  const criteria = db.prepare('SELECT * FROM criteria ORDER BY category, weight DESC').all();
  res.json(criteria);
});
