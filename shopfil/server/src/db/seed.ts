import { db } from './index.js';

const count = db.prepare('SELECT COUNT(*) as n FROM criteria').get() as { n: number };
console.log(`ShopFil: ${count.n} Kriterien in der Datenbank.`);
