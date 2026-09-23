import crypto from 'node:crypto';
import { Router, type NextFunction, type Request, type Response } from 'express';
import { config } from '../config.js';
import { db, sha256, type ShopRow } from '../db/index.js';
import { sendMail } from '../mail.js';
import { hashPassword, passwordProblem, verifyPassword } from './passwords.js';

export type Role = 'owner' | 'editor' | 'viewer';
export const ROLES: Role[] = ['owner', 'editor', 'viewer'];

export interface AuthUser {
  id: number;
  orgId: number;
  email: string;
  name: string;
  role: Role;
  orgName: string;
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthUser;
  }
}

export const SESSION_COOKIE = 'sp_session';
const SESSION_DAYS = 7;
const RESET_MINUTES = 60;
export const INVITE_DAYS = 7;
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (header ?? '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) {
      try {
        out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
      } catch {
        /* ungueltiges Cookie ignorieren */
      }
    }
  }
  return out;
}

function cookieFlags(req: Request, maxAgeSec: number) {
  const secure = config.cookieSecure || req.secure;
  // SameSite=Strict: der Browser sendet das Cookie nie bei Anfragen, die von fremden Seiten ausgeloest werden
  return `Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAgeSec}${secure ? '; Secure' : ''}`;
}

export function createSession(req: Request, res: Response, userId: number) {
  const token = crypto.randomBytes(32).toString('base64url');
  db.prepare(`INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, datetime('now', ?))`).run(
    sha256(token),
    userId,
    `+${SESSION_DAYS} days`,
  );
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=${token}; ${cookieFlags(req, SESSION_DAYS * 86400)}`);
}

function currentTokenHash(req: Request): string | null {
  const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
  return token ? sha256(token) : null;
}

/** Liest die Session aus dem Cookie. Rolle und Organisation kommen bei jeder Anfrage frisch aus der DB. */
export function userFromRequest(req: Request): AuthUser | undefined {
  const hash = currentTokenHash(req);
  if (!hash) return undefined;
  return db
    .prepare(
      `SELECT u.id, u.org_id as orgId, u.email, u.name, u.role, o.name as orgName
       FROM sessions s JOIN users u ON u.id = s.user_id JOIN organizations o ON o.id = u.org_id
       WHERE s.token_hash = ? AND s.expires_at > datetime('now')`,
    )
    .get(hash) as AuthUser | undefined;
}

/** Alle Dashboard-Endpunkte: ohne gueltige Session 401. */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const user = userFromRequest(req);
  if (!user) return res.status(401).json({ error: 'Bitte anmelden.' });
  req.user = user;
  next();
}

/** Lesezugriff ("viewer") darf keine Daten veraendern. */
/** Anfragen, die trotz POST nichts veraendern (Lesezugriff darf sie nutzen). */
const READ_ONLY_POSTS = [/^\/api\/shops\/\d+\/advisor$/, /^\/api\/shops\/\d+\/clicks\/heatmap-link$/];

export function enforceReadOnly(req: Request, res: Response, next: NextFunction) {
  const readOnlyPost = req.method === 'POST' && READ_ONLY_POSTS.some((re) => re.test(req.originalUrl.split('?')[0]));
  if (req.user?.role === 'viewer' && !readOnlyPost && !['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return res.status(403).json({ error: 'Ihre Rolle "Lesezugriff" erlaubt keine Änderungen.' });
  }
  next();
}

/** Nur Inhaber:innen (Teamverwaltung, Shops loeschen). */
export function requireOwner(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role !== 'owner') return res.status(403).json({ error: 'Nur Inhaber:innen der Organisation dürfen das.' });
  next();
}

/**
 * Schutz vor Cross-Site-Request-Forgery (zusaetzlich zu SameSite=Strict): schreibende Anfragen
 * muessen einen eigenen Header tragen, den fremde Webseiten ohne CORS-Freigabe nicht setzen koennen.
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
// Brute-Force-Bremse (persistiert in der Datenbank)
// ---------------------------------------------------------------------------

const MAX_ATTEMPTS = Number(process.env.SHOPPULSE_LOGIN_MAX_ATTEMPTS ?? 10);
const WINDOW_MS = 15 * 60 * 1000;

export function tooManyAttempts(key: string): boolean {
  const row = db.prepare('SELECT count, reset_at FROM auth_attempts WHERE key = ?').get(key) as
    | { count: number; reset_at: number }
    | undefined;
  return !!row && row.reset_at > Date.now() && row.count >= MAX_ATTEMPTS;
}

export function recordAttempt(key: string) {
  const now = Date.now();
  db.prepare(
    `INSERT INTO auth_attempts (key, count, reset_at) VALUES (?, 1, ?)
     ON CONFLICT(key) DO UPDATE SET
       count = CASE WHEN auth_attempts.reset_at <= ? THEN 1 ELSE auth_attempts.count + 1 END,
       reset_at = CASE WHEN auth_attempts.reset_at <= ? THEN excluded.reset_at ELSE auth_attempts.reset_at END`,
  ).run(key, now + WINDOW_MS, now, now);
}

function clearAttempts(key: string) {
  db.prepare('DELETE FROM auth_attempts WHERE key = ?').run(key);
}

// ---------------------------------------------------------------------------
// Routen (ohne Login erreichbar – jede Route prueft selbst)
// ---------------------------------------------------------------------------

export const authRouter = Router();

authRouter.post('/register', async (req, res) => {
  const ipKey = `register:${req.ip}`;
  if (tooManyAttempts(ipKey)) return res.status(429).json({ error: 'Zu viele Versuche. Bitte später erneut versuchen.' });
  const { email, password, name, organization } = req.body ?? {};
  if (typeof email !== 'string' || !EMAIL_RE.test(email) || email.length > 200) {
    return res.status(400).json({ error: 'Bitte eine gültige E-Mail-Adresse angeben.' });
  }
  const problem = passwordProblem(password);
  if (problem) return res.status(400).json({ error: problem });
  if (typeof organization !== 'string' || !organization.trim()) {
    return res.status(400).json({ error: 'Bitte den Namen Ihres Unternehmens angeben.' });
  }
  recordAttempt(ipKey); // begrenzt auch massenhaftes Anlegen von Konten
  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email.trim())) {
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
  const ipKey = `login-ip:${req.ip}`;
  const mailKey = `login-mail:${String(email ?? '').toLowerCase()}`;
  if (tooManyAttempts(ipKey) || tooManyAttempts(mailKey)) {
    return res.status(429).json({ error: 'Zu viele Fehlversuche. Bitte in 15 Minuten erneut versuchen.' });
  }
  const user = db.prepare('SELECT id, password_hash FROM users WHERE email = ?').get(String(email ?? '').trim()) as
    | { id: number; password_hash: string }
    | undefined;
  // Auch bei unbekannter E-Mail einen Hash pruefen, damit die Antwortzeit nichts verraet
  const ok = await verifyPassword(String(password ?? ''), user?.password_hash ?? DUMMY_HASH);
  if (!user || !ok) {
    recordAttempt(ipKey);
    recordAttempt(mailKey);
    return res.status(401).json({ error: 'E-Mail oder Passwort ist falsch.' });
  }
  clearAttempts(mailKey);
  createSession(req, res, user.id);
  res.json({ ok: true });
});

authRouter.post('/logout', (req, res) => {
  const hash = currentTokenHash(req);
  if (hash) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hash);
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; ${cookieFlags(req, 0)}`);
  res.json({ ok: true });
});

authRouter.get('/me', (req, res) => {
  const user = userFromRequest(req);
  if (!user) return res.status(401).json({ error: 'Nicht angemeldet.' });
  res.json(user);
});

/** Passwort aendern (angemeldet): beendet alle anderen Sessions. */
authRouter.post('/password/change', async (req, res) => {
  const user = userFromRequest(req);
  if (!user) return res.status(401).json({ error: 'Bitte anmelden.' });
  const key = `change:${user.id}`;
  if (tooManyAttempts(key)) return res.status(429).json({ error: 'Zu viele Fehlversuche. Bitte später erneut versuchen.' });
  const { currentPassword, newPassword } = req.body ?? {};
  const row = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(user.id) as { password_hash: string };
  if (!(await verifyPassword(String(currentPassword ?? ''), row.password_hash))) {
    recordAttempt(key);
    return res.status(400).json({ error: 'Das aktuelle Passwort ist falsch.' });
  }
  const problem = passwordProblem(newPassword);
  if (problem) return res.status(400).json({ error: problem });
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(await hashPassword(newPassword), user.id);
  db.prepare('DELETE FROM sessions WHERE user_id = ? AND token_hash != ?').run(user.id, currentTokenHash(req));
  clearAttempts(key);
  res.json({ ok: true });
});

/** Passwort vergessen: antwortet immer gleich, damit sich nicht pruefen laesst, ob ein Konto existiert. */
authRouter.post('/password/forgot', async (req, res) => {
  const email = String(req.body?.email ?? '').trim();
  const ipKey = `forgot-ip:${req.ip}`;
  const mailKey = `forgot-mail:${email.toLowerCase()}`;
  const generic = { ok: true, message: 'Falls ein Konto zu dieser Adresse existiert, wurde eine E-Mail versendet.' };
  if (tooManyAttempts(ipKey) || tooManyAttempts(mailKey)) return res.json(generic);
  recordAttempt(ipKey);
  recordAttempt(mailKey);
  const user = db.prepare('SELECT id, name, email FROM users WHERE email = ?').get(email) as
    | { id: number; name: string; email: string }
    | undefined;
  if (user) {
    const token = crypto.randomBytes(32).toString('base64url');
    db.prepare('DELETE FROM password_resets WHERE user_id = ?').run(user.id);
    db.prepare(`INSERT INTO password_resets (token_hash, user_id, expires_at) VALUES (?, ?, datetime('now', ?))`).run(
      sha256(token),
      user.id,
      `+${RESET_MINUTES} minutes`,
    );
    await sendMail({
      to: user.email,
      subject: 'ShopPulse: Passwort zurücksetzen',
      text: `Hallo ${user.name},\n\nüber diesen Link können Sie ein neues Passwort festlegen (gültig ${RESET_MINUTES} Minuten, einmalig):\n${config.publicUrl}/passwort-zuruecksetzen?token=${token}\n\nFalls Sie das nicht angefordert haben, ignorieren Sie diese E-Mail – Ihr Passwort bleibt unverändert.`,
    }).catch((e) => console.error('Mailversand fehlgeschlagen:', e));
  }
  res.json(generic);
});

/** Neues Passwort per Reset-Link: Token einmalig, beendet alle Sessions des Kontos. */
authRouter.post('/password/reset', async (req, res) => {
  const ipKey = `reset-ip:${req.ip}`;
  if (tooManyAttempts(ipKey)) return res.status(429).json({ error: 'Zu viele Versuche. Bitte später erneut versuchen.' });
  const { token, password } = req.body ?? {};
  const row = db
    .prepare(`SELECT user_id FROM password_resets WHERE token_hash = ? AND used_at IS NULL AND expires_at > datetime('now')`)
    .get(sha256(String(token ?? ''))) as { user_id: number } | undefined;
  if (!row) {
    recordAttempt(ipKey);
    return res.status(400).json({ error: 'Der Link ist ungültig oder abgelaufen. Bitte fordern Sie einen neuen an.' });
  }
  const problem = passwordProblem(password);
  if (problem) return res.status(400).json({ error: problem });
  const hash = await hashPassword(password);
  db.transaction(() => {
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, row.user_id);
    db.prepare(`UPDATE password_resets SET used_at = datetime('now') WHERE token_hash = ?`).run(sha256(String(token)));
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(row.user_id);
  })();
  createSession(req, res, row.user_id);
  res.json({ ok: true });
});

function validInvitation(token: unknown) {
  return db
    .prepare(
      `SELECT i.id, i.org_id, i.email, i.role, o.name as orgName FROM invitations i JOIN organizations o ON o.id = i.org_id
       WHERE i.token_hash = ? AND i.accepted_at IS NULL AND i.expires_at > datetime('now')`,
    )
    .get(sha256(String(token ?? ''))) as { id: number; org_id: number; email: string; role: Role; orgName: string } | undefined;
}

authRouter.get('/invitation', (req, res) => {
  const inv = validInvitation(req.query.token);
  if (!inv) return res.status(404).json({ error: 'Die Einladung ist ungültig, abgelaufen oder wurde bereits angenommen.' });
  res.json({ email: inv.email, role: inv.role, orgName: inv.orgName });
});

authRouter.post('/invitation/accept', async (req, res) => {
  const ipKey = `invite-ip:${req.ip}`;
  if (tooManyAttempts(ipKey)) return res.status(429).json({ error: 'Zu viele Versuche. Bitte später erneut versuchen.' });
  const { token, name, password } = req.body ?? {};
  const inv = validInvitation(token);
  if (!inv) {
    recordAttempt(ipKey);
    return res.status(400).json({ error: 'Die Einladung ist ungültig, abgelaufen oder wurde bereits angenommen.' });
  }
  const problem = passwordProblem(password);
  if (problem) return res.status(400).json({ error: problem });
  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(inv.email)) {
    return res.status(409).json({ error: 'Für diese E-Mail-Adresse existiert bereits ein Konto.' });
  }
  const hash = await hashPassword(password);
  const userId = db.transaction(() => {
    db.prepare(`UPDATE invitations SET accepted_at = datetime('now') WHERE id = ?`).run(inv.id);
    return Number(
      db
        .prepare('INSERT INTO users (org_id, email, name, password_hash, role) VALUES (?, ?, ?, ?, ?)')
        .run(inv.org_id, inv.email, typeof name === 'string' && name.trim() ? name.trim().slice(0, 120) : inv.email, hash, inv.role)
        .lastInsertRowid,
    );
  })();
  createSession(req, res, userId);
  res.status(201).json({ ok: true });
});

// Konstanter Dummy-Hash (Passwort unbekannt) fuer gleichmaessige Antwortzeiten
let DUMMY_HASH = 'scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$' + Buffer.alloc(64).toString('base64');
void hashPassword(crypto.randomBytes(16).toString('hex')).then((h) => (DUMMY_HASH = h));

/** Abgelaufene Sessions, Reset-Links, Einladungen und Sperren regelmaessig entfernen. */
export function cleanupAuth() {
  db.prepare(`DELETE FROM sessions WHERE expires_at <= datetime('now')`).run();
  db.prepare(`DELETE FROM password_resets WHERE expires_at <= datetime('now', '-1 day')`).run();
  db.prepare(`DELETE FROM invitations WHERE accepted_at IS NULL AND expires_at <= datetime('now', '-30 days')`).run();
  db.prepare('DELETE FROM auth_attempts WHERE reset_at <= ?').run(Date.now());
  // Datensparsamkeit: Klick-Details nur 90 Tage aufbewahren
  db.prepare(`DELETE FROM click_events WHERE ts < datetime('now', '-90 days')`).run();
}
