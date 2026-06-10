import axios from 'axios';

const KIE_API_KEY   = process.env.KIE_API_KEY || process.env.NANOBANANA_PRO_API_KEY || '';
const KIE_BASE      = 'https://api.kie.ai/api/v1/jobs';
const MODEL         = 'gpt-image-2-text-to-image';
const POLL_INTERVAL = 4000;
const MAX_WAIT_MS   = 180000; // 3 min

export function isKieImageConfigured() {
  return !!KIE_API_KEY;
}

function extractUrl(data) {
  try {
    const parsed = typeof data.resultJson === 'string'
      ? JSON.parse(data.resultJson) : (data.resultJson || {});
    const candidates = [
      ...(Array.isArray(parsed?.resultUrls) ? parsed.resultUrls : [parsed?.resultUrls]),
      ...(Array.isArray(parsed?.images)     ? parsed.images     : [parsed?.images]),
      parsed?.output, parsed?.url,
    ].filter(u => typeof u === 'string' && /^https?:\/\//i.test(u));
    if (candidates[0]) return candidates[0];
  } catch {}
  return data.resultUrl || data.result_url || data.imageUrl || data.image_url || data.url || null;
}

/**
 * Generate an image via KIE GPT Image 2 (text-to-image).
 * Returns the image URL string, or throws.
 *
 * @param {string} prompt
 * @param {string} aspectRatio  e.g. '3:4', '1:1', '16:9'
 */
export async function generateKieGptImage2(prompt, aspectRatio = '1:1') {
  if (!KIE_API_KEY) throw new Error('KIE_API_KEY not configured');

  const truncated = String(prompt).slice(0, 20000);

  // 1. Submit
  const submitRes = await axios.post(
    `${KIE_BASE}/createTask`,
    { model: MODEL, input: { prompt: truncated, aspect_ratio: aspectRatio, resolution: '1K' } },
    { headers: { 'Authorization': `Bearer ${KIE_API_KEY}`, 'Content-Type': 'application/json' }, timeout: 30000 }
  );

  if (submitRes.data?.code !== 200 || !submitRes.data?.data?.taskId) {
    const msg = submitRes.data?.msg || submitRes.data?.message || 'task creation failed';
    throw new Error(`KIE GPT Image 2 submit: ${msg}`);
  }

  const taskId = submitRes.data.data.taskId;
  console.log(`[KieImage] GPT Image 2 task: ${taskId} (${aspectRatio})`);

  // 2. Poll
  const deadline = Date.now() + MAX_WAIT_MS;
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL));

    const pollRes = await axios.get(
      `${KIE_BASE}/recordInfo`,
      { params: { taskId }, headers: { 'Authorization': `Bearer ${KIE_API_KEY}` }, timeout: 15000 }
    );

    const data = pollRes.data?.data;
    if (!data) continue;

    if (data.state === 'success' || data.state === 'completed') {
      const url = extractUrl(data);
      if (!url) throw new Error('KIE GPT Image 2: task succeeded but no URL found');
      console.log(`[KieImage] Done: ${url.slice(0, 80)}…`);
      return url;
    }

    if (data.state === 'fail' || data.state === 'failed' || data.state === 'error') {
      throw new Error(`KIE GPT Image 2 task failed: ${data.failMsg || data.failCode || 'unknown'}`);
    }

    console.log(`[KieImage] ${taskId} state=${data.state} elapsed=${Math.round((Date.now() - (deadline - MAX_WAIT_MS)) / 1000)}s`);
  }

  throw new Error('KIE GPT Image 2: timeout after 3 min');
}
