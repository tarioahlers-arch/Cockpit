// Hoefliches Fetch-Utility fuer alle Recherche-Connectors:
// - prueft robots.txt der Zieldomain und verweigert Anfragen auf gesperrte Pfade
// - haelt einen Mindestabstand zwischen Anfragen an denselben Host ein
// Rechtlicher Hinweis (wie im Auftrag gefordert): das ersetzt keine manuelle
// Pruefung der Nutzungsbedingungen jeder Quelle vor echtem Produktivbetrieb -
// es verhindert nur versehentliches, zu aggressives oder robots.txt-widriges
// Abfragen innerhalb dieses Tools.

const MIN_DELAY_MS = Number(process.env.RESEARCH_MIN_DELAY_MS ?? 1500);
const REQUEST_TIMEOUT_MS = 15000;
const RESEARCH_USER_AGENT = 'ShopFil-Recherchebot/1.0 (+digitales Prospecting-Cockpit; hoeflich, respektiert robots.txt)';

export class RobotsDisallowedError extends Error {
  constructor(url: string) {
    super(`robots.txt untersagt den Zugriff auf ${url}`);
    this.name = 'RobotsDisallowedError';
  }
}

interface RobotsRules {
  disallow: string[];
  allow: string[];
  crawlDelayMs: number | null;
}

const robotsCache = new Map<string, { rules: RobotsRules; fetchedAt: number }>();
const lastRequestAtByHost = new Map<string, number>();
const ROBOTS_CACHE_TTL_MS = 60 * 60 * 1000;

function parseRobotsTxt(text: string): RobotsRules {
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  let relevant = false;
  let sawAnyUserAgent = false;
  const disallow: string[] = [];
  const allow: string[] = [];
  let crawlDelayMs: number | null = null;

  for (const rawLine of lines) {
    const line = rawLine.split('#')[0].trim();
    if (!line) continue;
    const [rawKey, ...rest] = line.split(':');
    if (!rawKey || rest.length === 0) continue;
    const key = rawKey.trim().toLowerCase();
    const value = rest.join(':').trim();

    if (key === 'user-agent') {
      sawAnyUserAgent = true;
      relevant = value === '*';
    } else if (relevant && key === 'disallow' && value) {
      disallow.push(value);
    } else if (relevant && key === 'allow' && value) {
      allow.push(value);
    } else if (relevant && key === 'crawl-delay') {
      const seconds = Number(value);
      if (!Number.isNaN(seconds)) crawlDelayMs = seconds * 1000;
    }
  }
  if (!sawAnyUserAgent) return { disallow: [], allow: [], crawlDelayMs: null };
  return { disallow, allow, crawlDelayMs };
}

async function getRobotsRules(origin: string): Promise<RobotsRules> {
  const cached = robotsCache.get(origin);
  if (cached && Date.now() - cached.fetchedAt < ROBOTS_CACHE_TTL_MS) {
    return cached.rules;
  }
  let rules: RobotsRules = { disallow: [], allow: [], crawlDelayMs: null };
  try {
    const res = await fetch(`${origin}/robots.txt`, {
      headers: { 'User-Agent': RESEARCH_USER_AGENT },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (res.ok) {
      rules = parseRobotsTxt(await res.text());
    }
    // Kein robots.txt oder Fehler beim Abruf -> konservativ als "keine expliziten
    // Einschraenkungen bekannt" behandeln, statt den ganzen Connector zu blockieren.
  } catch {
    // Netzwerkfehler beim robots.txt-Abruf: gleiche konservative Behandlung.
  }
  robotsCache.set(origin, { rules, fetchedAt: Date.now() });
  return rules;
}

function isPathAllowed(rules: RobotsRules, path: string): boolean {
  const matchingDisallow = rules.disallow
    .filter((rule) => path.startsWith(rule))
    .sort((a, b) => b.length - a.length)[0];
  if (!matchingDisallow) return true;

  const matchingAllow = rules.allow
    .filter((rule) => path.startsWith(rule))
    .sort((a, b) => b.length - a.length)[0];
  if (matchingAllow && matchingAllow.length >= matchingDisallow.length) return true;

  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fuehrt einen GET-Request aus, nachdem robots.txt der Zieldomain geprueft und
 * ein Mindestabstand zu vorherigen Anfragen an denselben Host eingehalten wurde.
 * Wirft RobotsDisallowedError, wenn robots.txt den Pfad sperrt - Aufrufer sollten
 * das als 'robots_disallow' loggen und die Quelle fuer diesen Pfad ueberspringen.
 */
export async function politeFetch(url: string): Promise<Response> {
  const parsed = new URL(url);
  const origin = parsed.origin;
  const host = parsed.host;

  const rules = await getRobotsRules(origin);
  if (!isPathAllowed(rules, parsed.pathname)) {
    throw new RobotsDisallowedError(url);
  }

  const minDelay = Math.max(MIN_DELAY_MS, rules.crawlDelayMs ?? 0);
  const lastRequestAt = lastRequestAtByHost.get(host) ?? 0;
  const waitFor = lastRequestAt + minDelay - Date.now();
  if (waitFor > 0) await sleep(waitFor);
  lastRequestAtByHost.set(host, Date.now());

  return fetch(url, {
    headers: { 'User-Agent': RESEARCH_USER_AGENT },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
}
