/**
 * Alibaba Scraper with Puppeteer + Stealth
 * Contourne les blocages anti-bot d'Alibaba en imitant un vrai navigateur
 */

import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

// Active le plugin stealth pour éviter la détection bot
puppeteer.use(StealthPlugin());

export async function scrapeAlibaba(url) {
  let browser;
  
  try {
    console.log('🚀 Puppeteer scraping:', url);
    
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    });

    const page = await browser.newPage();
    
    // User-Agent réaliste
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );
    
    // Viewport réaliste
    await page.setViewport({ width: 1920, height: 1080 });
    
    // Bloque les ressources non-critiques pour aller plus vite
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const resourceType = req.resourceType();
      if (['font', 'stylesheet', 'media'].includes(resourceType)) {
        req.abort();
      } else {
        req.continue();
      }
    });

    console.log('📡 Navigation vers Alibaba...');
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    // Attendre que le titre soit chargé
    await page.waitForSelector('h1, .product-title, [data-spm-anchor-id]', { timeout: 15000 });
    
    console.log('🔍 Extraction des données...');
    
    // Extraction du titre (plusieurs sélecteurs possibles)
    const title = await page.evaluate(() => {
      const selectors = [
        'h1',
        '.product-title',
        '[data-spm-anchor-id*="title"]',
        '.title-module h1',
        '.product-overview-title',
        '.gallery-offer-title'
      ];
      
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el && el.innerText?.trim()) {
          return el.innerText.trim()
            .replace(/\s*[|–-]\s*Alibaba.*$/i, '')
            .replace(/\s*\|\s*.*$/, '')
            .trim();
        }
      }
      return '';
    });

    // Extraction des images Alibaba CDN
    const images = await page.evaluate(() => {
      const imgs = Array.from(document.querySelectorAll('img'));
      return imgs
        .map(img => img.src || img.dataset.src || img.dataset.original)
        .filter(src => src && src.includes('alicdn.com'))
        .filter(src => !src.includes('icon') && !src.includes('logo') && !src.includes('avatar'))
        .slice(0, 6)
        .map(src => src.startsWith('//') ? 'https:' + src : src);
    });

    // Extraction description/specs basique
    const description = await page.evaluate(() => {
      const selectors = [
        'meta[name="description"]',
        '.product-description',
        '.overview-content',
        '.product-overview'
      ];
      
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el) {
          const content = el.content || el.innerText || el.textContent;
          if (content?.trim()) return content.trim().slice(0, 500);
        }
      }
      return '';
    });

    // Extraction du texte brut de la page (pour GPT context)
    const rawText = await page.evaluate(() => {
      const body = document.body;
      if (!body) return '';
      
      // Supprime scripts/styles/nav
      const clonedBody = body.cloneNode(true);
      const unwanted = clonedBody.querySelectorAll('script, style, nav, header, footer, .navigation');
      unwanted.forEach(el => el.remove());
      
      return clonedBody.innerText
        .replace(/\s{2,}/g, ' ')
        .trim()
        .slice(0, 3000);
    });

    console.log('✅ Scraping terminé:', { title: title.slice(0, 50), images: images.length });

    if (!title || title.length < 3) {
      throw new Error('Titre non trouvé - page possiblement bloquée');
    }

    return {
      url,
      title,
      description,
      images,
      specs: {}, // Puppeteer peut extraire plus de specs si besoin
      rawText
    };

  } catch (error) {
    console.warn('❌ Puppeteer scraping failed:', error.message);
    
    if (error.message.includes('timeout')) {
      throw new Error('Timeout - Alibaba met trop de temps à charger');
    } else if (error.message.includes('blocked') || error.message.includes('Titre non trouvé')) {
      throw new Error('Alibaba a bloqué le scraping. Essayez une autre URL ou attendez 30 secondes.');
    } else {
      throw new Error(`Erreur scraping: ${error.message}`);
    }
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Fonction de fallback si Puppeteer échoue (garde l'ancien système)
export async function scrapeAlibabaFallback(url) {
  const result = { url, title: '', description: '', images: [], specs: {}, rawText: '' };
  
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 15000);
    
    const resp = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,fr;q=0.8',
        'Cache-Control': 'no-cache'
      }
    });
    clearTimeout(t);

    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}`);
    }

    const html = await resp.text();
    
    // Extraction basique comme avant
    const titleMatch = html.match(/<title[^>]*>([^<]{3,200})<\/title>/i);
    result.title = (titleMatch?.[1] || '')
      .replace(/\s*[|–-]\s*Alibaba.*$/i, '')
      .replace(/\s*\|\s*.*$/, '')
      .trim();

    if (!result.title) {
      throw new Error('Titre non trouvé avec fetch fallback');
    }

    return result;
    
  } catch (err) {
    throw new Error(`Fallback failed: ${err.message}`);
  }
}
