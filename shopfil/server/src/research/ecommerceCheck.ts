import type { Browser } from 'playwright';
import { AUDITBOT_USER_AGENT, isProxied } from '../browser.js';

// Heuristik fuer die E-Commerce-Vorpruefung (Punkt 4 im Auftrag): eine
// Visitenkarten-Website hat i. d. R. keine dieser Begriffe/Pfade, ein echter
// Online-Shop mit Checkout schon.
const SHOP_PATTERNS: RegExp[] = [
  /warenkorb/i,
  /in den warenkorb/i,
  /zur kasse/i,
  /checkout/i,
  /jetzt kaufen/i,
  /add to cart/i,
  /href="[^"]*\/(warenkorb|cart|checkout)/i,
];

export interface EcommerceCheckResult {
  hasShop: boolean;
  detail: string;
}

export async function checkHasOnlineShop(browser: Browser, url: string): Promise<EcommerceCheckResult> {
  const context = await browser.newContext({ userAgent: AUDITBOT_USER_AGENT, ignoreHTTPSErrors: isProxied() });
  try {
    const page = await context.newPage();
    await page.goto(url, { waitUntil: 'load', timeout: 15000 });
    const html = await page.content();
    const matched = SHOP_PATTERNS.find((p) => p.test(html));
    if (matched) {
      return { hasShop: true, detail: `Shop-Hinweis gefunden (Muster: ${matched}).` };
    }
    return { hasShop: false, detail: 'Keine Warenkorb-/Checkout-Hinweise auf der Startseite gefunden.' };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler';
    return { hasShop: false, detail: `Seite nicht erreichbar oder Timeout: ${message}` };
  } finally {
    await context.close();
  }
}
