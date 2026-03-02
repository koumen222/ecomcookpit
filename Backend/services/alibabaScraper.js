/**
 * Alibaba Scraper avec scrape.do API
 * Plus fiable que Puppeteer, pas de gestion de Chromium
 * API: https://scrape.do/
 */

import { JSDOM } from 'jsdom';

const SCRAPE_DO_TOKEN = process.env.SCRAPE_DO_TOKEN 
const SCRAPE_DO_API = 'https://api.scrape.do/';

export async function scrapeAlibaba(url) {
  if (!SCRAPE_DO_TOKEN) {
    throw new Error('SCRAPE_DO_TOKEN non configuré. Ajoutez-le dans votre .env');
  }
  
  console.log('🚀 Scrape.do scraping:', url);

  try {
    // URL encode pour scrape.do
    const encodedUrl = encodeURIComponent(url);
    const scrapeUrl = `${SCRAPE_DO_API}?token=${SCRAPE_DO_TOKEN}&url=${encodedUrl}&render=true&customWait=2000&device=desktop&super=true`;

    console.log('� Calling scrape.do API...');
    const response = await fetch(scrapeUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      timeout: 60000
    });

    if (!response.ok) {
      throw new Error(`scrape.do API error: ${response.status} ${response.statusText}`);
    }

    const html = await response.text();
    console.log('✅ HTML received, length:', html.length);

    if (html.length < 1000) {
      throw new Error('Réponse HTML trop courte - page probablement bloquée');
    }

    // Parse HTML avec JSDOM
    const dom = new JSDOM(html);
    const document = dom.window.document;

    // Extraction du titre
    let title = '';
    const titleSelectors = [
      'h1',
      '.product-title', 
      '.title-module h1',
      '.gallery-offer-title',
      '.pdp-product-name',
      '[data-spm-anchor-id] h1'
    ];

    for (const sel of titleSelectors) {
      const el = document.querySelector(sel);
      if (el?.textContent?.trim()) {
        title = el.textContent.trim()
          .replace(/\s*[|–-]\s*Alibaba.*$/i, '')
          .replace(/\s*\|\s*.*$/, '')
          .trim();
        break;
      }
    }

    // Fallback: balise <title>
    if (!title || title.length < 3) {
      title = (document.title || '')
        .replace(/\s*[|–-]\s*Alibaba.*$/i, '')
        .replace(/\s*\|\s*.*$/, '')
        .trim();
    }

    // Extraction des images
    const imgElements = Array.from(document.querySelectorAll('img'));
    const images = imgElements
      .map(img => img.src || img.getAttribute('data-src') || img.getAttribute('data-lazy') || '')
      .filter(src => 
        src && 
        (src.includes('alicdn.com') || src.includes('alibaba.com')) && 
        !src.includes('icon') && 
        !src.includes('logo') &&
        !src.includes('avatar') &&
        src.length > 20
      )
      .slice(0, 8)
      .map(src => {
        if (src.startsWith('//')) return 'https:' + src;
        if (src.startsWith('/')) return 'https://www.alibaba.com' + src;
        return src;
      })
      .filter(src => src.startsWith('http'));

    // Extraction description (meta)
    const metaDesc = document.querySelector('meta[name="description"]');
    const description = (metaDesc?.content || '').slice(0, 500);

    // Extraction du texte brut (pour GPT)
    const clone = document.body.cloneNode(true);
    const scripts = clone.querySelectorAll('script, style, nav, header, footer, .nav, .header, .footer');
    scripts.forEach(el => el.remove());
    
    const rawText = (clone.textContent || '')
      .replace(/\s{2,}/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
      .slice(0, 3000);

    console.log('✅ Scraping completed:', { 
      title: title?.slice(0, 60), 
      images: images.length,
      rawLength: rawText.length 
    });

    if (!title || title.length < 3) {
      throw new Error('Titre non trouvé - page Alibaba invalide ou bloquée');
    }

    if (rawText.length < 50) {
      throw new Error('Contenu insuffisant - page probablement bloquée par Alibaba');
    }

    return { 
      url, 
      title, 
      description, 
      images, 
      specs: {}, 
      rawText 
    };

  } catch (error) {
    console.error('❌ scrape.do scraping failed:', error.message);
    
    if (error.message.includes('timeout') || error.message.includes('TIMEOUT')) {
      throw new Error('Timeout - Alibaba met trop de temps à répondre. Réessayez dans 30s.');
    }
    
    if (error.message.includes('403') || error.message.includes('blocked') || error.message.includes('bloqué')) {
      throw new Error('Alibaba a temporairement bloqué l\'accès. Attendez 1 minute et réessayez.');
    }
    
    if (error.message.includes('429') || error.message.includes('rate limit')) {
      throw new Error('Limite de requêtes atteinte. Attendez quelques minutes.');
    }

    if (error.message.includes('API error')) {
      throw new Error('Service de scraping temporairement indisponible. Réessayez plus tard.');
    }
    
    throw new Error(`Erreur scraping: ${error.message}`);
  }
}
