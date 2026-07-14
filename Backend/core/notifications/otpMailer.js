import { Resend } from 'resend';
import EmailSendLog from '../../models/EmailSendLog.js';
import { defaultFrom, sendMail } from './mailer.js';

const ALLOWED_PROVIDERS = new Set(['smtp', 'resend']);
let resendClient = null;

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function resolveProvider() {
  const provider = String(process.env.OTP_EMAIL_PROVIDER || 'smtp').trim().toLowerCase();
  if (!ALLOWED_PROVIDERS.has(provider)) {
    throw new Error(`OTP_EMAIL_PROVIDER invalide: ${provider}`);
  }
  return provider;
}

function resolveResendConfig() {
  const apiKey = String(process.env.RESEND_API_KEY || '').trim();
  const from = String(process.env.OTP_EMAIL_FROM || '').trim();

  if (!apiKey) {
    throw new Error('RESEND_API_KEY manquant pour envoyer les OTP avec Resend');
  }
  if (!from) {
    throw new Error('OTP_EMAIL_FROM manquant (utiliser une adresse appartenant à un domaine vérifié dans Resend)');
  }

  return { apiKey, from };
}

function getResendClient(apiKey) {
  if (!resendClient) resendClient = new Resend(apiKey);
  return resendClient;
}

function buildOtpContent(code) {
  const safeCode = escapeHtml(code);
  const subject = `${code} est votre code de vérification Scalor`;
  const text = [
    'Confirmez votre adresse email',
    '',
    `Votre code de vérification Scalor est : ${code}`,
    '',
    'Ce code expire dans 10 minutes et ne doit être partagé avec personne.',
    "Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.",
    '',
    'Scalor'
  ].join('\n');
  const html = `<!doctype html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${subject}</title></head>
<body style="margin:0;background:#f5f7fb;color:#172033;font-family:Arial,sans-serif">
  <div style="display:none;max-height:0;overflow:hidden">Utilisez ce code dans les 10 prochaines minutes.</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f7fb">
    <tr><td align="center" style="padding:32px 16px">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:480px;background:#fff;border:1px solid #e6eaf2;border-radius:12px">
        <tr><td style="padding:28px 32px 8px;font-size:22px;font-weight:700;color:#4f46e5">Scalor</td></tr>
        <tr><td style="padding:16px 32px 32px">
          <h1 style="margin:0 0 14px;font-size:22px;line-height:1.3">Confirmez votre adresse email</h1>
          <p style="margin:0 0 20px;color:#526079;font-size:15px;line-height:1.6">Saisissez ce code dans Scalor. Il expire dans 10 minutes.</p>
          <div style="margin:0 0 20px;padding:18px;text-align:center;background:#f1f0ff;border-radius:10px;color:#3028a9;font-family:monospace;font-size:36px;font-weight:700;letter-spacing:8px">${safeCode}</div>
          <p style="margin:0;color:#6c7890;font-size:13px;line-height:1.6">Ne partagez ce code avec personne. Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return { subject, text, html };
}

async function logResendAttempt({ to, from, subject, result, durationMs }) {
  try {
    await EmailSendLog.create({
      to,
      from,
      subject,
      status: result.success ? 'sent' : 'failed',
      source: 'otp',
      provider: 'resend',
      messageId: result.id || '',
      smtpResponse: result.success ? 'accepted by Resend API' : '',
      error: String(result.error || '').slice(0, 500),
      durationMs,
      meta: { provider: 'resend' }
    });
  } catch (error) {
    console.warn('[otp-mailer] journal Resend impossible:', error?.message);
  }
}

async function sendWithResend({ to, subject, text, html, replyTo }) {
  const { apiKey, from } = resolveResendConfig();
  const startedAt = Date.now();
  let result;

  try {
    const response = await getResendClient(apiKey).emails.send({
      from,
      to: [to],
      subject,
      text,
      html,
      reply_to: replyTo || undefined,
      headers: {
        'Auto-Submitted': 'auto-generated',
        'X-Auto-Response-Suppress': 'All'
      },
      tags: [{ name: 'category', value: 'otp' }]
    });

    if (response?.error) {
      result = { success: false, provider: 'resend', error: response.error.message || 'Erreur Resend' };
    } else {
      result = { success: true, provider: 'resend', id: response?.data?.id || '' };
    }
  } catch (error) {
    result = { success: false, provider: 'resend', error: error?.message || 'Erreur Resend' };
  }

  const durationMs = Date.now() - startedAt;
  logResendAttempt({ to, from, subject, result, durationMs }).catch(() => {});
  return result;
}

export function getOtpEmailStatus() {
  const provider = resolveProvider();
  if (provider === 'resend') {
    return {
      provider,
      configured: Boolean(process.env.RESEND_API_KEY && process.env.OTP_EMAIL_FROM),
      from: String(process.env.OTP_EMAIL_FROM || '')
    };
  }

  return {
    provider,
    configured: Boolean(process.env.SMTP_PASS),
    from: defaultFrom()
  };
}

export async function sendOtpEmail({ to, code }) {
  const provider = resolveProvider();
  const content = buildOtpContent(code);
  const replyTo = process.env.OTP_REPLY_TO || process.env.EMAIL_REPLY_TO || 'support@scalor.net';

  if (provider === 'resend') {
    return sendWithResend({ to, replyTo, ...content });
  }

  const result = await sendMail({
    from: defaultFrom(),
    to,
    replyTo,
    source: 'otp',
    ...content,
    headers: {
      'Auto-Submitted': 'auto-generated',
      'X-Auto-Response-Suppress': 'All'
    },
    meta: { provider: 'smtp' }
  });

  return { ...result, provider: 'smtp' };
}
