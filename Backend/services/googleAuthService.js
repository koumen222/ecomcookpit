const FRONTEND_FALLBACK_GOOGLE_CLIENT_ID = '559924689181-rpkv8ji3029kvrtsvt3qceusmsh1i4p2.apps.googleusercontent.com';

function splitClientIds(value = '') {
  return String(value || '')
    .split(/[\s,]+/)
    .map((item) => item.trim().replace(/^['"]|['"]$/g, ''))
    .filter(Boolean);
}

export function getGoogleClientIds() {
  return [
    ...splitClientIds(process.env.GOOGLE_CLIENT_IDS),
    ...splitClientIds(process.env.GOOGLE_CLIENT_ID),
    ...splitClientIds(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID),
    ...splitClientIds(process.env.VITE_GOOGLE_CLIENT_ID),
    FRONTEND_FALLBACK_GOOGLE_CLIENT_ID,
  ].filter((value, index, list) => list.indexOf(value) === index);
}

export function maskGoogleClientId(clientId = '') {
  const [projectNumber, suffix] = String(clientId).split('-', 2);
  if (!projectNumber || !suffix) return 'invalid-client-id';
  return `${projectNumber.slice(0, 4)}…${projectNumber.slice(-3)}-${suffix.slice(0, 6)}…`;
}

export function formatGoogleClientIdsForLog(clientIds = getGoogleClientIds()) {
  return clientIds.map(maskGoogleClientId).join(', ');
}

export async function verifyGoogleIdToken(credential) {
  const allowedAudiences = getGoogleClientIds();
  if (!allowedAudiences.length) {
    const error = new Error('GOOGLE_CLIENT_ID non configuré');
    error.code = 'GOOGLE_CLIENT_ID_MISSING';
    throw error;
  }

  const { OAuth2Client } = await import('google-auth-library');
  const client = new OAuth2Client();

  const ticket = await client.verifyIdToken({
    idToken: credential,
    audience: allowedAudiences.length === 1 ? allowedAudiences[0] : allowedAudiences,
  });

  return {
    ticket,
    payload: ticket.getPayload(),
    allowedAudiences,
  };
}
