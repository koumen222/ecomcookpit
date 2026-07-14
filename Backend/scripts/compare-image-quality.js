/**
 * Comparatif qualité gpt-image-2 : même prompt en low / medium / high.
 * Usage : node scripts/compare-image-quality.js
 * Sortie : Backend/tmp-image-compare/{low,medium,high}.jpg + compare.html (côte à côte)
 */
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdirSync, writeFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../.env') });

const key = process.env.OPENAI_IMAGE_API_KEY || process.env.OPENAI_API_KEY;
if (!key) { console.error('❌ OPENAI_IMAGE_API_KEY absente du .env'); process.exit(1); }

const outDir = join(__dirname, '../tmp-image-compare');
mkdirSync(outDir, { recursive: true });

const prompt = "Photo produit e-commerce professionnelle : flacon de sérum cosmétique en verre ambré avec pipette dorée, posé sur un socle en pierre, fond studio vert sauge dégradé, ombre douce, éclairage premium, étiquette élégante avec le texte 'SÉRUM ÉCLAT'";

async function gen(quality) {
  const t0 = Date.now();
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: process.env.OPENAI_IMAGE_MODEL || 'gpt-image-2', prompt, size: '1024x1024', quality, output_format: 'jpeg' }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`${quality}: ${res.status} ${data?.error?.message || ''}`);
  const b64 = data?.data?.[0]?.b64_json;
  if (!b64) throw new Error(`${quality}: réponse sans image`);
  const buf = Buffer.from(b64, 'base64');
  writeFileSync(join(outDir, `${quality}.jpg`), buf);
  const secs = Math.round((Date.now() - t0) / 1000);
  console.log(`✅ ${quality.padEnd(6)} — ${secs}s, ${Math.round(buf.length / 1024)}KB`);
  return { quality, secs, kb: Math.round(buf.length / 1024) };
}

console.log('Génération low / medium / high en parallèle (même prompt, 1024x1024)…');
const results = await Promise.allSettled([gen('low'), gen('medium'), gen('high')]);
const ok = results.filter(r => r.status === 'fulfilled').map(r => r.value);
results.filter(r => r.status === 'rejected').forEach(r => console.error('❌', r.reason.message));

const html = `<!doctype html><meta charset="utf-8"><title>Comparatif qualité gpt-image-2</title>
<body style="font-family:system-ui;background:#f6f7f9;padding:24px">
<h2>Même prompt — low vs medium vs high (1024×1024)</h2>
<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;max-width:1400px">
${['low', 'medium', 'high'].map(q => {
  const r = ok.find(x => x.quality === q);
  return `<figure style="margin:0;background:#fff;border-radius:12px;padding:12px;box-shadow:0 1px 4px rgba(0,0,0,.08)">
    <img src="${q}.jpg" style="width:100%;border-radius:8px" alt="${q}">
    <figcaption style="margin-top:8px;font-weight:700">${q.toUpperCase()}${r ? ` — ${r.secs}s · ${r.kb}KB` : ' — échec'}</figcaption>
  </figure>`;
}).join('')}
</div></body>`;
writeFileSync(join(outDir, 'compare.html'), html);
console.log(`\n📂 Résultats : ${outDir}/compare.html — ouvre ce fichier dans ton navigateur.`);
