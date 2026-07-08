import { sendMail, defaultFrom } from '../core/notifications/mailer.js';

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function htmlToText(value = '') {
  return String(value)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h1|h2|h3|li)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function paragraph(value = '') {
  return escapeHtml(value).replace(/\r?\n/g, '<br/>');
}

function normalizeEmail(value = '') {
  const email = String(value || '').trim();
  if (/[\r\n]/.test(email)) return undefined;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : undefined;
}

function buildTemplate({ template, data = {}, html, text, subject }) {
  if (template === 'contact-request') {
    const safeSubject = data.subject || subject || 'Nouvelle demande de contact';
    const bodyText = [
      'Nouvelle demande de contact',
      '',
      `Nom: ${data.name || '-'}`,
      `Email: ${data.email || '-'}`,
      `Sujet: ${safeSubject}`,
      `Date: ${data.date || new Date().toLocaleString('fr-FR')}`,
      '',
      'Message:',
      data.message || '-',
    ].join('\n');

    return {
      text: bodyText,
      html: `
        <h2>Nouvelle demande de contact</h2>
        <p><strong>Nom:</strong> ${escapeHtml(data.name || '-')}</p>
        <p><strong>Email:</strong> ${escapeHtml(data.email || '-')}</p>
        <p><strong>Sujet:</strong> ${escapeHtml(safeSubject)}</p>
        <p><strong>Date:</strong> ${escapeHtml(data.date || new Date().toLocaleString('fr-FR'))}</p>
        <hr/>
        <p>${paragraph(data.message || '-')}</p>
      `,
    };
  }

  if (template === 'contact-confirmation') {
    const bodyText = [
      `Bonjour ${data.name || ''}`.trim(),
      '',
      'Nous avons bien reçu votre demande.',
      data.subject ? `Sujet: ${data.subject}` : '',
      '',
      'Nous revenons vers vous rapidement.',
      '',
      'Scalor',
    ].filter(Boolean).join('\n');

    return {
      text: bodyText,
      html: `
        <p>Bonjour ${escapeHtml(data.name || '')},</p>
        <p>Nous avons bien reçu votre demande${data.subject ? ` concernant <strong>${escapeHtml(data.subject)}</strong>` : ''}.</p>
        <p>Nous revenons vers vous rapidement.</p>
        <p>Scalor</p>
      `,
    };
  }

  const htmlBody = html || (text ? `<p>${paragraph(text)}</p>` : `<p>${escapeHtml(subject || 'Message Scalor')}</p>`);
  return {
    html: htmlBody,
    text: text || htmlToText(htmlBody),
  };
}

export async function sendEmail({ to, subject, html, text, template, data = {}, replyTo, source = 'contact' }) {
  const safeTo = Array.isArray(to) ? to.filter(Boolean).join(', ') : String(to || '').trim();
  const safeSubject = String(subject || data.subject || 'Message Scalor').trim();

  if (!safeTo) throw new Error('Destinataire email requis');
  if (!safeSubject) throw new Error('Sujet email requis');

  const body = buildTemplate({ template, data, html, text, subject: safeSubject });
  const result = await sendMail({
    from: defaultFrom(),
    to: safeTo,
    subject: safeSubject,
    html: body.html,
    text: body.text,
    replyTo: normalizeEmail(replyTo) || normalizeEmail(data.email) || normalizeEmail(process.env.EMAIL_REPLY_TO),
    source,
    meta: { template: template || 'custom' },
  });

  if (!result.success) {
    throw new Error(result.error || 'Erreur envoi email');
  }

  return result;
}
