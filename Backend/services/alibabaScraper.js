/**
 * Alibaba Scraper with Puppeteer
 * Utilise Chromium installé via Nixpacks sur Railway
 * PUPPETEER_SKIP_DOWNLOAD=true → utilise le Chromium système, pas le bundled
 */

import puppeteer from 'puppeteer';
import { execSync } from 'child_process';

// Résolution dynamique du chemin Chromium installé par Nixpacks/Nix sur Railway
function getChromiumPath() {
  // Variable d'env prioritaire (configurable dans Railway Dashboard)
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  // Cherche chromium dans le PATH (installé par Nixpacks)
  try {
    const path = execSync('which chromium', { timeout: 3000 }).toString().trim();
    if (path) return path;
  } catch (_) {}
  // Fallback paths Nix courants
  const fallbacks = [
    '/run/current-system/sw/bin/chromium',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome-stable'
  ];
  for (const p of fallbacks) {
    try { execSync(`test -x ${p}`, { timeout: 1000 }); return p; } catch (_) {}
  }
  return undefined; // laisse Puppeteer trouver tout seul
}

export async function scrapeAlibaba(url) {
  let browser;
  const chromiumPath = getChromiumPath();
  console.log('🚀 Puppeteer scraping:', url);
  console.log('🔧 Chromium path:', chromiumPath || 'auto-detect');

  try {
    browser = await puppeteer.launch({
      executablePath: chromiumPath,
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-extensions'
      ]
    });
    console.log('✅ Browser launched successfully');

    const page = await browser.newPage();

    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );
    await page.setViewport({ width: 1920, height: 1080 });

    // Bloque fonts/styles/media pour charger plus vite
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      if (['font', 'stylesheet', 'media'].includes(req.resourceType())) {
        req.abort();
      } else {
        req.continue();
      }
    });

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
    console.log('✅ Page loaded');

    await page.waitForSelector('h1, .product-title, title', { timeout: 15000 });

    const title = await page.evaluate(() => {
      for (const sel of ['h1', '.product-title', '.title-module h1', '.gallery-offer-title']) {
        const el = document.querySelector(sel);
        if (el?.innerText?.trim()) {
          return el.innerText.trim()
            .replace(/\s*[|–-]\s*Alibaba.*$/i, '')
            .replace(/\s*\|\s*.*$/, '')
            .trim();
        }
      }
      // Fallback: <title> tag
      return (document.title || '')
        .replace(/\s*[|–-]\s*Alibaba.*$/i, '')
        .replace(/\s*\|\s*.*$/, '')
        .trim();
    });

    const images = await page.evaluate(() =>
      Array.from(document.querySelectorAll('img'))
        .map(img => img.src || img.dataset.src || '')
        .filter(src => src.includes('alicdn.com') && !src.includes('icon') && !src.includes('logo'))
        .slice(0, 6)
        .map(src => src.startsWith('//') ? 'https:' + src : src)
    );

    const description = await page.evaluate(() => {
      const meta = document.querySelector('meta[name="description"]');
      return (meta?.content || '').slice(0, 500);
    });

    const rawText = await page.evaluate(() => {
      const clone = document.body.cloneNode(true);
      clone.querySelectorAll('script, style, nav, header, footer').forEach(el => el.remove());
      return (clone.innerText || '').replace(/\s{2,}/g, ' ').trim().slice(0, 3000);
    });

    console.log('✅ Scraping completed:', { title: title?.slice(0, 60), images: images.length });

    if (!title || title.length < 3) {
      throw new Error('Titre non trouvé - Alibaba a peut-être bloqué la requête');
    }

    return { url, title, description, images, specs: {}, rawText };

  } catch (error) {
    console.warn('❌ Puppeteer scraping failed:', error.message);
    if (error.message.includes('timeout') || error.message.includes('Timeout')) {
      throw new Error('Timeout - Alibaba met trop de temps à charger. Réessayez.');
    }
    if (error.message.includes('Titre non trouvé') || error.message.includes('bloqué')) {
      throw new Error('Alibaba a bloqué le scraping. Attendez 30 secondes et réessayez.');
    }
    throw new Error(`Erreur scraping: ${error.message}`);
  } finally {
    if (browser) await browser.close();
  }
}
