import { Router } from 'express';
import crypto from 'node:crypto';
import { config } from '../config.js';
import { db, sha256 } from '../db/index.js';
import { sendMail } from '../mail.js';
import { EMAIL_RE, INVITE_DAYS, requireOwner, ROLES, type Role } from '../auth/index.js';

/** Teamverwaltung: alle sehen das Team, nur Inhaber:innen aendern es. Alles strikt auf die eigene Organisation. */
export const teamRouter = Router();

const ROLE_LABEL: Record<Role, string> = { owner: 'Inhaber:in', editor: 'Bearbeiten', viewer: 'Lesezugriff' };

teamRouter.get('/members', (req, res) => {
  const members = db
    .prepare('SELECT id, email, name, role, created_at FROM users WHERE org_id = ? ORDER BY created_at')
    .all(req.user!.orgId);
  const invitations =
    req.user!.role === 'owner'
      ? db
          .prepare(
            `SELECT id, email, role, expires_at, created_at FROM invitations
             WHERE org_id = ? AND accepted_at IS NULL AND expires_at > datetime('now') ORDER BY created_at DESC`,
          )
          .all(req.user!.orgId)
      : [];
  res.json({ members, invitations, me: req.user!.id });
});

teamRouter.post('/invitations', requireOwner, async (req, res) => {
  const email = String(req.body?.email ?? '').trim();
  const role = req.body?.role as Role;
  if (!EMAIL_RE.test(email) || email.length > 200) return res.status(400).json({ error: 'Bitte eine gültige E-Mail-Adresse angeben.' });
  if (!ROLES.includes(role)) return res.status(400).json({ error: 'Unbekannte Rolle.' });
  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) {
    // Ein Konto gehoert genau einer Organisation
    return res.status(409).json({ error: 'Für diese E-Mail-Adresse existiert bereits ein ShopPulse-Konto.' });
  }
  const open = (db.prepare(`SELECT COUNT(*) as n FROM invitations WHERE org_id = ? AND accepted_at IS NULL AND expires_at > datetime('now')`).get(req.user!.orgId) as { n: number }).n;
  if (open >= 50) return res.status(429).json({ error: 'Zu viele offene Einladungen.' });

  const token = crypto.randomBytes(32).toString('base64url');
  // Eine erneute Einladung derselben Adresse ersetzt die alte
  db.prepare('DELETE FROM invitations WHERE org_id = ? AND email = ? AND accepted_at IS NULL').run(req.user!.orgId, email);
  db.prepare(
    `INSERT INTO invitations (org_id, email, role, token_hash, invited_by, expires_at) VALUES (?, ?, ?, ?, ?, datetime('now', ?))`,
  ).run(req.user!.orgId, email, role, sha256(token), req.user!.id, `+${INVITE_DAYS} days`);

  try {
    await sendMail({
      to: email,
      subject: `Einladung zu ShopPulse – ${req.user!.orgName}`,
      text: `Hallo,\n\n${req.user!.name} lädt Sie ein, ShopPulse für „${req.user!.orgName}“ mitzunutzen (Rolle: ${ROLE_LABEL[role]}).\n\nKonto anlegen (Link ${INVITE_DAYS} Tage gültig, einmalig):\n${config.publicUrl}/einladung?token=${token}\n`,
    });
  } catch (e) {
    console.error('Mailversand fehlgeschlagen:', e);
    return res.status(502).json({ error: 'Die Einladung wurde angelegt, die E-Mail konnte aber nicht versendet werden.' });
  }
  res.status(201).json({ ok: true });
});

teamRouter.delete('/invitations/:id', requireOwner, (req, res) => {
  const info = db.prepare('DELETE FROM invitations WHERE id = ? AND org_id = ? AND accepted_at IS NULL').run(req.params.id, req.user!.orgId);
  if (!info.changes) return res.status(404).json({ error: 'Einladung nicht gefunden.' });
  res.status(204).end();
});

function countOwners(orgId: number): number {
  return (db.prepare(`SELECT COUNT(*) as n FROM users WHERE org_id = ? AND role = 'owner'`).get(orgId) as { n: number }).n;
}

teamRouter.patch('/members/:id', requireOwner, (req, res) => {
  const member = db.prepare('SELECT id, role FROM users WHERE id = ? AND org_id = ?').get(req.params.id, req.user!.orgId) as
    | { id: number; role: Role }
    | undefined;
  if (!member) return res.status(404).json({ error: 'Mitglied nicht gefunden.' });
  const role = req.body?.role as Role;
  if (!ROLES.includes(role)) return res.status(400).json({ error: 'Unbekannte Rolle.' });
  if (member.role === 'owner' && role !== 'owner' && countOwners(req.user!.orgId) <= 1) {
    return res.status(400).json({ error: 'Die Organisation braucht mindestens eine:n Inhaber:in.' });
  }
  db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, member.id);
  res.json({ ok: true });
});

teamRouter.delete('/members/:id', requireOwner, (req, res) => {
  const member = db.prepare('SELECT id, role FROM users WHERE id = ? AND org_id = ?').get(req.params.id, req.user!.orgId) as
    | { id: number; role: Role }
    | undefined;
  if (!member) return res.status(404).json({ error: 'Mitglied nicht gefunden.' });
  if (member.role === 'owner' && countOwners(req.user!.orgId) <= 1) {
    return res.status(400).json({ error: 'Die letzte Inhaberin bzw. der letzte Inhaber kann nicht entfernt werden.' });
  }
  // Loescht auch alle Sessions (ON DELETE CASCADE) – der Zugriff endet sofort
  db.prepare('DELETE FROM users WHERE id = ?').run(member.id);
  res.status(204).end();
});
