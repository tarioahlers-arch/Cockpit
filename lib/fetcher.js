const FETCH_TIMEOUT_MS = 12000;
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36 CockpitAuditBot/1.0";

export function normalizeUrl(raw) {
  if (!raw) return null;
  let value = raw.trim();
  if (!value) return null;
  if (!/^https?:\/\//i.test(value)) value = `https://${value}`;
  try {
    const parsed = new URL(value);
    return parsed.toString();
  } catch {
    return null;
  }
}

export async function fetchPage(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  const start = Date.now();
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent": USER_AGENT,
        "Accept-Language": "de-DE,de;q=0.9,en;q=0.8",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });
    const loadTimeMs = Date.now() - start;
    const html = await res.text();
    return {
      url,
      finalUrl: res.url || url,
      status: res.status,
      ok: res.ok && html.length > 0,
      html,
      loadTimeMs,
      sizeBytes: Buffer.byteLength(html, "utf8"),
      error: res.ok ? null : `HTTP ${res.status}`,
    };
  } catch (err) {
    return {
      url,
      finalUrl: url,
      status: 0,
      ok: false,
      html: "",
      loadTimeMs: Date.now() - start,
      sizeBytes: 0,
      error:
        err.name === "AbortError"
          ? "Zeitüberschreitung beim Laden der Seite"
          : err.message || "Unbekannter Fehler beim Abruf",
    };
  } finally {
    clearTimeout(timer);
  }
}
