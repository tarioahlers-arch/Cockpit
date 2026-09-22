import { db } from './index.js';

/**
 * Migration aus der Zeit vor der Mandantentrennung: Shops ohne Organisation sind fuer niemanden
 * sichtbar. Dieses Skript ordnet sie bewusst und explizit einer Organisation zu.
 * Verwendung: npm run assign-shops -- <E-Mail> [Shop-ID ...]   (ohne IDs: alle Shops ohne Organisation)
 */
const [email, ...ids] = process.argv.slice(2);
const user = email ? (db.prepare('SELECT org_id FROM users WHERE email = ?').get(email) as { org_id: number } | undefined) : undefined;
if (!user) {
  console.error('Verwendung: npm run assign-shops -- <E-Mail eines Kontos> [Shop-ID ...]');
  process.exit(1);
}
const orphans = db.prepare('SELECT id, name FROM shops WHERE org_id IS NULL').all() as { id: number; name: string }[];
const selected = ids.length ? orphans.filter((s) => ids.includes(String(s.id))) : orphans;
const upd = db.prepare('UPDATE shops SET org_id = ? WHERE id = ? AND org_id IS NULL');
for (const s of selected) upd.run(user.org_id, s.id);
console.log(selected.length ? `Zugeordnet: ${selected.map((s) => `#${s.id} ${s.name}`).join(', ')}` : 'Keine Shops ohne Organisation gefunden.');
