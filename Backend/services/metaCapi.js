import { createHash } from 'crypto';

const SUPPORTED_META_EVENTS = new Set([
  'PageView',
  'ViewContent',
  'AddToCart',
  'InitiateCheckout',
  'Purchase',
  'Lead',
  'Search',
  'CompleteRegistration',
]);

function cleanObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;

  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => {
      if (entry == null) return false;
      if (Array.isArray(entry)) return entry.length > 0;
      if (typeof entry === 'string') return entry.trim().length > 0;
      return true;
    }),
  );
}

function normalizeHashValue(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizePhoneValue(value) {
  return String(value || '').replace(/[^0-9]/g, '');
}

function hashValue(value, normalizer = normalizeHashValue) {
  const normalized = normalizer(value);
  if (!normalized) return undefined;
  return createHash('sha256').update(normalized).digest('hex');
}

export function isSupportedMetaEvent(eventName) {
  return SUPPORTED_META_EVENTS.has(String(eventName || '').trim());
}

export function buildMetaUserData(userData = {}, requestMeta = {}) {
  const cleanedUserData = cleanObject({
    ph: userData.phone ? [hashValue(userData.phone, normalizePhoneValue)] : undefined,
    em: userData.email ? [hashValue(userData.email)] : undefined,
    fn: userData.firstName ? [hashValue(userData.firstName)] : undefined,
    ln: userData.lastName ? [hashValue(userData.lastName)] : undefined,
    ct: userData.city ? [hashValue(userData.city)] : undefined,
    country: userData.country ? [hashValue(userData.country)] : undefined,
    zp: userData.zip ? [hashValue(userData.zip)] : undefined,
    external_id: userData.externalId ? [hashValue(userData.externalId)] : undefined,
    fbp: userData.fbp ? String(userData.fbp).trim() : undefined,
    fbc: userData.fbc ? String(userData.fbc).trim() : undefined,
    client_ip_address: requestMeta.clientIpAddress || undefined,
    client_user_agent: requestMeta.clientUserAgent || undefined,
  });

  return cleanedUserData;
}

export function buildMetaEventPayload({
  eventName,
  eventId,
  eventTime = Math.floor(Date.now() / 1000),
  eventSourceUrl,
  actionSource = 'website',
  userData,
  customData,
}) {
  return cleanObject({
    event_name: eventName,
    event_time: eventTime,
    event_id: eventId,
    event_source_url: eventSourceUrl,
    action_source: actionSource,
    user_data: cleanObject(userData || {}),
    custom_data: cleanObject(customData || {}),
  });
}

export async function sendMetaCapiEvent({ pixelId, accessToken, eventPayload, testEventCode }) {
  if (!pixelId || !accessToken || !eventPayload) {
    return { skipped: true, reason: 'missing-config-or-payload' };
  }

  if (!/^\d{10,20}$/.test(String(pixelId).trim())) {
    return { skipped: true, reason: 'invalid-pixel-id' };
  }

  const url = `https://graph.facebook.com/v18.0/${String(pixelId).trim()}/events?access_token=${encodeURIComponent(accessToken)}`;
  const body = {
    data: [eventPayload],
    ...(testEventCode ? { test_event_code: testEventCode } : {}),
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const responseText = await response.text();
  if (!response.ok) {
    throw new Error(`Meta CAPI ${response.status}: ${responseText}`);
  }

  return responseText ? JSON.parse(responseText) : { success: true };
}