/**
 * emailService.js — Stub
 * Le service email n'est pas encore implémenté.
 * Ce fichier empêche le crash de routes/contact.js au démarrage.
 */

export async function sendEmail({ to, subject, html }) {
  console.warn(`⚠️ [Email] Service non configuré — email à ${to} ignoré (sujet: ${subject})`);
  return { success: false, message: 'Email service not configured' };
}
