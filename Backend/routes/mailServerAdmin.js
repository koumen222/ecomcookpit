import express from 'express';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { promises as fs } from 'node:fs';
import dns from 'node:dns/promises';
import net from 'node:net';
import tls from 'node:tls';
import { requireEcomAuth, requireSuperAdmin } from '../middleware/ecomAuth.js';
import EmailSendLog from '../models/EmailSendLog.js';

const execFileAsync = promisify(execFile);
const router = express.Router();

const MAIL_LOG = '/var/log/mail.log';
const ROOT_MBOX = '/var/mail/root';
const SMTP_CREDENTIALS = '/root/scalor-smtp-credentials.txt';
const DOMAIN = 'scalor.net';
const MAIL_HOST = 'mail.scalor.net';
const SERVER_IP = '89.117.58.183';
const DKIM_NAME = 'mail._domainkey.scalor.net';
const SERVICE_NAMES = ['postfix', 'dovecot', 'opendkim', 'docker'];
const PUBLIC_DNS_SERVERS = ['1.1.1.1', '8.8.8.8'];

router.use(requireEcomAuth, requireSuperAdmin);
router.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  next();
});

function clampInt(value, min, max, fallback) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function normalizeError(error) {
  const message = error?.stderr || error?.stdout || error?.message || String(error);
  return String(message).trim().slice(0, 1200);
}

async function runCommand(command, args = [], options = {}) {
  try {
    const { stdout = '', stderr = '' } = await execFileAsync(command, args, {
      timeout: options.timeout || 8000,
      maxBuffer: options.maxBuffer || 1024 * 1024,
      shell: false,
    });
    return { ok: true, stdout: stdout.trim(), stderr: stderr.trim(), code: 0 };
  } catch (error) {
    return {
      ok: false,
      stdout: String(error?.stdout || '').trim(),
      stderr: String(error?.stderr || '').trim(),
      code: Number.isInteger(error?.code) ? error.code : 1,
      error: normalizeError(error),
    };
  }
}

function sanitizeLogLine(line = '') {
  return String(line)
    .replace(/(sasl_password=)[^,\s]+/gi, '$1<hidden>')
    .replace(/(password=)[^,\s]+/gi, '$1<hidden>')
    .replace(/(AUTH (?:PLAIN|LOGIN) )[A-Za-z0-9+/=]+/gi, '$1<hidden>');
}

function deliveryReason(text = '') {
  if (/NoSuchUser|does not exist|user unknown|Recipient address rejected/i.test(text)) {
    return {
      title: 'Adresse destinataire inexistante',
      summary: "Le serveur distant dit que cette adresse email n'existe pas.",
      action: "Corrige l'adresse ou retire ce contact de la campagne."
    };
  }
  if (/blocked|blacklist|spam|policy|unsolicited|reputation/i.test(text)) {
    return {
      title: 'Rejet anti-spam ou politique distante',
      summary: "Le serveur destinataire refuse le mail pour une règle de sécurité, réputation ou contenu.",
      action: 'Vérifie le contenu, le domaine expéditeur, le PTR reverse et la réputation IP.'
    };
  }
  if (/Connection timed out|connect to .* timed out|Network is unreachable|Host or domain name not found|Name service error/i.test(text)) {
    return {
      title: 'Problème réseau ou DNS distant',
      summary: "Postfix n'arrive pas à joindre correctement le serveur destinataire.",
      action: 'Attends le réessai automatique, puis vérifie DNS/réseau si ça persiste.'
    };
  }
  if (/authentication failed|SASL|535|534/i.test(text)) {
    return {
      title: 'Authentification SMTP refusée',
      summary: "Le login ou le mot de passe SMTP utilisé par l'application est refusé.",
      action: 'Vérifie host, port 587, utilisateur smtpuser et mot de passe SMTP.'
    };
  }
  return null;
}

function explainLogEvent({ text, type, status, dkim, saslUser, rejectMatch }) {
  const reason = deliveryReason(text);

  if (/fatal:/i.test(text)) {
    return {
      severity: 'danger',
      label: 'Erreur config',
      title: 'Erreur de configuration Postfix',
      summary: "Postfix a détecté une configuration invalide et n'a pas pu exécuter l'action demandée.",
      action: 'Corrige la ligne indiquée dans le message, puis recharge Postfix.'
    };
  }

  if (status === 'sent') {
    const local = /relay=local/i.test(text);
    return {
      severity: 'success',
      label: local ? 'Livré localement' : 'Accepté',
      title: local ? 'Mail livré sur le VPS' : 'Mail accepté par le destinataire',
      summary: local
        ? 'Le message a été déposé dans une boîte locale du VPS, par exemple root.'
        : "Le serveur destinataire a accepté le mail. Côté Scalor, l'envoi est réussi.",
      action: local
        ? "OK pour un test local. Ce n'est pas un envoi vers une boîte externe."
        : "Surveille les ouvertures/clics ou les éventuels retours, mais Postfix a fini son travail."
    };
  }

  if (status === 'bounced') {
    return {
      severity: 'danger',
      label: 'Rejet définitif',
      title: reason?.title || 'Mail rejeté définitivement',
      summary: reason?.summary || "Le serveur destinataire a refusé ce mail. Postfix ne va pas continuer à essayer.",
      action: reason?.action || "Lis le détail technique, corrige la cause, puis renvoie si nécessaire."
    };
  }

  if (status === 'deferred') {
    return {
      severity: 'warning',
      label: 'En attente',
      title: reason?.title || 'Livraison reportée',
      summary: reason?.summary || "Le mail n'est pas perdu : Postfix le garde en queue et réessaiera plus tard.",
      action: reason?.action || 'Surveille la queue. Si ça dure, vérifie DNS, réseau ou réponse du serveur distant.'
    };
  }

  if (['expired', 'undeliverable'].includes(status)) {
    return {
      severity: 'danger',
      label: 'Non livré',
      title: 'Mail non livrable',
      summary: "Postfix a arrêté d'essayer de livrer ce mail.",
      action: 'Corrige la cause indiquée puis relance un nouvel envoi.'
    };
  }

  if (rejectMatch) {
    return {
      severity: 'warning',
      label: 'Connexion rejetée',
      title: reason?.title || 'Message rejeté avant mise en file',
      summary: reason?.summary || "Postfix a refusé la tentative avant de créer un mail dans la queue.",
      action: reason?.action || 'Vérifie l’adresse, le client SMTP ou la règle de sécurité affichée.'
    };
  }

  if (dkim) {
    return {
      severity: 'success',
      label: 'DKIM signé',
      title: 'Signature DKIM ajoutée',
      summary: "Le serveur a signé le mail pour prouver qu'il vient bien de scalor.net.",
      action: 'OK. C’est un bon signal pour la délivrabilité.'
    };
  }

  if (saslUser) {
    return {
      severity: 'success',
      label: 'Auth SMTP',
      title: 'Connexion SMTP authentifiée',
      summary: `Un client s'est connecté avec l'utilisateur ${saslUser}.`,
      action: "OK si c'est ton application Scalor ou un test prévu."
    };
  }

  if (/Trusted TLS connection established|TLS connection established/i.test(text)) {
    return {
      severity: 'success',
      label: 'TLS OK',
      title: 'Connexion sécurisée établie',
      summary: 'Postfix communique avec le serveur distant via une connexion chiffrée.',
      action: 'OK.'
    };
  }

  if (/DKIM verification successful|signature ok/i.test(text)) {
    return {
      severity: 'success',
      label: 'DKIM OK',
      title: 'Signature DKIM vérifiée',
      summary: 'Une signature DKIM entrante a été vérifiée correctement.',
      action: 'OK.'
    };
  }

  if (/removed$/i.test(text)) {
    return {
      severity: 'neutral',
      label: 'Terminé',
      title: 'Message retiré de la queue',
      summary: 'Postfix a fini de traiter cet ID de queue.',
      action: "Regarde la ligne précédente avec le même ID pour savoir si c'était envoyé ou rejeté."
    };
  }

  if (/queue active/i.test(text)) {
    return {
      severity: 'info',
      label: 'En cours',
      title: 'Mail en cours de traitement',
      summary: "Le mail est dans la file active et Postfix essaie de le livrer.",
      action: 'Attends la ligne suivante avec le même ID pour connaître le résultat.'
    };
  }

  if (/message-id=</i.test(text)) {
    return {
      severity: 'info',
      label: 'Préparé',
      title: 'Mail préparé par Postfix',
      summary: "Postfix a créé l'enveloppe technique du message.",
      action: 'Normal. Attends la ligne de livraison ou de rejet.'
    };
  }

  if (/pickup\[.*from=</i.test(text) || /postfix\/pickup/i.test(text)) {
    return {
      severity: 'info',
      label: 'Pris en charge',
      title: 'Mail pris en charge par Postfix',
      summary: 'Un script, une commande locale ou une application a déposé un mail dans Postfix.',
      action: 'Normal. Suis le même ID de queue pour voir la suite.'
    };
  }

  if (/sender non-delivery notification/i.test(text)) {
    return {
      severity: 'warning',
      label: 'Avis échec',
      title: "Notification d'échec créée",
      summary: "Postfix a créé un message automatique pour signaler qu'un mail n'a pas été livré.",
      action: "Regarde le bounce original avec le même ID pour connaître la cause."
    };
  }

  if (/reload --|refreshing the Postfix mail system/i.test(text)) {
    return {
      severity: 'neutral',
      label: 'Service rechargé',
      title: 'Postfix a été rechargé',
      summary: 'Le service mail a relu sa configuration.',
      action: 'OK si cela correspond à une modification ou un diagnostic.'
    };
  }

  if (type === 'connect') {
    return {
      severity: 'neutral',
      label: 'Connexion',
      title: 'Connexion SMTP reçue',
      summary: 'Un serveur ou client a ouvert une connexion SMTP.',
      action: 'Normal si une application ou un serveur distant échange avec le VPS.'
    };
  }

  return {
    severity: 'neutral',
    label: 'Info',
    title: 'Information technique',
    summary: "Événement Postfix/OpenDKIM sans erreur détectée.",
    action: 'Aucune action requise sauf si tu enquêtes sur cet ID.'
  };
}

function parseLogLine(line = '') {
  const text = sanitizeLogLine(line);
  const timeMatch = text.match(/^(\S+)/);
  const queueMatch = text.match(/\b([A-F0-9]{8,})\b/);
  const fromMatch = text.match(/from=<([^>]*)>/);
  const toMatch = text.match(/to=<([^>]*)>/);
  const statusMatch = text.match(/status=(sent|bounced|deferred|expired|undeliverable)/);
  const rejectMatch = text.match(/NOQUEUE: reject: .*?: ([0-9]{3} [^;]+)/);
  const saslMatch = text.match(/sasl_username=([^,\s]+)/);
  const dkim = /DKIM-Signature field added/i.test(text);

  let type = 'info';
  if (/fatal:/i.test(text)) type = 'error';
  else if (rejectMatch) type = 'rejected';
  else if (dkim) type = 'dkim';
  else if (saslMatch) type = 'auth';
  else if (statusMatch?.[1] === 'sent') type = 'sent';
  else if (['bounced', 'deferred', 'expired', 'undeliverable'].includes(statusMatch?.[1])) type = statusMatch[1];
  else if (/Trusted TLS connection established|TLS connection established/i.test(text)) type = 'tls';
  else if (/removed$/i.test(text)) type = 'removed';
  else if (/queue active/i.test(text)) type = 'active';
  else if (/message-id=</i.test(text)) type = 'prepared';
  else if (/pickup\[.*from=</i.test(text) || /postfix\/pickup/i.test(text)) type = 'pickup';
  else if (/connect from/i.test(text)) type = 'connect';

  const status = statusMatch?.[1] || (rejectMatch ? 'rejected' : '');
  const explanation = explainLogEvent({
    text,
    type,
    status,
    dkim,
    saslUser: saslMatch?.[1] || '',
    rejectMatch
  });

  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    timestamp: timeMatch?.[1] || null,
    queueId: queueMatch?.[1] || null,
    from: fromMatch?.[1] || '',
    to: toMatch?.[1] || '',
    status,
    type,
    severity: explanation.severity,
    label: explanation.label,
    title: explanation.title,
    summary: explanation.summary,
    action: explanation.action,
    saslUser: saslMatch?.[1] || '',
    message: rejectMatch?.[1] || text,
    raw: text,
  };
}

function parseQueue(output = '') {
  const empty = /Mail queue is empty/i.test(output);
  const entries = [];
  const lines = String(output || '').split('\n');

  for (const line of lines) {
    const match = line.match(/^([A-F0-9*!]+)\s+(\d+)\s+(\w{3}\s+\w{3}\s+\d+\s+\d+:\d+:\d+)\s+(.+)$/);
    if (!match) continue;
    entries.push({
      id: match[1].replace(/[*!]/g, ''),
      flags: match[1].replace(/[A-F0-9]/g, ''),
      size: Number(match[2]) || 0,
      arrival: match[3],
      sender: match[4].trim(),
    });
  }

  return { empty, count: entries.length, entries, raw: output };
}

function countByStatus(events = []) {
  const stats = { sent: 0, bounced: 0, deferred: 0, rejected: 0, auth: 0, dkim: 0, error: 0 };
  for (const event of events) {
    if (Object.prototype.hasOwnProperty.call(stats, event.type)) stats[event.type] += 1;
    if (event.status && Object.prototype.hasOwnProperty.call(stats, event.status)) stats[event.status] += 1;
  }
  return stats;
}

async function getTailEvents(lines = 250) {
  const result = await runCommand('tail', ['-n', String(lines), MAIL_LOG], { timeout: 5000 });
  if (!result.ok) return { ok: false, events: [], raw: '', error: result.error };

  const rawLines = result.stdout.split('\n').filter(Boolean);
  return {
    ok: true,
    raw: rawLines.map(sanitizeLogLine).join('\n'),
    events: rawLines.map(parseLogLine).reverse(),
  };
}

async function getPublicPtrRecords() {
  for (const server of PUBLIC_DNS_SERVERS) {
    const result = await runCommand('dig', ['+short', '-x', SERVER_IP, `@${server}`], { timeout: 5000 });
    const records = result.stdout
      .split('\n')
      .map((value) => value.trim().replace(/\.$/, ''))
      .filter(Boolean);
    if (records.length) return records;
  }
  return [];
}

async function getServices() {
  const rows = await Promise.all(SERVICE_NAMES.map(async (name) => {
    const [active, enabled] = await Promise.all([
      runCommand('systemctl', ['is-active', name], { timeout: 3000 }),
      runCommand('systemctl', ['is-enabled', name], { timeout: 3000 }),
    ]);
    return {
      name,
      active: active.stdout || 'unknown',
      enabled: enabled.stdout || 'unknown',
      ok: active.stdout === 'active',
    };
  }));
  return rows;
}

async function getPorts() {
  const result = await runCommand('ss', ['-tulpn'], { timeout: 5000 });
  const ports = [];
  if (result.ok) {
    for (const line of result.stdout.split('\n')) {
      if (!/:(25|80|443|587)\b/.test(line)) continue;
      const port = line.match(/:(25|80|443|587)\b/)?.[1];
      ports.push({
        port,
        protocol: line.startsWith('udp') ? 'udp' : 'tcp',
        raw: sanitizeLogLine(line),
        mail: ['25', '587'].includes(port),
      });
    }
  }
  return { ok: result.ok, ports, error: result.error || '' };
}

async function readCredentials() {
  try {
    const text = await fs.readFile(SMTP_CREDENTIALS, 'utf8');
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

async function getDnsStatus() {
  const resolver = new dns.Resolver();
  resolver.setServers(PUBLIC_DNS_SERVERS);

  const safeResolve = async (fn, fallback = []) => {
    try { return await fn(); } catch { return fallback; }
  };

  const [mailA, mailAaaa, mx, spfRecords, dmarcRecords, dkimRecords, ptrRecords] = await Promise.all([
    safeResolve(() => resolver.resolve4(MAIL_HOST)),
    safeResolve(() => resolver.resolve6(MAIL_HOST)),
    safeResolve(() => resolver.resolveMx(DOMAIN)),
    safeResolve(() => resolver.resolveTxt(DOMAIN)),
    safeResolve(() => resolver.resolveTxt(`_dmarc.${DOMAIN}`)),
    safeResolve(() => resolver.resolveTxt(DKIM_NAME)),
    getPublicPtrRecords(),
  ]);

  const flattenTxt = (records = []) => records.map((parts) => parts.join(''));
  const spf = flattenTxt(spfRecords).filter((value) => value.toLowerCase().startsWith('v=spf1'));
  const dmarc = flattenTxt(dmarcRecords).filter((value) => value.toLowerCase().startsWith('v=dmarc1'));
  const dkim = flattenTxt(dkimRecords).filter((value) => value.toLowerCase().startsWith('v=dkim1'));

  return {
    mailA,
    mailAaaa,
    mx: mx.sort((a, b) => a.priority - b.priority),
    spf,
    dmarc,
    dkim,
    ptr: ptrRecords,
    checks: {
      mailA: mailA.includes(SERVER_IP),
      mailAaaa: mailAaaa.length === 0,
      spfSingle: spf.length === 1,
      dmarcSingle: dmarc.length === 1,
      dkimPresent: dkim.length > 0,
      ptr: ptrRecords.includes(MAIL_HOST),
    },
    expected: {
      mailA: SERVER_IP,
      noAaaa: true,
      ptr: MAIL_HOST,
      dkimName: DKIM_NAME,
    },
  };
}

async function getMailbox(limit = 25) {
  try {
    const raw = await fs.readFile(ROOT_MBOX, 'utf8');
    const chunks = raw.split(/\n(?=From [^\n]+\n)/g).filter(Boolean).slice(-limit).reverse();
    return chunks.map((chunk, index) => {
      const headersText = chunk.split(/\n\n/)[0] || '';
      const getHeader = (name) => {
        const match = headersText.match(new RegExp(`^${name}:\\s*([^\\n\\r]+)`, 'im'));
        return match?.[1]?.trim() || '';
      };
      const body = chunk.split(/\n\n/).slice(1).join('\n\n').trim();
      return {
        id: `${index}-${getHeader('Message-Id') || getHeader('Date') || Date.now()}`,
        from: getHeader('From') || chunk.match(/^From\s+(\S+)/)?.[1] || '',
        to: getHeader('To'),
        subject: getHeader('Subject') || '(sans sujet)',
        date: getHeader('Date'),
        messageId: getHeader('Message-Id'),
        dkimSigned: /DKIM-Signature:/i.test(headersText),
        preview: body.replace(/\s+/g, ' ').slice(0, 260),
      };
    });
  } catch {
    return [];
  }
}

async function getDkimRecord() {
  try {
    const text = await fs.readFile('/etc/opendkim/keys/scalor.net/mail.txt', 'utf8');
    const value = text.match(/"([^"]+)"/g)?.map((part) => part.replace(/^"|"$/g, '')).join('') || '';
    return { name: DKIM_NAME, value };
  } catch {
    return { name: DKIM_NAME, value: '' };
  }
}

function smtpAuthSendTest({ to, from, user, password, subject, body }) {
  return new Promise((resolve) => {
    let socket;
    let partial = '';
    let lineQueue = [];
    let settled = false;
    const transcript = [];
    const waiters = [];
    const timeout = setTimeout(() => finish(false, 'Timeout SMTP'), 25000);

    function finish(ok, error = '') {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      try { socket?.end(); } catch {}
      resolve({ ok, output: transcript.join('\n'), error });
    }

    function onError(error) {
      finish(false, error?.message || 'Erreur SMTP');
    }

    function onData(chunk) {
      partial += String(chunk).replace(/\r/g, '');
      const parts = partial.split('\n');
      partial = parts.pop() || '';
      lineQueue.push(...parts.filter((line) => line.length));
      processWaiters();
    }

    function attach(nextSocket) {
      socket = nextSocket;
      socket.setEncoding('utf8');
      socket.on('data', onData);
      socket.on('error', onError);
    }

    function detach() {
      socket?.removeListener('data', onData);
      socket?.removeListener('error', onError);
    }

    function extractResponse() {
      if (!lineQueue.length) return null;
      const response = [];
      for (let i = 0; i < lineQueue.length; i += 1) {
        response.push(lineQueue[i]);
        if (/^\d{3} /.test(lineQueue[i])) {
          lineQueue = lineQueue.slice(i + 1);
          const code = Number(response[0].slice(0, 3));
          return { code, lines: response };
        }
      }
      return null;
    }

    function processWaiters() {
      while (waiters.length) {
        const response = extractResponse();
        if (!response) return;
        waiters.shift().resolve(response);
      }
    }

    function readResponse() {
      const response = extractResponse();
      if (response) return Promise.resolve(response);
      return new Promise((resolveResponse) => {
        waiters.push({ resolve: resolveResponse });
      });
    }

    async function expect(codes) {
      const response = await readResponse();
      transcript.push(...response.lines.map((line) => `<-- ${line}`));
      if (!codes.includes(response.code)) {
        throw new Error(response.lines.join('\n'));
      }
      return response;
    }

    function send(command, logged = command) {
      transcript.push(`--> ${logged}`);
      socket.write(`${command}\r\n`);
    }

    function dotStuff(value = '') {
      return String(value).replace(/\r?\n/g, '\r\n').replace(/^\./gm, '..');
    }

    async function run() {
      await new Promise((resolveConnect, rejectConnect) => {
        const plain = net.createConnection({ host: '127.0.0.1', port: 587 }, resolveConnect);
        plain.once('error', rejectConnect);
        attach(plain);
      });

      await expect([220]);
      send(`EHLO ${MAIL_HOST}`);
      await expect([250]);
      send('STARTTLS');
      await expect([220]);

      detach();
      partial = '';
      lineQueue = [];

      await new Promise((resolveTls, rejectTls) => {
        const secureSocket = tls.connect({ socket, servername: MAIL_HOST }, resolveTls);
        secureSocket.once('error', rejectTls);
        attach(secureSocket);
      });

      send(`EHLO ${MAIL_HOST}`);
      await expect([250]);
      send('AUTH LOGIN');
      await expect([334]);
      send(Buffer.from(user).toString('base64'), '<smtp-user>');
      await expect([334]);
      send(Buffer.from(password).toString('base64'), '<smtp-password>');
      await expect([235]);
      send(`MAIL FROM:<${from}>`);
      await expect([250]);
      send(`RCPT TO:<${to}>`);
      await expect([250]);
      send('DATA');
      await expect([354]);
      send([
        `From: Scalor <${from}>`,
        `To: ${to}`,
        `Subject: ${subject}`,
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=utf-8',
        '',
        dotStuff(body),
        '.',
      ].join('\r\n'), '<message-body>');
      await expect([250]);
      send('QUIT');
      await expect([221]);
      finish(true);
    }

    run().catch((error) => finish(false, error?.message || 'Erreur SMTP'));
  });
}

router.get('/overview', async (_req, res) => {
  try {
    const [services, ports, queueResult, logs, dnsStatus, mailbox, dkimRecord, postconf] = await Promise.all([
      getServices(),
      getPorts(),
      runCommand('postqueue', ['-p'], { timeout: 6000 }),
      getTailEvents(600),
      getDnsStatus(),
      getMailbox(12),
      getDkimRecord(),
      runCommand('postconf', ['-n'], { timeout: 6000 }),
    ]);

    const queue = parseQueue(queueResult.stdout || queueResult.error || '');
    const stats = countByStatus(logs.events);
    const credentials = await readCredentials();

    res.json({
      success: true,
      data: {
        generatedAt: new Date().toISOString(),
        domain: DOMAIN,
        hostname: MAIL_HOST,
        serverIp: SERVER_IP,
        smtp: {
          host: credentials.host || MAIL_HOST,
          port: Number(credentials.port || 587),
          secure: credentials.secure === 'true',
          requireTLS: true,
          user: credentials.user || 'smtpuser',
          from: credentials.from || `noreply@${DOMAIN}`,
          passwordConfigured: Boolean(credentials.password),
        },
        services,
        ports,
        queue,
        stats,
        logs: logs.events.slice(0, 80),
        mailbox,
        dns: dnsStatus,
        dkimRecord,
        config: postconf.ok ? postconf.stdout.split('\n').filter(Boolean) : [],
      },
    });
  } catch (error) {
    console.error('[MailServerAdmin] overview error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur mail admin' });
  }
});

router.get('/logs', async (req, res) => {
  const lines = clampInt(req.query.lines, 50, 1200, 250);
  const filter = String(req.query.filter || '').trim().toLowerCase().slice(0, 80);
  const logs = await getTailEvents(lines);
  const events = filter
    ? logs.events.filter((event) => [
        event.raw,
        event.type,
        event.label,
        event.title,
        event.summary,
        event.action,
        event.from,
        event.to,
        event.queueId,
        event.saslUser,
      ].filter(Boolean).join(' ').toLowerCase().includes(filter))
    : logs.events;

  res.json({
    success: true,
    data: {
      ok: logs.ok,
      error: logs.error || '',
      events,
      raw: filter ? events.slice().reverse().map((event) => event.raw).join('\n') : logs.raw,
    },
  });
});

router.get('/queue', async (_req, res) => {
  const result = await runCommand('postqueue', ['-p'], { timeout: 6000 });
  res.json({ success: true, data: parseQueue(result.stdout || result.error || '') });
});

router.post('/queue/flush', async (_req, res) => {
  const result = await runCommand('postqueue', ['-f'], { timeout: 8000 });
  res.json({ success: result.ok, data: result });
});

router.post('/services/reload', async (_req, res) => {
  const results = await Promise.all([
    runCommand('systemctl', ['reload', 'postfix'], { timeout: 8000 }),
    runCommand('systemctl', ['restart', 'opendkim'], { timeout: 8000 }),
    runCommand('systemctl', ['restart', 'dovecot'], { timeout: 8000 }),
  ]);
  res.json({ success: results.every((item) => item.ok), data: results });
});

router.post('/test-send', async (req, res) => {
  const to = String(req.body?.to || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to) || to.length > 180) {
    return res.status(400).json({ success: false, message: 'Adresse email de test invalide' });
  }

  const credentials = await readCredentials();
  if (!credentials.password) {
    return res.status(500).json({ success: false, message: 'Mot de passe SMTP introuvable sur le VPS' });
  }

  const subject = `Scalor SMTP test ${new Date().toISOString()}`;
  const body = [
    'Test SMTP transactionnel Scalor.',
    `Serveur: ${MAIL_HOST}`,
    `Date: ${new Date().toISOString()}`,
  ].join('\n');

  const result = await smtpAuthSendTest({
    to,
    from: credentials.from || `noreply@${DOMAIN}`,
    user: credentials.user || 'smtpuser',
    password: credentials.password,
    subject,
    body,
  });

  const output = sanitizeLogLine([result.output, result.error].filter(Boolean).join('\n'));
  res.status(result.ok ? 200 : 500).json({
    success: result.ok,
    data: {
      ok: result.ok,
      output,
      status: result.ok ? 'sent_or_queued' : 'failed',
    },
  });
});

// ─── Journal des envois applicatifs (EmailSendLog — alimenté par le mailer) ──
// GET /sends?limit=&status=sent|failed&source=&q=
router.get('/sends', async (req, res) => {
  try {
    const limit = clampInt(req.query.limit, 10, 500, 100);
    const status = ['sent', 'failed'].includes(req.query.status) ? req.query.status : null;
    const source = String(req.query.source || '').trim().slice(0, 40);
    const q = String(req.query.q || '').trim().slice(0, 120);

    const filter = {};
    if (status) filter.status = status;
    if (source) filter.source = source;
    if (q) {
      const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ to: rx }, { subject: rx }, { queueId: rx }, { messageId: rx }];
    }

    const [entries, total, sent24h, failed24h, sources] = await Promise.all([
      EmailSendLog.find(filter).sort({ createdAt: -1 }).limit(limit).lean(),
      EmailSendLog.countDocuments(filter),
      EmailSendLog.countDocuments({ status: 'sent', createdAt: { $gte: new Date(Date.now() - 24 * 3600 * 1000) } }),
      EmailSendLog.countDocuments({ status: 'failed', createdAt: { $gte: new Date(Date.now() - 24 * 3600 * 1000) } }),
      EmailSendLog.distinct('source'),
    ]);

    res.json({
      success: true,
      data: {
        entries: entries.map((entry) => ({
          id: String(entry._id),
          to: entry.to,
          from: entry.from,
          subject: entry.subject,
          status: entry.status,
          source: entry.source,
          queueId: entry.queueId,
          messageId: entry.messageId,
          smtpResponse: entry.smtpResponse,
          error: entry.error,
          durationMs: entry.durationMs || 0,
          meta: entry.meta || null,
          sentAt: entry.createdAt,
        })),
        total,
        stats24h: { sent: sent24h, failed: failed24h },
        sources: sources.filter(Boolean).sort(),
        minSendGapMs: Math.max(0, Number(process.env.SMTP_MIN_SEND_GAP_MS || 3000)),
      },
    });
  } catch (error) {
    console.error('[MailServerAdmin] sends error:', error);
    res.status(500).json({ success: false, message: 'Erreur journal des envois' });
  }
});

export default router;
