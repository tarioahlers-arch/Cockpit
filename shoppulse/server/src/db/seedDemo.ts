import { createDemoShop } from './demoData.js';

const shop = createDemoShop();
console.log(`Demo-Shop angelegt: #${shop.id} "${shop.name}" (Key ${shop.public_key})`);
