#!/usr/bin/env node
// Prüft alle Karriereseiten-Links aus supabase/data/career-companies.json auf Erreichbarkeit.
// Aufruf: node scripts/check-career-urls.mjs   (Node >= 20, Internetzugang nötig)
// Exit-Code 1, wenn Links kaputt sind (404/410/5xx/DNS). 401/403/429 gelten als Warnung,
// weil viele Karriereseiten automatisierte Anfragen blockieren.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const companies = JSON.parse(readFileSync(join(root, 'supabase/data/career-companies.json'), 'utf8'));
const CONCURRENCY = 8;
const TIMEOUT_MS = 20_000;

async function check({ name, careers_url: url }) {
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { 'user-agent': 'Mozilla/5.0 (JobCockpit link check)', accept: 'text/html' },
    });
    const level = res.ok ? 'ok' : [401, 403, 429].includes(res.status) ? 'warn' : 'fail';
    return { name, url, level, detail: `${res.status}${res.redirected ? ` -> ${res.url}` : ''}` };
  } catch (err) {
    return { name, url, level: 'fail', detail: err.cause?.code ?? err.name };
  }
}

const results = [];
for (let i = 0; i < companies.length; i += CONCURRENCY) {
  results.push(...(await Promise.all(companies.slice(i, i + CONCURRENCY).map(check))));
}

for (const level of ['fail', 'warn']) {
  for (const r of results.filter((x) => x.level === level)) {
    console.log(`${level.toUpperCase().padEnd(4)} ${r.name.padEnd(32)} ${r.detail}  ${r.url}`);
  }
}
const count = (l) => results.filter((r) => r.level === l).length;
console.log(`\n${count('ok')} ok, ${count('warn')} Warnungen, ${count('fail')} Fehler (${results.length} geprüft)`);
process.exit(count('fail') > 0 ? 1 : 0);
