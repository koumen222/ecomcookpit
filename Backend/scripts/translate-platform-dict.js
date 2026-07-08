// ─── Traduction automatique du dictionnaire i18n de la plateforme admin ──────
// Usage :  cd ecomcookpit/Backend && node scripts/translate-platform-dict.js
//
// 1. Scanne scalor-next/src/ecom pour toutes les chaînes tp('…')
// 2. Ignore celles déjà traduites (platform.js, platform-common.js, platform-generated.js)
// 3. Traduit le reste en EN + ES par lots via le LLM (KIE, ou Groq en secours)
// 4. Écrit scalor-next/src/ecom/i18n/platform-generated.js (fusion incrémentale)
//
// Relançable à volonté : ne retraduit que les nouvelles chaînes.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const { callKieChatCompletion, extractKieContent, isKieConfigured } = await import('../services/kieChatService.js');

const ECOM_DIR = process.env.SCALOR_NEXT_ECOM || path.resolve(__dirname, '../../../scalor-next/src/ecom');
const GENERATED = path.join(ECOM_DIR, 'i18n/platform-generated.js');
const DICT_FILES = ['i18n/platform.js', 'i18n/platform-common.js', 'i18n/platform-generated.js'].map((f) => path.join(ECOM_DIR, f));
const BATCH = 50;
const LANGS = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Spanish' },
];

const unesc = (s) => s.replace(/\\'/g, "'").replace(/\\\\/g, '\\');

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'i18n') walk(p, out);
    } else if (entry.name.endsWith('.jsx')) out.push(p);
  }
  return out;
}

function collectUsedStrings() {
  const used = new Map(); // string → count
  for (const file of walk(ECOM_DIR)) {
    const src = fs.readFileSync(file, 'utf8');
    for (const m of src.matchAll(/\btp\('((?:[^'\\]|\\.)+)'[,)]/g)) {
      const s = unesc(m[1]);
      if (!/[A-Za-zÀ-ÿ]{2}/.test(s)) continue;
      used.set(s, (used.get(s) || 0) + 1);
    }
  }
  return used;
}

function collectDictKeys() {
  const keys = new Set();
  for (const file of DICT_FILES) {
    if (!fs.existsSync(file)) continue;
    const src = fs.readFileSync(file, 'utf8');
    for (const m of src.matchAll(/^  '((?:[^'\\]|\\.)+)':/gm)) keys.add(unesc(m[1]));
    for (const m of src.matchAll(/^  "((?:[^"\\]|\\.)+)":/gm)) keys.add(m[1]);
  }
  return keys;
}

function readGenerated() {
  const src = fs.readFileSync(GENERATED, 'utf8');
  const grab = (name) => {
    const start = src.indexOf(`export const ${name} = {`);
    const end = src.indexOf('};', start);
    const body = src.slice(start, end);
    const out = {};
    for (const m of body.matchAll(/^  '((?:[^'\\]|\\.)+)': '((?:[^'\\]|\\.)*)',$/gm)) out[unesc(m[1])] = unesc(m[2]);
    for (const m of body.matchAll(/^  "((?:[^"\\]|\\.)+)": "((?:[^"\\]|\\.)*)",$/gm)) out[m[1]] = m[2];
    return out;
  };
  return { en: grab('generatedEn'), es: grab('generatedEs') };
}

const js = (v) => (v.includes("'") ? `"${v.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"` : `'${v.replace(/\\/g, '\\\\')}'`);

function writeGenerated(en, es) {
  const dump = (obj) => Object.entries(obj)
    .sort(([a], [b]) => a.localeCompare(b, 'fr'))
    .map(([k, v]) => `  ${js(k)}: ${js(v)},`)
    .join('\n');
  const content = `'use client';

/**
 * Dictionnaire GÉNÉRÉ automatiquement — NE PAS ÉDITER À LA MAIN.
 * Rempli par : ecomcookpit/Backend/scripts/translate-platform-dict.js
 * Fusionné avec une priorité INFÉRIEURE à platform-common.js et platform.js.
 * Généré le ${new Date().toISOString()} — ${Object.keys(en).length} paires.
 */

export const generatedEn = {
${dump(en)}
};

export const generatedEs = {
${dump(es)}
};
`;
  fs.writeFileSync(GENERATED, content);
}

async function translateBatch(strings, langName) {
  const messages = [
    {
      role: 'system',
      content: `You translate UI strings of an e-commerce admin dashboard from French to ${langName}. Return ONLY a valid JSON array of strings, same length, same order. Keep placeholders like {n}, {total}, {plan} unchanged, keep emojis and punctuation style. Short, natural UI wording. No explanations.`,
    },
    { role: 'user', content: JSON.stringify(strings) },
  ];
  const data = await callKieChatCompletion({ messages, temperature: 0.2, maxTokens: 8000, reasoningEffort: 'low', timeoutMs: 90000 });
  const raw = extractKieContent(data) || '[]';
  const match = raw.match(/\[[\s\S]*\]/);
  const parsed = JSON.parse(match ? match[0] : raw);
  if (!Array.isArray(parsed) || parsed.length !== strings.length) {
    throw new Error(`lot invalide (${Array.isArray(parsed) ? parsed.length : 'non-array'}/${strings.length})`);
  }
  return parsed.map((v, i) => (typeof v === 'string' && v.trim() ? v : strings[i]));
}

// ─── Main ─────────────────────────────────────────────────────────────────────
if (!isKieConfigured()) {
  console.error('❌ KIE_API_KEY manquante dans Backend/.env');
  process.exit(1);
}

const used = collectUsedStrings();
const known = collectDictKeys();
const missing = [...used.entries()]
  .filter(([s]) => !known.has(s))
  .sort((a, b) => b[1] - a[1])
  .map(([s]) => s);

console.log(`🔎 ${used.size} chaînes tp() uniques | déjà traduites: ${used.size - missing.length} | à traduire: ${missing.length}`);
if (missing.length === 0) {
  console.log('✅ Rien à faire.');
  process.exit(0);
}

const generated = readGenerated();
let done = 0;
for (let i = 0; i < missing.length; i += BATCH) {
  const batch = missing.slice(i, i + BATCH);
  for (const lang of LANGS) {
    const target = lang.code === 'en' ? generated.en : generated.es;
    let translated;
    try {
      translated = await translateBatch(batch, lang.name);
    } catch (err) {
      console.warn(`⚠️ lot ${i / BATCH + 1} ${lang.code}: ${err.message} — 2e tentative…`);
      try {
        translated = await translateBatch(batch, lang.name);
      } catch (err2) {
        console.error(`❌ lot ${i / BATCH + 1} ${lang.code} abandonné: ${err2.message}`);
        continue;
      }
    }
    batch.forEach((s, j) => { target[s] = translated[j]; });
  }
  done += batch.length;
  writeGenerated(generated.en, generated.es); // sauvegarde incrémentale — interruption sans perte
  console.log(`🌍 ${done}/${missing.length} traduites (en+es) — sauvegardé`);
}

console.log(`✅ Terminé. ${Object.keys(generated.en).length} paires dans platform-generated.js`);
console.log('→ Recharge le frontend : toute la plateforme est traduite.');
