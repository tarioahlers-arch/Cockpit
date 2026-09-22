import { createApp } from './app.js';
import { cleanupSessions } from './auth/index.js';
import { startInventoryScheduler } from './inventory/sync.js';

const PORT = process.env.PORT ? Number(process.env.PORT) : 4100;
const app = createApp();

if (process.env.SHOPPULSE_DISABLE_SCHEDULER !== '1') startInventoryScheduler();
setInterval(cleanupSessions, 60 * 60 * 1000).unref();

app.listen(PORT, () => {
  console.log(`ShopPulse API läuft auf http://localhost:${PORT}`);
});
