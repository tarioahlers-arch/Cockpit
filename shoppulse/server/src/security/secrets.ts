import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { config, isProduction } from '../config.js';

/**
 * Verschluesselung von Zugangsdaten (AES-256-GCM). Der Schluessel liegt ausserhalb der Datenbank
 * (Umgebungsvariable). Format: enc:v1:<key-id>:<iv>:<tag>:<ciphertext> (base64url).
 *
 * Schluesselrotation: neuen Schluessel als SHOPPULSE_SECRET_KEY setzen, alten als
 * SHOPPULSE_SECRET_KEY_PREVIOUS (kommagetrennt mehrere), dann `npm run rotate-secrets`.
 */
const PREFIX = 'enc:v1:';
const AAD = Buffer.from('shoppulse:secrets:v1');

interface Key {
  id: string;
  key: Buffer;
}

function parseKey(raw: string, name: string): Buffer {
  const v = raw.trim();
  const buf = /^[0-9a-f]{64}$/i.test(v) ? Buffer.from(v, 'hex') : Buffer.from(v, 'base64');
  if (buf.length !== 32) throw new Error(`${name} muss genau 32 Byte lang sein (64 Hex-Zeichen oder base64).`);
  return buf;
}

const keyId = (key: Buffer) => crypto.createHash('sha256').update(key).digest('hex').slice(0, 8);

function loadKeys(): { current: Key; all: Map<string, Key> } {
  let current: Buffer;
  if (process.env.SHOPPULSE_SECRET_KEY) {
    current = parseKey(process.env.SHOPPULSE_SECRET_KEY, 'SHOPPULSE_SECRET_KEY');
  } else if (isProduction) {
    throw new Error('SHOPPULSE_SECRET_KEY ist im Produktivbetrieb Pflicht.');
  } else {
    // Entwicklung: Schluesseldatei neben der Datenbank (mit Warnung) – NICHT fuer den Produktivbetrieb
    const file = path.join(config.dataDir, 'secret.key');
    if (!fs.existsSync(file)) {
      fs.mkdirSync(config.dataDir, { recursive: true });
      fs.writeFileSync(file, crypto.randomBytes(32).toString('hex'), { mode: 0o600 });
    }
    current = parseKey(fs.readFileSync(file, 'utf-8'), file);
    if (process.env.SHOPPULSE_DB !== ':memory:') {
      console.warn(`[ShopPulse] Kein SHOPPULSE_SECRET_KEY gesetzt – verwende Entwicklungsschlüssel ${file}.`);
    }
  }
  const all = new Map<string, Key>();
  const cur = { id: keyId(current), key: current };
  all.set(cur.id, cur);
  for (const raw of (process.env.SHOPPULSE_SECRET_KEY_PREVIOUS ?? '').split(',').filter((s) => s.trim())) {
    const k = parseKey(raw, 'SHOPPULSE_SECRET_KEY_PREVIOUS');
    all.set(keyId(k), { id: keyId(k), key: k });
  }
  return { current: cur, all };
}

let keys: ReturnType<typeof loadKeys> | null = null;
const getKeys = () => (keys ??= loadKeys());

export function isEncrypted(value: string): boolean {
  return value.startsWith(PREFIX);
}

export function encryptSecret(plain: string): string {
  const { current } = getKeys();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', current.key, iv);
  cipher.setAAD(AAD);
  const ct = Buffer.concat([cipher.update(plain, 'utf-8'), cipher.final()]);
  return PREFIX + [current.id, iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), ct.toString('base64url')].join(':');
}

export function decryptSecret(value: string): string {
  if (!isEncrypted(value)) return value; // Altbestand im Klartext (wird beim Start migriert)
  const [kid, iv, tag, ct] = value.slice(PREFIX.length).split(':');
  const key = getKeys().all.get(kid);
  if (!key) throw new Error(`Schlüssel ${kid} unbekannt – SHOPPULSE_SECRET_KEY_PREVIOUS prüfen.`);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key.key, Buffer.from(iv, 'base64url'));
  decipher.setAAD(AAD);
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(ct, 'base64url')), decipher.final()]).toString('utf-8');
}

/** Muss neu verschluesselt werden (Klartext oder aelterer Schluessel)? */
export function needsReencryption(value: string): boolean {
  if (!isEncrypted(value)) return true;
  return value.slice(PREFIX.length).split(':')[0] !== getKeys().current.id;
}

/** Zweckgebundener HMAC-Schluessel, abgeleitet vom aktuellen Schluessel (z. B. fuer kurzlebige Links). */
function purposeKey(purpose: string): Buffer {
  return crypto.createHmac('sha256', getKeys().current.key).update('shoppulse:' + purpose).digest();
}

/** Signiertes, zeitlich begrenztes Token: base64url(JSON).signatur */
export function signToken(purpose: string, payload: Record<string, unknown>, ttlSeconds: number): string {
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + ttlSeconds })).toString('base64url');
  const sig = crypto.createHmac('sha256', purposeKey(purpose)).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function verifyToken<T extends Record<string, unknown>>(purpose: string, token: string): T | null {
  const [body, sig] = String(token ?? '').split('.');
  if (!body || !sig) return null;
  const expected = crypto.createHmac('sha256', purposeKey(purpose)).update(body).digest();
  const given = Buffer.from(sig, 'base64url');
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf-8')) as T & { exp: number };
    return payload.exp > Date.now() / 1000 ? payload : null;
  } catch {
    return null;
  }
}
