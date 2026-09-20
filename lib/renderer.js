// Rendert Shop-Seiten in einem echten Browser, damit auch Inhalte erfasst
// werden, die erst per JavaScript nachgeladen werden (Bewertungs-Widgets,
// Trust-Siegel, Countdown-Banner). Ohne das meldet der reine HTML-Abruf bei
// modernen Shops Lücken, die es gar nicht gibt.
//
// Playwright ist bewusst KEINE feste Abhängigkeit: Ist es nicht installiert
// oder lässt sich kein Browser starten, schaltet sich das Modul ab und der
// Aufrufer nutzt weiter den einfachen HTML-Abruf.

const NAV_TIMEOUT_MS = 20000;
const SETTLE_TIMEOUT_MS = 3000;
const IDLE_SHUTDOWN_MS = 120000;

// Bilder, Videos und Schriften kosten Zeit und Arbeitsspeicher, ohne die
// Prüfungen zu beeinflussen: Die Tags stehen auch dann im DOM, wenn die
// Datei selbst nie geladen wird.
const BLOCKED_RESOURCES = new Set(["image", "media", "font"]);

let playwrightModule = null;
let browserPromise = null;
let idleTimer = null;
let unavailableReason = null;

async function loadPlaywright() {
  if (playwrightModule) return playwrightModule;
  if (unavailableReason) return null;
  try {
    playwrightModule = await import("playwright");
    return playwrightModule;
  } catch {
    unavailableReason = "Playwright ist nicht installiert";
    return null;
  }
}

async function getBrowser() {
  const pw = await loadPlaywright();
  if (!pw) return null;

  if (!browserPromise) {
    browserPromise = pw.chromium
      .launch({
        args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
      })
      .catch((err) => {
        // Kein Browser-Binary oder zu wenig Speicher: dauerhaft abschalten,
        // statt bei jeder Analyse erneut in denselben Fehler zu laufen.
        unavailableReason = err.message || "Browser konnte nicht gestartet werden";
        browserPromise = null;
        return null;
      });
  }
  return browserPromise;
}

function scheduleIdleShutdown() {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    closeBrowser();
  }, IDLE_SHUTDOWN_MS);
  idleTimer.unref?.();
}

export async function closeBrowser() {
  const pending = browserPromise;
  browserPromise = null;
  clearTimeout(idleTimer);
  if (!pending) return;
  try {
    const browser = await pending;
    await browser?.close();
  } catch {
    // Schließen darf die Analyse nie stören.
  }
}

export async function isRenderingAvailable() {
  const browser = await getBrowser();
  return Boolean(browser);
}

export function renderingUnavailableReason() {
  return unavailableReason;
}

export async function renderPage(url, userAgent) {
  const browser = await getBrowser();
  if (!browser) return null;

  const start = Date.now();
  let context;
  try {
    context = await browser.newContext({
      userAgent,
      locale: "de-DE",
      viewport: { width: 1280, height: 900 },
    });
    const page = await context.newPage();

    await page.route("**/*", (route) => {
      if (BLOCKED_RESOURCES.has(route.request().resourceType())) route.abort();
      else route.continue();
    });

    const response = await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: NAV_TIMEOUT_MS,
    });

    // Kurz nachlaufen lassen, damit nachgeladene Widgets im DOM ankommen.
    // Bleibt das Netz dauerhaft aktiv (Tracking, Polling), wird nicht länger
    // gewartet als SETTLE_TIMEOUT_MS.
    await page.waitForLoadState("networkidle", { timeout: SETTLE_TIMEOUT_MS }).catch(() => {});

    const html = await page.content();
    const loadTimeMs = Date.now() - start;

    return {
      html,
      status: response ? response.status() : 0,
      finalUrl: page.url(),
      loadTimeMs,
    };
  } catch (err) {
    return { error: err.message || "Rendern fehlgeschlagen", loadTimeMs: Date.now() - start };
  } finally {
    await context?.close().catch(() => {});
    scheduleIdleShutdown();
  }
}
