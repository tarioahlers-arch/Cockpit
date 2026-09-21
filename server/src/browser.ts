import { chromium, type Browser } from 'playwright';
import fs from 'node:fs';

// In dieser Umgebung ist Chromium bereits unter /opt/pw-browsers vorinstalliert,
// ggf. in einer anderen Build-Nummer als von der installierten Playwright-Version
// erwartet. PLAYWRIGHT_CHROMIUM_PATH erlaubt ein explizites Override, sonst wird
// die vorinstallierte Chromium-Version automatisch gefunden.
function findPreinstalledChromium(): string | undefined {
  const base = '/opt/pw-browsers';
  if (!fs.existsSync(base)) return undefined;
  const candidate = fs
    .readdirSync(base)
    .filter((entry) => entry.startsWith('chromium-'))
    .sort()
    .reverse()
    .map((entry) => `${base}/${entry}/chrome-linux/chrome`)
    .find((p) => fs.existsSync(p));
  return candidate;
}

const CHROMIUM_EXECUTABLE = process.env.PLAYWRIGHT_CHROMIUM_PATH || findPreinstalledChromium();

/**
 * Startet einen headless Chromium-Browser fuer Scanner und Recherche-Connectors.
 * Respektiert einen ggf. gesetzten Unternehmens-/Sandbox-Proxy (HTTPS_PROXY/HTTP_PROXY).
 */
export async function launchBrowser(): Promise<Browser> {
  const proxyServer = process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy;
  const proxyBypass = process.env.NO_PROXY || process.env.no_proxy || 'localhost,127.0.0.1';

  return chromium.launch({
    headless: true,
    executablePath: CHROMIUM_EXECUTABLE || undefined,
    proxy: proxyServer ? { server: proxyServer, bypass: proxyBypass } : undefined,
  });
}

export function isProxied(): boolean {
  return !!(process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy);
}

export const AUDITBOT_USER_AGENT = 'ShopFil-Auditbot/1.0 (+digitales Testkauf-Cockpit)';
