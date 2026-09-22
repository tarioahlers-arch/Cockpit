import nodemailer from 'nodemailer';
import { config } from './config.js';

export interface Mail {
  to: string;
  subject: string;
  text: string;
}

/** Im Modus "memory" (Tests) landen Mails hier statt im Postfach. */
export const outbox: Mail[] = [];

let transport: nodemailer.Transporter | null = null;

export async function sendMail(mail: Mail): Promise<void> {
  switch (config.mailMode) {
    case 'smtp':
      transport ??= nodemailer.createTransport(config.smtpUrl);
      await transport.sendMail({ from: config.mailFrom, to: mail.to, subject: mail.subject, text: mail.text });
      return;
    case 'memory':
      outbox.push(mail);
      return;
    default:
      // Entwicklung ohne Mailserver: Inhalt (inkl. Link) im Server-Log
      console.log(`\n[ShopPulse Mail] An: ${mail.to}\nBetreff: ${mail.subject}\n${mail.text}\n`);
  }
}
