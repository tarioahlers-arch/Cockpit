import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CRITERIA } from './criteria.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '../../data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

export const db = new Database(path.join(DATA_DIR, 'shopfil.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
db.exec(schema);

function seedCriteria() {
  const upsert = db.prepare(`
    INSERT INTO criteria (key, category, label, description, weight, automated, recommendation, source)
    VALUES (@key, @category, @label, @description, @weight, @automated, @recommendation, @source)
    ON CONFLICT(key) DO UPDATE SET
      category = excluded.category,
      label = excluded.label,
      description = excluded.description,
      weight = excluded.weight,
      automated = excluded.automated,
      recommendation = excluded.recommendation,
      source = excluded.source
  `);
  const run = db.transaction(() => {
    for (const c of CRITERIA) {
      upsert.run({ ...c, automated: c.automated ? 1 : 0 });
    }
  });
  run();
}

seedCriteria();
