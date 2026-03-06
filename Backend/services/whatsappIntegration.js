// =====================================================
// ✅ WhatsApp Integration Service — SaaS Consumer
// Uses Evolution API at https://api.ecomcookpit.site
// Auth: Bearer <instance apiKey>
// =====================================================

import axios from 'axios';

const API_BASE = 'https://api.ecomcookpit.site';




/**
 * Verify a WhatsApp instance connection
 * @param {{ instanceId: string, apiKey: string }} config
 * @returns {Promise<object>} API response data
 */
export async function verifyWhatsAppConfig({ instanceId, apiKey }) {
  console.log("\n================ VERIFY WHATSAPP CONFIG ================");
  console.log("🔎 Instance ID:", instanceId);
  console.log("🔑 API Key present:", apiKey ? "YES" : "NO");

  // ===== DEBUG API KEY =====
  console.log("========== API KEY DEBUG ==========");
  
  if (!apiKey) {
    console.log("❌ apiKey is NULL or UNDEFINED");
  } else {
    console.log("✅ apiKey exists");
    console.log("Length:", apiKey.length);
    console.log("Type:", typeof apiKey);
    console.log("Starts with:", apiKey.substring(0, 12));
    console.log("Ends with:", apiKey.substring(apiKey.length - 6));
    console.log("Has spaces:", apiKey.includes(" "));
    console.log("Raw value:", apiKey); // ⚠️ DEV ONLY
  }
  
  console.log("Authorization Header:", `Bearer ${apiKey}`);
  console.log("===================================");

  if (!instanceId || !apiKey) {
    console.log("❌ Missing credentials");
    throw new Error("MISSING_CREDENTIALS");
  }

  const url = `${API_BASE}/api/instance/status`;

  console.log("🌍 Calling:", url);

  try {
    const response = await axios({
      method: "POST",
      url,
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      data: { instanceId }
    });

    console.log("Sent headers:", response.config.headers);
    console.log("📡 Status:", response.status);
    console.log("✅ Instance verified");
    console.log("========================================================\n");

    return response.data;
  } catch (err) {
    const status = err?.response?.status;
    const raw = err?.response?.data;

    console.log("Sent headers:", err?.config?.headers);
    console.log("📡 Status:", status);
    console.log("📡 Raw response:", typeof raw === 'string' ? raw : JSON.stringify(raw));
    console.log("❌ Verification failed");

    if (status === 401) throw new Error("INVALID_TOKEN");
    if (status === 404) throw new Error("INSTANCE_NOT_FOUND");
    throw new Error("INSTANCE_VERIFICATION_FAILED");
  }

}

/**
 * Normalize phone number to international format
 * @param {string} phone 
 * @param {string} countryCode default "237" (Cameroon)
 * @returns {string}
 */
function normalizePhone(phone, countryCode = "237") {
  let p = String(phone).replace(/[^\d]/g, "");
  if (p.startsWith("00")) p = p.slice(2);
  if (p.startsWith("0")) p = p.slice(1);
  if (p.length === 9 && p.startsWith("6")) p = countryCode + p;
  if (!p.startsWith(countryCode) && p.length < 11) p = countryCode + p;
  return p;
}

/**
 * Send a WhatsApp message via Evolution API
 * @param {{ instanceId: string, apiKey: string }} waConfig - from workspace.whatsapp
 * @param {string} number - phone number
 * @param {string} text - message content
 * @returns {Promise<object>} API response data
 */
export async function sendWhatsAppMessageV2({ instanceId, apiKey }, number, text) {
  console.log("\n================ SEND WHATSAPP ================");
  console.log("📱 Instance:", instanceId);

  if (!instanceId || !apiKey) {
    console.log("❌ Missing WhatsApp config");
    throw new Error("WHATSAPP_NOT_CONFIGURED");
  }

  const cleanNumber = normalizePhone(number);
  console.log("📞 Number:", cleanNumber);
  console.log("💬 Text length:", text?.length || 0);

  const fetchModule = await import('node-fetch');
  const fetch = fetchModule.default;

  const url = `${API_BASE}/api/message/sendText`;

  const payload = {
    instanceId,
    number: cleanNumber,
    text
  };

  console.log("🌍 POST", url);
  console.log("📦 Payload:", JSON.stringify(payload, null, 2));

  // ✅ Use EVOLUTION_GLOBAL_API_KEY for authentication
  const globalKey = process.env.EVOLUTION_GLOBAL_API_KEY?.trim();
  if (!globalKey) {
    console.log("❌ EVOLUTION_GLOBAL_API_KEY missing in .env");
    throw new Error("MISSING_GLOBAL_API_KEY");
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": globalKey
    },
    body: JSON.stringify(payload)
  });

  const raw = await res.text();

  console.log("📡 Status:", res.status);
  console.log("📡 Response:", raw);

  if (!res.ok) {
    console.log("❌ Send failed");
    if (res.status === 401) throw new Error("INVALID_TOKEN");
    if (res.status === 404) throw new Error("INSTANCE_NOT_FOUND");
    throw new Error(`WHATSAPP_SEND_FAILED (HTTP ${res.status})`);
  }

  const data = JSON.parse(raw);

  console.log("✅ Message sent successfully");
  console.log("🆔 Message ID:", data?.data?.messageId || "N/A");
  console.log("================================================\n");

  return data;
}

export { normalizePhone };
