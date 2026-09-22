import crypto from 'node:crypto';
import { Router, type NextFunction, type Request, type Response } from 'express';
import { db, sha256, type ShopRow } from '../db/index.js';
import { hashPassword, passwordProblem, verifyPassword } from './passwords.js';

export interface AuthUser {
  id: number;
  orgId: number;
  email: string;
  name: string;
  role: string;
  orgName: string;
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthUser;
  }
}

export const SESSION_COOKIE = 'sp_session';
const SESSION_DAYS = 7;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (header ?? '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function cookieFlags(req: Request, maxAgeSec: number) {
  const secure = process.env.SHOPPULSE_COOKIE_SECURE === '1' || req.secure;
  // SameSite=Strict: der Browser sendet das Cookie nie bei Anfragen, die von fremden Seiten ausgeloest werden
  return `Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAgeSec}${secure ? '; Secure' : ''}`;
}

function createSession(req: Request, res: Response, userId: number) {
  const token = crypto.randomBytes(32).toString('base64url');
  db.prepare(`INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, datetime('now', ?))`).run(
    sha256(token),
    userId,
    `+${SESSION_DAYS} days`,
  );
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=${token}; ${cookieFlags(req, SESSION_DAYS * 86400)}`);
}

/** Liest die Session aus dem Cookie (ohne Fehler, wenn keine vorhanden ist). */
export function userFromRequest(req: Request): AuthUser | undefined {
  const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
  if (!token) return undefined;
  const row = db
    .prepare(
      `SELECT u.id, u.org_id as orgId, u.email, u.name, u.role, o.name as orgName
       FROM sessions s JOIN users u ON u.id = s.user_id JOIN organizations o ON o.id = u.org_id
       WHERE s.token_hash = ? AND s.expires_at > datetime('now')`,
    )
    .get(sha256(token)) as AuthUser | undefined;
  return row;
}

/** Alle Dashboard-Endpunkte: ohne gueltige Session 401. */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const user = userFromRequest(req);
  if (!user) return res.status(401).json({ error: 'Bitte anmelden.' });
  req.user = user;
  next();
}

/**
 * Schutz vor Cross-Site-Request-Forgery (zusaetzlich zu SameSite=Strict): schreibende Anfragen
 * muessen einen eigenen Header tragen. Fremde Webseiten koennen ihn nicht setzen, ohne dass der
 * Browser vorher per CORS-Preflight um Erlaubnis fragt – und die wird nicht erteilt.
 */
export function requireCsrfHeader(req: Request, res: Response, next: NextFunction) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (req.headers['x-requested-with'] !== 'ShopPulse') {
    return res.status(403).json({ error: 'Anfrage abgelehnt (fehlender X-Requested-With-Header).' });
  }
  next();
}

// ---------------------------------------------------------------------------
// Mandanten-Pruefung – EINZIGER Weg, wie Routen an Shop-Daten kommen
// ---------------------------------------------------------------------------

/** Shop nur, wenn er zur Organisation der angemeldeten Person gehoert – sonst undefined (-> 404). */
export function ownedShop(req: Request, shopId: unknown): ShopRow | undefined {
  if (!req.user) return undefined;
  return db.prepare('SELECT * FROM shops WHERE id = ? AND org_id = ?').get(Number(shopId), req.user.orgId) as ShopRow | undefined;
}

export function ownsShop(req: Request, shopId: number): boolean {
  return !!ownedShop(req, shopId);
}

// ---------------------------------------------------------------------------
// Brute-Force-Bremse fuer Login/Registrierung (pro IP und pro E-Mail)
// ---------------------------------------------------------------------------

const attempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = Number(process.env.SHOPPULSE_LOGIN_MAX_ATTEMPTS ?? 10);
const WINDOW_MS = 15 * 60 * 1000;

function tooMany(key: string): boolean {
  const now = Date.now();
  const a = attempts.get(key);
  if (!a || a.resetAt < now) return false;
  return a.count >= MAX_ATTEMPTS;
}
function fail(key: string) {
  const now = Date.now();
  const a = attempts.get(key);
  if (!a || a.resetAt < now) attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
  else a.count += 1;
}

// ---------------------------------------------------------------------------
// Routen
// ---------------------------------------------------------------------------

export const authRouter = Router();

authRouter.post('/register', async (req, res) => {
  const ipKey = `ip:${req.ip}`;
  if (tooMany(ipKey)) return res.status(429).json({ error: 'Zu viele Versuche. Bitte später erneut versuchen.' });
  const { email, password, name, organization } = req.body ?? {};
  if (typeof email !== 'string' || !EMAIL_RE.test(email) || email.length > 200) {
    return res.status(400).json({ error: 'Bitte eine gültige E-Mail-Adresse angeben.' });
  }
  const problem = passwordProblem(password);
  if (problem) return res.status(400).json({ error: problem });
  if (typeof organization !== 'string' || !organization.trim()) {
    return res.status(400).json({ error: 'Bitte den Namen Ihres Unternehmens angeben.' });
  }
  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email.trim())) {
    fail(ipKey);
    return res.status(409).json({ error: 'Für diese E-Mail-Adresse existiert bereits ein Konto.' });
  }
  const hash = await hashPassword(password);
  const userId = db.transaction(() => {
    const orgId = Number(db.prepare('INSERT INTO organizations (name) VALUES (?)').run(organization.trim().slice(0, 120)).lastInsertRowid);
    return Number(
      db
        .prepare(`INSERT INTO users (org_id, email, name, password_hash, role) VALUES (?, ?, ?, ?, 'owner')`)
        .run(orgId, email.trim(), typeof name === 'string' && name.trim() ? name.trim().slice(0, 120) : email.trim(), hash)
        .lastInsertRowid,
    );
  })();
  createSession(req, res, userId);
  res.status(201).json({ ok: true });
});

authRouter.post('/login', async (req, res) => {
  const { email, password } = req.body ?? {};
  const ipKey = `ip:${req.ip}`;
  const mailKey = `mail:${String(email ?? '').toLowerCase()}`;
  if (tooMany(ipKey) || tooMany(mailKey)) {
    return res.status(429).json({ error: 'Zu viele Fehlversuche. Bitte in 15 Minuten erneut versuchen.' });
  }
  const user = db.prepare('SELECT id, password_hash FROM users WHERE email = ?').get(String(email ?? '').trim()) as
    | { id: number; password_hash: string }
    | undefined;
  // Auch bei unbekannter E-Mail einen Hash pruefen, damit die Antwortzeit nichts verraet
  const ok = await verifyPassword(String(password ?? ''), user?.password_hash ?? DUMMY_HASH);
  if (!user || !ok) {
    fail(ipKey);
    fail(mailKey);
    return res.status(401).json({ error: 'E-Mail oder Passwort ist falsch.' });
  }
  attempts.delete(mailKey);
  createSession(req, res, user.id);
  res.json({ ok: true });
});

authRouter.post('/logout', (req, res) => {
  const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
  if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha256(token));
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; ${cookieFlags(req, 0)}`);
  res.json({ ok: true });
});

authRouter.get('/me', (req, res) => {
  const user = userFromRequest(req);
  if (!user) return res.status(401).json({ error: 'Nicht angemeldet.' });
  res.json(user);
});

// Konstanter Dummy-Hash (Passwort unbekannt) fuer gleichmaessige Antwortzeiten
let DUMMY_HASH = 'scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$' + Buffer.alloc(64).toString('base64');
void hashPassword(crypto.randomBytes(16).toString('hex')).then((h) => (DUMMY_HASH = h));

/** Abgelaufene Sessions regelmaessig entfernen. */
export function cleanupSessions() {
  db.prepare(`DELETE FROM sessions WHERE expires_at <= datetime('now')`).run();
}
