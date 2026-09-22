import dns from 'node:dns/promises';
import net from 'node:net';
import type { FetchLike } from '../inventory/types.js';

/**
 * Schutz vor Server-Side Request Forgery: Abrufe zu Fremdsystemen duerfen nur oeffentliche
 * Adressen erreichen – keine internen Netze, keinen localhost, keine Cloud-Metadaten-Dienste.
 * Geprueft wird vor JEDEM Request (auch nach Weiterleitungen), nach DNS-Aufloesung.
 */

const MAX_REDIRECTS = 3;
const TIMEOUT_MS = Number(process.env.SHOPPULSE_OUTBOUND_TIMEOUT_MS ?? 30_000);
const MAX_BYTES = Number(process.env.SHOPPULSE_OUTBOUND_MAX_BYTES ?? 20 * 1024 * 1024);

export class OutboundBlockedError extends Error {}

function ipv4Private(ip: string): boolean {
  const [a, b] = ip.split('.').map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) || // Carrier-grade NAT
    (a === 169 && b === 254) || // Link-local inkl. Cloud-Metadaten 169.254.169.254
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224 // Multicast/reserviert
  );
}

export function isPrivateAddress(ip: string): boolean {
  if (net.isIPv4(ip)) return ipv4Private(ip);
  if (net.isIPv6(ip)) {
    const v = ip.toLowerCase();
    if (v === '::' || v === '::1') return true;
    const mapped = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return ipv4Private(mapped[1]);
    if (/^::ffff:[0-9a-f]+:[0-9a-f]+$/.test(v)) return true; // hex-notierte IPv4-Mapped-Adressen: vorsichtshalber sperren
    return /^(fc|fd|fe8|fe9|fea|feb|ff)/.test(v);
  }
  return true; // unbekanntes Format: sperren
}

export interface OutboundPolicy {
  /** Ausnahme nur fuer server-eigene Demo-Feeds (siehe inventory/sync.ts) */
  allowPrivate?: boolean;
}

/** Wirft OutboundBlockedError, wenn die URL nicht erlaubt ist. */
export async function assertPublicUrl(rawUrl: string, policy: OutboundPolicy = {}): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new OutboundBlockedError('Ungültige URL.');
  }
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && policy.allowPrivate)) {
    throw new OutboundBlockedError('Nur HTTPS-Adressen sind erlaubt.');
  }
  if (url.username || url.password) throw new OutboundBlockedError('Zugangsdaten in der URL sind nicht erlaubt.');
  if (policy.allowPrivate) return url;

  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) {
    throw new OutboundBlockedError('Interne Adressen sind nicht erlaubt.');
  }
  const addresses = net.isIP(host) ? [host] : (await dns.lookup(host, { all: true, verbatim: true })).map((a) => a.address);
  if (!addresses.length || addresses.some(isPrivateAddress)) {
    throw new OutboundBlockedError('Die Adresse zeigt auf ein internes Netz und ist nicht erlaubt.');
  }
  return url;
}

/**
 * fetch-Ersatz fuer alle Connectoren: prueft Ziel und jede Weiterleitung, bricht nach Timeout ab
 * und begrenzt die Antwortgroesse.
 */
export function guardedFetch(policy: OutboundPolicy = {}, baseFetch: FetchLike = fetch): FetchLike {
  return async (input, init = {}) => {
    let url = String(input);
    let currentInit: RequestInit = { ...init };
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      await assertPublicUrl(url, policy);
      const res = await baseFetch(url, { ...currentInit, redirect: 'manual', signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
        const next = new URL(res.headers.get('location')!, url);
        // Zugangsdaten nie an einen anderen Host weiterreichen
        if (next.host !== new URL(url).host) {
          const headers = new Headers(currentInit.headers);
          headers.delete('authorization');
          headers.delete('x-shopify-access-token');
          currentInit = { ...currentInit, headers };
        }
        if (res.status === 303) currentInit = { ...currentInit, method: 'GET', body: undefined };
        url = next.toString();
        continue;
      }
      return limitBody(res);
    }
    throw new OutboundBlockedError('Zu viele Weiterleitungen.');
  };
}

async function limitBody(res: Response): Promise<Response> {
  const declared = Number(res.headers.get('content-length') ?? 0);
  if (declared > MAX_BYTES) throw new OutboundBlockedError(`Antwort zu groß (> ${Math.round(MAX_BYTES / 1_048_576)} MB).`);
  if (!res.body) return res;
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BYTES) {
      await reader.cancel();
      throw new OutboundBlockedError(`Antwort zu groß (> ${Math.round(MAX_BYTES / 1_048_576)} MB).`);
    }
    chunks.push(value);
  }
  return new Response(Buffer.concat(chunks), { status: res.status, statusText: res.statusText, headers: res.headers });
}
