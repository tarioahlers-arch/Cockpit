import { launchBrowser, isProxied, AUDITBOT_USER_AGENT } from '../browser.js';
import {
  CHAT_PATTERNS,
  CONTACT_PATTERNS,
  RETURN_PATTERNS,
  PRICE_ANCHOR_PATTERNS,
  SCARCITY_PATTERNS,
  SOCIAL_PROOF_PATTERNS,
  COUNTDOWN_PATTERNS,
  PERSONALIZATION_PATTERNS,
  EXIT_INTENT_PATTERNS,
  TRUST_SEAL_PATTERNS,
  COOKIE_PATTERNS,
} from './patterns.js';

export interface ScanResult {
  score: number;
  passed: boolean;
  detail: string;
}

function detectPattern(html: string, patterns: RegExp[]): ScanResult {
  const matched = patterns.find((p) => p.test(html));
  return {
    score: matched ? 100 : 0,
    passed: !!matched,
    detail: matched ? `Automatisch erkannt (Muster: ${matched})` : 'Kein Hinweis im HTML gefunden - manuell pruefen.',
  };
}

function scoreLoadTime(ms: number): ScanResult {
  let score: number;
  if (ms < 2000) score = 100;
  else if (ms < 3500) score = 70;
  else if (ms < 6000) score = 40;
  else score = 10;
  return { score, passed: score >= 70, detail: `Ladezeit: ${ms} ms` };
}

/**
 * Fuehrt die automatisierten ShopFil-Checks gegen eine Shop-URL (und optional
 * eine Produktseite) aus. Wirft bei nicht erreichbarer Startseite, damit der
 * Aufrufer den Audit-Run als 'failed' markieren kann.
 */
export async function runAutomatedScan(
  shopUrl: string,
  productUrl?: string | null,
): Promise<Record<string, ScanResult>> {
  const browser = await launchBrowser();

  try {
    const context = await browser.newContext({
      userAgent: AUDITBOT_USER_AGENT,
      viewport: { width: 1366, height: 900 },
      ignoreHTTPSErrors: isProxied(),
    });
    const page = await context.newPage();

    const start = Date.now();
    await page.goto(shopUrl, { waitUntil: 'load', timeout: 25000 });
    const loadTime = Date.now() - start;

    const finalUrl = page.url();
    const homeHtml = await page.content();
    const viewport = await page.$('meta[name="viewport"]');

    let combinedHtml = homeHtml;
    if (productUrl) {
      try {
        await page.goto(productUrl, { waitUntil: 'load', timeout: 25000 });
        combinedHtml += '\n' + (await page.content());
      } catch {
        // Produktseite optional - Fehler hier blockiert den restlichen Audit nicht.
      }
    }
    const html = combinedHtml.toLowerCase();

    const results: Record<string, ScanResult> = {
      https_sicherheit: {
        score: finalUrl.startsWith('https://') ? 100 : 0,
        passed: finalUrl.startsWith('https://'),
        detail: `Finale URL nach Aufruf: ${finalUrl}`,
      },
      mobile_optimierung: {
        score: viewport ? 100 : 0,
        passed: !!viewport,
        detail: viewport ? 'Viewport-Meta-Tag gefunden.' : 'Kein Viewport-Meta-Tag gefunden.',
      },
      ladezeit: scoreLoadTime(loadTime),
      live_chat_support: detectPattern(html, CHAT_PATTERNS),
      kontakt_erreichbarkeit: detectPattern(html, CONTACT_PATTERNS),
      retouren_klarheit: detectPattern(html, RETURN_PATTERNS),
      preisanker: detectPattern(html, PRICE_ANCHOR_PATTERNS),
      knappheitssignale: detectPattern(html, SCARCITY_PATTERNS),
      social_proof: detectPattern(html, SOCIAL_PROOF_PATTERNS),
      dringlichkeit_countdown: detectPattern(html, COUNTDOWN_PATTERNS),
      personalisierung: detectPattern(html, PERSONALIZATION_PATTERNS),
      exit_intent_bindung: detectPattern(html, EXIT_INTENT_PATTERNS),
      trust_siegel: detectPattern(html, TRUST_SEAL_PATTERNS),
      cookie_datenschutz: detectPattern(html, COOKIE_PATTERNS),
    };

    return results;
  } finally {
    await browser.close();
  }
}
