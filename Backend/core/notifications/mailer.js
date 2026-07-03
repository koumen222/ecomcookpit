// ─── Transport mail central Scalor ───────────────────────────────────────────
// Tous les emails sortants de Scalor passent par le serveur mail auto-hébergé
// (Postfix — mail.scalor.net, cf. routes/mailServerAdmin.js).
//
// Config par variables d'env (prioritaires) :
//   SMTP_HOST (def: mail.scalor.net)   SMTP_PORT (def: 587, STARTTLS)
//   SMTP_USER (def: smtpuser)          SMTP_PASS
//   EMAIL_FROM (def: noreply@scalor.net)  EMAIL_FROM_NAME (def: Scalor)
// Fallback : si SMTP_PASS absent et que le backend tourne sur le VPS mail,
// lit /root/scalor-smtp-credentials.txt (même source que le dashboard admin).

import nodemailer from 'nodemailer';
import { promises as fs } from 'node:fs';

const SMTP_CREDENTIALS_FILE = '/root/scalor-smtp-credentials.txt';
const DEFAULTS = {
  host: 'mail.scalor.net',
  port: 587,
  user: 'smtpuser',
  from: 'noreply@scalor.net',
  fromName: 'Scalor',
};

let transporterPromise = null;

// ── Écart minimum entre 2 envois SMTP (anti-spam / réputation IP) ─────────────
// Tous les envois passent par une file sérialisée : jamais 2 mails à moins de
// SMTP_MIN_SEND_GAP_MS d'intervalle (défaut 3s), quel que soit l'appelant.
const MIN_SEND_GAP_MS = Math.max(0, Number(process.env.SMTP_MIN_SEND_GAP_MS || 3000));
let sendChain = Promise.resolve();
let lastSendAt = 0;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function withSendSlot(task) {
  const run = sendChain.then(async () => {
    const wait = lastSendAt + MIN_SEND_GAP_MS - Date.now();
    if (wait > 0) await sleep(wait);
    try {
      return await task();
    } finally {
      lastSendAt = Date.now();
    }
  });
  // La chaîne ne doit jamais se casser sur un échec d'envoi
  sendChain = run.catch(() => {});
  return run;
}

function extractQueueId(response = '') {
  const match = String(response).match(/\bqueued as\s+([A-F0-9]+)\b/i);
  return match?.[1] || '';
}

// ── Journal d'envoi (onglet "Envois" du dashboard serveur mail) ───────────────
async function logSend(entry) {
  try {
    const { default: EmailSendLog } = await import('../../models/EmailSendLog.js');
    await EmailSendLog.create(entry);
  } catch (error) {
    console.warn('[mailer] log envoi impossible:', error?.message);
  }
}

async function readVpsCredentials() {
  try {
    const text = await fs.readFile(SMTP_CREDENTIALS_FILE, 'utf8');
    const values = {};
    for (const line of text.split('\n')) {
      const idx = line.indexOf('=');
      if (idx === -1) continue;
      values[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
    }
    return values;
  } catch {
    return {};
  }
}

async function resolveConfig() {
  const fileCreds = process.env.SMTP_PASS ? {} : await readVpsCredentials();

  const host = process.env.SMTP_HOST || fileCreds.host || DEFAULTS.host;
  const port = Number(process.env.SMTP_PORT || fileCreds.port || DEFAULTS.port);
  const user = process.env.SMTP_USER || fileCreds.user || DEFAULTS.user;
  const pass = process.env.SMTP_PASS || fileCreds.password || '';
  const from = process.env.EMAIL_FROM || fileCreds.from || DEFAULTS.from;
  const fromName = process.env.EMAIL_FROM_NAME || DEFAULTS.fromName;

  if (!pass) {
    throw new Error('SMTP non configuré : définir SMTP_PASS (mot de passe du serveur mail.scalor.net)');
  }

  return { host, port, user, pass, from, fromName };
}

async function getTransporter() {
  if (!transporterPromise) {
    transporterPromise = (async () => {
      const config = await resolveConfig();
      const transporter = nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.port === 465, // 587 = STARTTLS
        requireTLS: true,
        auth: { user: config.user, pass: config.pass },
        connectionTimeout: 15000,
        greetingTimeout: 15000,
        socketTimeout: 30000,
      });
      transporter.__scalorFrom = config.from;
      transporter.__scalorFromName = config.fromName;
      return transporter;
    })();
    // Ne pas mémoriser un échec de config : retenter au prochain appel
    transporterPromise.catch(() => { transporterPromise = null; });
  }
  return transporterPromise;
}

export function defaultFromAddress() {
  return process.env.EMAIL_FROM || DEFAULTS.from;
}

export function defaultFrom() {
  const name = process.env.EMAIL_FROM_NAME || DEFAULTS.fromName;
  return `${name} <${defaultFromAddress()}>`;
}

/**
 * Envoi d'un email via le serveur mail Scalor.
 * Sérialisé : écart minimum SMTP_MIN_SEND_GAP_MS entre 2 envois.
 * Chaque envoi (réussi ou non) est journalisé dans EmailSendLog.
 * @param {object} options
 * @param {string} [options.source] Origine applicative (otp, notification, campaign, ...)
 * @param {object} [options.meta] Contexte libre (campaignId, templateKey, ...)
 * @returns {Promise<{success: boolean, id?: string, queueId?: string, response?: string, accepted?: string[], rejected?: string[], envelope?: object, error?: string}>}
 */
export async function sendMail({ from, to, subject, html, text, replyTo, headers, source = 'app', meta = null }) {
  return withSendSlot(async () => {
    const startedAt = Date.now();
    const toText = Array.isArray(to) ? to.join(', ') : String(to || '');
    let result;

    try {
      const transporter = await getTransporter();
      const fromText = from || `${transporter.__scalorFromName} <${transporter.__scalorFrom}>`;
      const info = await transporter.sendMail({
        from: fromText,
        to: toText,
        subject,
        html,
        text,
        replyTo: replyTo || process.env.EMAIL_REPLY_TO || undefined,
        headers,
      });
      const accepted = Array.isArray(info?.accepted) ? info.accepted : [];
      const rejected = Array.isArray(info?.rejected) ? info.rejected : [];
      const response = info?.response || '';
      if (accepted.length === 0 && rejected.length > 0) {
        result = {
          success: false,
          id: info?.messageId || null,
          queueId: extractQueueId(response),
          response,
          accepted,
          rejected,
          envelope: info?.envelope || null,
          error: `Destinataire rejeté par le SMTP: ${rejected.join(', ')}`
        };
      } else {
        result = {
          success: true,
          id: info?.messageId || null,
          queueId: extractQueueId(response),
          response,
          accepted,
          rejected,
          envelope: info?.envelope || null
        };
      }
      result.from = fromText;
    } catch (error) {
      result = {
        success: false,
        from: from || defaultFrom(),
        response: error?.response || '',
        accepted: [],
        rejected: Array.isArray(error?.rejected) ? error.rejected : [],
        envelope: error?.envelope || null,
        error: error?.message || 'Erreur SMTP'
      };
    }

    const durationMs = Date.now() - startedAt;
    if (result.success) {
      console.log(`📧 [mailer] ${source} → ${toText} (queue ${result.queueId || '?'}, ${durationMs}ms)`);
    } else {
      console.error(`📧❌ [mailer] ${source} → ${toText}: ${result.error}`);
    }

    // Journalisation non bloquante — l'échec du log ne casse jamais l'envoi
    logSend({
      to: toText,
      from: result.from || '',
      subject: String(subject || '').slice(0, 300),
      status: result.success ? 'sent' : 'failed',
      source,
      messageId: result.id || '',
      queueId: result.queueId || '',
      smtpResponse: String(result.response || '').slice(0, 500),
      error: String(result.error || '').slice(0, 500),
      durationMs,
      meta,
    }).catch(() => {});

    delete result.from;
    return result;
  });
}
