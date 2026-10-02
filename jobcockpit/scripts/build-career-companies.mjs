#!/usr/bin/env node
// Erzeugt die Daten-Migration für das Karriereseiten-Verzeichnis aus
// supabase/data/career-companies.json. Aufruf: node scripts/build-career-companies.mjs
//
// Neue Firmen: JSON ergänzen, Skript ausführen, neue Migration committen.
// Bestehende Migrationen nach dem Deployment nie ändern – das Skript legt
// bei Bedarf mit --new eine neue, datierte Migration an.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const companies = JSON.parse(readFileSync(join(root, 'supabase/data/career-companies.json'), 'utf8'));

const COUNTRIES = new Set(['DE', 'AT', 'CH']);
const seen = new Set();
for (const c of companies) {
  if (!c.name || !c.category || !c.careers_url) throw new Error(`Unvollständig: ${JSON.stringify(c)}`);
  if (!c.careers_url.startsWith('https://')) throw new Error(`Kein https: ${c.name}`);
  if (!COUNTRIES.has(c.country)) throw new Error(`Ungültiges Land: ${c.name}`);
  if (seen.has(c.name)) throw new Error(`Doppelt: ${c.name}`);
  seen.add(c.name);
}

const q = (v) => (v == null ? 'null' : `'${String(v).replaceAll("'", "''")}'`);
const values = companies
  .map((c) => `  (${q(c.name)}, ${q(c.category)}, ${q(c.careers_url)}, ${q(c.headquarters)}, ${q(c.country)})`)
  .join(',\n');

const sql = `-- GENERIERT von scripts/build-career-companies.mjs – nicht von Hand bearbeiten.
-- Quelle: supabase/data/career-companies.json (${companies.length} Firmen)
insert into public.career_companies (name, category, careers_url, headquarters, country) values
${values}
on conflict (name) do update set
  category = excluded.category,
  careers_url = excluded.careers_url,
  headquarters = excluded.headquarters,
  country = excluded.country,
  updated_at = now();
`;

const stamp = process.argv.includes('--new')
  ? new Date().toISOString().replace(/\D/g, '').slice(0, 14)
  : '20261002000100';
const file = join(root, `supabase/migrations/${stamp}_career_companies_data.sql`);
writeFileSync(file, sql);
console.log(`${companies.length} Firmen -> ${file}`);
