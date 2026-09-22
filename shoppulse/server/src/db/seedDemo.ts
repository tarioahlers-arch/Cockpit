import { db } from './index.js';
import { createDemoShop } from './demoData.js';

// Verwendung: npm run seed:demo -- <E-Mail eines bestehenden Kontos>
const email = process.argv[2];
const user = email
  ? (db.prepare('SELECT org_id FROM users WHERE email = ?').get(email) as { org_id: number } | undefined)
  : undefined;
if (!user) {
  console.error('Bitte die E-Mail eines bestehenden Kontos angeben: npm run seed:demo -- name@firma.de');
  console.error('(Konto vorher im Dashboard registrieren – oder Demo-Shop dort per Button anlegen.)');
  process.exit(1);
}
const shop = createDemoShop(user.org_id);
console.log(`Demo-Shop angelegt: #${shop.id} "${shop.name}" für Organisation #${user.org_id}`);
