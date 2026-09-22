import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Zentrale Konfiguration. Im Produktivbetrieb (NODE_ENV=production) prueft validateProductionConfig()
 * beim Start alle sicherheitsrelevanten Einstellungen; fehlt etwas, startet der Server nicht.
 */
export const isProduction = process.env.NODE_ENV === 'production';

export const config = {
  dataDir: process.env.SHOPPULSE_DATA_DIR ?? path.resolve(__dirname, '../data'),
  /** Oeffentliche Adresse des Dashboards – fuer Links in E-Mails (Einladung, Passwort-Reset) */
  publicUrl: (process.env.SHOPPULSE_PUBLIC_URL ?? 'http://localhost:5174').replace(/\/+$/, ''),
  /** Session-Cookie nur ueber HTTPS; im Produktivbetrieb immer an */
  cookieSecure: isProduction || process.env.SHOPPULSE_COOKIE_SECURE === '1',
  smtpUrl: process.env.SHOPPULSE_SMTP_URL ?? '',
  mailFrom: process.env.SHOPPULSE_MAIL_FROM ?? 'ShopPulse <no-reply@localhost>',
  /** smtp | console | memory (Tests) */
  mailMode: process.env.SHOPPULSE_MAIL_MODE ?? (process.env.SHOPPULSE_SMTP_URL ? 'smtp' : 'console'),
  webDist: process.env.SHOPPULSE_WEB_DIST ?? path.resolve(__dirname, '../../web/dist'),
};

export function validateProductionConfig(): string[] {
  const problems: string[] = [];
  if (!process.env.SHOPPULSE_SECRET_KEY) {
    problems.push('SHOPPULSE_SECRET_KEY fehlt (32 Byte, base64 oder hex) – nötig zur Verschlüsselung von Zugangsdaten.');
  }
  if (!process.env.SHOPPULSE_PUBLIC_URL || !config.publicUrl.startsWith('https://')) {
    problems.push('SHOPPULSE_PUBLIC_URL muss auf eine https://-Adresse zeigen (Links in E-Mails, HTTPS-Betrieb).');
  }
  if (config.mailMode !== 'smtp' || !config.smtpUrl) {
    problems.push('SHOPPULSE_SMTP_URL fehlt – ohne Mailversand funktionieren Einladungen und Passwort-Reset nicht.');
  } else if (!/^smtps?:\/\//.test(config.smtpUrl)) {
    problems.push('SHOPPULSE_SMTP_URL muss mit smtp:// oder smtps:// beginnen.');
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    problems.push('ANTHROPIC_API_KEY fehlt – der KI-Berater ist für alle Kund:innen inklusive und muss eingerichtet sein.');
  }
  if (!process.env.SHOPPULSE_TRUST_PROXY) {
    problems.push('SHOPPULSE_TRUST_PROXY fehlt – hinter einem HTTPS-Reverse-Proxy nötig (z. B. "1" oder "loopback").');
  }
  return problems;
}
