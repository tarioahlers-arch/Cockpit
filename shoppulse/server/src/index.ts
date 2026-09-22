import { isProduction, validateProductionConfig } from './config.js';

// Im Produktivbetrieb nur mit vollstaendiger, sicherer Konfiguration starten
if (isProduction) {
  const problems = validateProductionConfig();
  if (problems.length) {
    console.error('ShopPulse startet nicht – Konfiguration unvollständig:\n' + problems.map((p) => `  • ${p}`).join('\n'));
    process.exit(1);
  }
}

const { createApp } = await import('./app.js');
const { cleanupAuth } = await import('./auth/index.js');
const { startInventoryScheduler } = await import('./inventory/sync.js');
const { startAutopilotScheduler } = await import('./autopilot/engine.js');

const PORT = process.env.PORT ? Number(process.env.PORT) : 4100;
const app = createApp();

if (process.env.SHOPPULSE_DISABLE_SCHEDULER !== '1') {
  startInventoryScheduler();
  startAutopilotScheduler();
}
cleanupAuth();
setInterval(cleanupAuth, 60 * 60 * 1000).unref();

app.listen(PORT, () => {
  console.log(`ShopPulse API läuft auf http://localhost:${PORT}${isProduction ? ' (Produktivmodus)' : ''}`);
});
