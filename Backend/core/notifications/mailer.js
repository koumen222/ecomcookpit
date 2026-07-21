// ─── Transport mail central Scalor ───────────────────────────────────────────
// Deux canaux d'envoi, choisis par source applicative :
//   • Resend (API)  — TOUS les emails transactionnels (otp, notification,
//     custom, contact, app, ...) quand EMAIL_PROVIDER=resend.
//   • SMTP auto-hébergé (Postfix — mail.scalor.net, cf. routes/mailServerAdmin.js)
//     — TOUJOURS utilisé pour le marketing (source campaign / campaign_test),
//     et fallback de tout le reste si Resend n'est pas configuré.
//
// Config par variables d'env (prioritaires) :
//   EMAIL_PROVIDER (resend|smtp, def: smtp)   RESEND_API_KEY
//   RESEND_MIN_SEND_GAP_MS (def: 600 — limite API Resend ~2 req/s)
//   SMTP_HOST (def: mail.scalor.net)   SMTP_PORT (def: 587, STARTTLS)
//   SMTP_USER (def: smtpuser)          SMTP_PASS
//   EMAIL_FROM (def: noreply@scalor.net)  EMAIL_FROM_NAME (def: Scalor)
//     → avec Resend, le domaine de EMAIL_FROM doit être vérifié dans Resend.
// Fallback : si SMTP_PASS absent et que le backend tourne sur le VPS mail,
// lit /root/scalor-smtp-credentials.txt (même source que le dashboard admin).

import nodemailer from 'nodemailer';
import { Resend } from 'resend';
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
let resendClient = null;

// ── Choix du canal ───────────────────────────────────────────────────────────
// Le marketing reste TOUJOURS sur le SMTP auto-hébergé (réputation Postfix,
// froms personnalisés par campagne). Tout le reste part via l'API Resend dès
// que EMAIL_PROVIDER=resend et qu'une clé API est présente.
const MARKETING_SOURCES = new Set(['campaign', 'campaign_test']);

export function resolveEmailProvider(source = 'app') {
  if (MARKETING_SOURCES.has(String(source))) return 'smtp';
  const wanted = String(process.env.EMAIL_PROVIDER || 'smtp').trim().toLowerCase();
  if (wanted !== 'resend') return 'smtp';
  if (!String(process.env.RESEND_API_KEY || '').trim()) {
    console.warn('[mailer] EMAIL_PROVIDER=resend mais RESEND_API_KEY absente — envoi via SMTP');
    return 'smtp';
  }
  return 'resend';
}

function getResendClient() {
  if (!resendClient) resendClient = new Resend(String(process.env.RESEND_API_KEY).trim());
  return resendClient;
}

// Tags Resend : lettres/chiffres/underscore/tiret uniquement
function sanitizeTag(value = '') {
  return String(value || 'app').replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 50) || 'app';
}

// ── Files d'envoi sérialisées (une par canal) ────────────────────────────────
// SMTP : écart min SMTP_MIN_SEND_GAP_MS (def 3s) — anti-spam / réputation IP.
// Resend : écart min RESEND_MIN_SEND_GAP_MS (def 600ms) — limite API ~2 req/s.
// Files séparées : un OTP via Resend n'attend jamais derrière une campagne SMTP.
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function createSendSlot(minGapMs) {
  let chain = Promise.resolve();
  let lastAt = 0;
  return (task) => {
    const run = chain.then(async () => {
      const wait = lastAt + minGapMs - Date.now();
      if (wait > 0) await sleep(wait);
      try {
        return await task();
      } finally {
        lastAt = Date.now();
      }
    });
    // La chaîne ne doit jamais se casser sur un échec d'envoi
    chain = run.catch(() => {});
    return run;
  };
}

const withSmtpSlot = createSendSlot(Math.max(0, Number(process.env.SMTP_MIN_SEND_GAP_MS || 3000)));
const withResendSlot = createSendSlot(Math.max(0, Number(process.env.RESEND_MIN_SEND_GAP_MS || 600)));

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

// ── Canal SMTP (Postfix auto-hébergé) ────────────────────────────────────────
async function sendViaSmtp({ from, toText, subject, html, text, replyTo, headers }) {
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
      return {
        success: false,
        from: fromText,
        id: info?.messageId || null,
        queueId: extractQueueId(response),
        response,
        accepted,
        rejected,
        envelope: info?.envelope || null,
        error: `Destinataire rejeté par le SMTP: ${rejected.join(', ')}`
      };
    }
    return {
      success: true,
      from: fromText,
      id: info?.messageId || null,
      queueId: extractQueueId(response),
      response,
      accepted,
      rejected,
      envelope: info?.envelope || null
    };
  } catch (error) {
    return {
      success: false,
      from: from || defaultFrom(),
      response: error?.response || '',
      accepted: [],
      rejected: Array.isArray(error?.rejected) ? error.rejected : [],
      envelope: error?.envelope || null,
      error: error?.message || 'Erreur SMTP'
    };
  }
}

// ── Canal Resend (API HTTPS) ─────────────────────────────────────────────────
async function sendViaResend({ from, to, subject, html, text, replyTo, headers, source }) {
  const fromText = from || defaultFrom();
  const toList = (Array.isArray(to) ? to : [to]).map((v) => String(v || '').trim()).filter(Boolean);

  try {
    const response = await getResendClient().emails.send({
      from: fromText,
      to: toList,
      subject,
      html: html || undefined,
      text: text || undefined,
      reply_to: replyTo || process.env.EMAIL_REPLY_TO || undefined,
      headers: headers && Object.keys(headers).length ? headers : undefined,
      tags: [{ name: 'category', value: sanitizeTag(source) }],
    });

    if (response?.error) {
      return {
        success: false,
        from: fromText,
        id: null,
        queueId: '',
        response: response.error.name || '',
        accepted: [],
        rejected: [],
        envelope: null,
        error: response.error.message || 'Erreur Resend'
      };
    }

    return {
      success: true,
      from: fromText,
      id: response?.data?.id || '',
      queueId: '',
      response: 'accepted by Resend API',
      accepted: toList,
      rejected: [],
      envelope: null
    };
  } catch (error) {
    return {
      success: false,
      from: fromText,
      id: null,
      queueId: '',
      response: '',
      accepted: [],
      rejected: [],
      envelope: null,
      error: error?.message || 'Erreur Resend'
    };
  }
}

/**
 * Envoi d'un email via le canal choisi par resolveEmailProvider(source) :
 * Resend pour le transactionnel (si EMAIL_PROVIDER=resend), SMTP Postfix pour
 * le marketing (campaign / campaign_test) et en fallback.
 * Sérialisé par canal : SMTP_MIN_SEND_GAP_MS / RESEND_MIN_SEND_GAP_MS.
 * Chaque envoi (réussi ou non) est journalisé dans EmailSendLog.
 * @param {object} options
 * @param {string} [options.source] Origine applicative (otp, notification, campaign, ...)
 * @param {object} [options.meta] Contexte libre (campaignId, templateKey, ...)
 * @returns {Promise<{success: boolean, id?: string, queueId?: string, response?: string, accepted?: string[], rejected?: string[], envelope?: object, error?: string}>}
 */
export async function sendMail({ from, to, subject, html, text, replyTo, headers, source = 'app', meta = null }) {
  const provider = resolveEmailProvider(source);
  const withSlot = provider === 'resend' ? withResendSlot : withSmtpSlot;

  return withSlot(async () => {
    const startedAt = Date.now();
    const toText = Array.isArray(to) ? to.join(', ') : String(to || '');

    const result = provider === 'resend'
      ? await sendViaResend({ from, to, subject, html, text, replyTo, headers, source })
      : await sendViaSmtp({ from, toText, subject, html, text, replyTo, headers });

    const durationMs = Date.now() - startedAt;
    if (result.success) {
      const ref = result.queueId ? `queue ${result.queueId}` : (result.id || '?');
      console.log(`📧 [mailer] ${source} → ${toText} via ${provider} (${ref}, ${durationMs}ms)`);
    } else {
      console.error(`📧❌ [mailer] ${source} → ${toText} via ${provider}: ${result.error}`);
    }

    // Journalisation non bloquante — l'échec du log ne casse jamais l'envoi
    logSend({
      to: toText,
      from: result.from || '',
      subject: String(subject || '').slice(0, 300),
      status: result.success ? 'sent' : 'failed',
      source,
      provider,
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
