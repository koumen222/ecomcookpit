/**
 * test-resend.js — Vérifie l'envoi des emails transactionnels via Resend.
 *
 * Usage (depuis la racine du repo) :
 *   node Backend/scripts/test-resend.js destinataire@example.com [--otp]
 *
 * - Affiche le canal résolu par source (marketing → smtp, reste → resend)
 * - Envoie un email de test via sendMail (doit partir par l'API Resend)
 * - Avec --otp : envoie aussi un OTP factice (code 123456) via otpMailer
 *
 * Succès attendu : result.success=true et un id Resend (re_...).
 * Échec typique "domain is not verified" → vérifier scalor.net sur
 * https://resend.com/domains (DNS DKIM/SPF) avec le compte de la clé.
 */
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Charger les variables d'environnement depuis le dossier Backend
dotenv.config({ path: join(__dirname, '../.env') });

const to = process.argv[2];
const withOtp = process.argv.includes('--otp');

if (!to || !to.includes('@')) {
  console.error('Usage: node Backend/scripts/test-resend.js destinataire@example.com [--otp]');
  process.exit(1);
}

const { sendMail, resolveEmailProvider, defaultFrom } = await import('../core/notifications/mailer.js');

console.log('── Routage par source ──');
for (const source of ['otp', 'notification', 'custom', 'contact', 'app', 'campaign', 'campaign_test']) {
  console.log(`  ${source.padEnd(14)} → ${resolveEmailProvider(source)}`);
}
console.log(`  From transactionnel : ${defaultFrom()}`);
console.log(`  RESEND_API_KEY      : ${process.env.RESEND_API_KEY ? '…' + String(process.env.RESEND_API_KEY).slice(-6) : 'ABSENTE'}`);

console.log(`\n→ Envoi test transactionnel à ${to}…`);
const result = await sendMail({
  to,
  subject: 'Test Resend — mails transactionnels Scalor',
  text: 'Ceci est un test du canal transactionnel Resend.\n\nSi vous lisez ceci, EMAIL_PROVIDER=resend fonctionne.\n\nScalor',
  source: 'app',
  meta: { test: true }
});
console.log(JSON.stringify(result, null, 2));

let otpOk = true;
if (withOtp) {
  console.log(`\n→ Envoi OTP factice (code 123456) à ${to}…`);
  const { sendOtpEmail } = await import('../core/notifications/otpMailer.js');
  const otpResult = await sendOtpEmail({ to, code: '123456' });
  console.log(JSON.stringify(otpResult, null, 2));
  otpOk = otpResult.success;
}

const ok = result.success && otpOk;
console.log(ok ? '\n✅ Test réussi — vérifiez la boîte de réception.' : '\n❌ Test échoué (voir erreur ci-dessus).');

// Sans connexion Mongo, le journal EmailSendLog bufferise 10 s avant d'abandonner :
// on force la sortie sans attendre (l'appel API Resend est déjà terminé).
setTimeout(() => process.exit(ok ? 0 : 1), 1500);
