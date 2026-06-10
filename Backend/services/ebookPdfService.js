import { Upload } from '@aws-sdk/lib-storage';
import { randomUUID } from 'crypto';
import axios from 'axios';
import sharp from 'sharp';
import { s3Client, R2_CONFIG, getR2PublicUrl } from '../config/r2.js';
import { generateNanoBananaImage } from './nanoBananaService.js';

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN_X = 54;
const MARGIN_BOTTOM = 58;
const TOP_Y = 775;

const cleanText = (value = '', max = 5000) => String(value || '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ')
  .replace(/&amp;/g, '&')
  .replace(/\s+/g, ' ')
  .trim()
  .slice(0, max);

const slugify = (value = 'ebook') => cleanText(value, 120)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '')
  .slice(0, 80) || 'ebook';

const hexText = (value = '') => {
  const bytes = Buffer.from(`\uFEFF${String(value)}`, 'utf16le');
  for (let i = 0; i < bytes.length; i += 2) {
    const current = bytes[i];
    bytes[i] = bytes[i + 1];
    bytes[i + 1] = current;
  }
  return `<${bytes.toString('hex').toUpperCase()}>`;
};

const rgb = (hex = '#0F766E') => {
  const safe = String(hex || '').replace('#', '').trim();
  const full = safe.length === 3
    ? safe.split('').map((char) => `${char}${char}`).join('')
    : safe.padEnd(6, '0').slice(0, 6);
  const value = Number.parseInt(full, 16);
  if (!Number.isFinite(value)) return [0.06, 0.46, 0.43];
  return [
    ((value >> 16) & 255) / 255,
    ((value >> 8) & 255) / 255,
    (value & 255) / 255,
  ];
};

function wrapText(text = '', fontSize = 12, width = PAGE_WIDTH - (MARGIN_X * 2)) {
  const maxChars = Math.max(20, Math.floor(width / (fontSize * 0.52)));
  const paragraphs = String(text || '').split(/\n+/).map((p) => cleanText(p, 1800)).filter(Boolean);
  const lines = [];

  paragraphs.forEach((paragraph, paragraphIndex) => {
    let current = '';
    paragraph.split(/\s+/).forEach((word) => {
      if (word.length > maxChars) {
        if (current) lines.push(current);
        for (let i = 0; i < word.length; i += maxChars) lines.push(word.slice(i, i + maxChars));
        current = '';
        return;
      }
      const next = current ? `${current} ${word}` : word;
      if (next.length > maxChars) {
        if (current) lines.push(current);
        current = word;
      } else {
        current = next;
      }
    });
    if (current) lines.push(current);
    if (paragraphIndex < paragraphs.length - 1) lines.push('');
  });

  return lines;
}

function createPdfDocument() {
  const pages = [];
  let current = '';
  let y = TOP_Y;

  const addPage = () => {
    if (current) pages.push(current);
    current = '';
    y = TOP_Y;
  };

  const ensure = (height = 24) => {
    if (y - height < MARGIN_BOTTOM) addPage();
  };

  const rect = (x, rectY, w, h, color) => {
    const [r, g, b] = color;
    current += `${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg\n${x.toFixed(2)} ${rectY.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f\n`;
  };

  const line = (text, x, lineY, size = 12, font = 'F1', color = [0.07, 0.09, 0.15]) => {
    const [r, g, b] = color;
    current += `${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg\nBT /${font} ${size} Tf ${x.toFixed(2)} ${lineY.toFixed(2)} Td ${hexText(text)} Tj ET\n`;
  };

  const textBlock = (text, { size = 12, font = 'F1', color = [0.14, 0.16, 0.22], gap = 16, leading = null, width = PAGE_WIDTH - (MARGIN_X * 2), x = MARGIN_X } = {}) => {
    const resolvedLeading = leading || Math.round(size * 1.45);
    const lines = wrapText(text, size, width);
    lines.forEach((entry) => {
      ensure(resolvedLeading);
      if (entry) line(entry, x, y, size, font, color);
      y -= resolvedLeading;
    });
    y -= gap;
  };

  const heading = (text, { size = 20, color = [0.05, 0.45, 0.40], gap = 16 } = {}) => {
    ensure(size + gap + 12);
    wrapText(text, size, PAGE_WIDTH - (MARGIN_X * 2)).forEach((entry) => {
      line(entry, MARGIN_X, y, size, 'F2', color);
      y -= Math.round(size * 1.18);
    });
    y -= gap;
  };

  const pageBreak = () => addPage();

  return {
    pages,
    addPage,
    rect,
    line,
    textBlock,
    heading,
    pageBreak,
    getY: () => y,
    setY: (nextY) => { y = nextY; },
    addCoverImageCmd: () => {
      current += `q ${PAGE_WIDTH.toFixed(2)} 0 0 ${PAGE_HEIGHT.toFixed(2)} 0 0 cm /CoverImg Do Q\n`;
    },
    finish: () => {
      if (current) pages.push(current);
      return pages;
    },
  };
}

function buildPdfBuffer(pageContents = [], coverImageJpegBuffer = null) {
  const objects = [];
  const addObject = (body) => {
    objects.push(body);
    return objects.length;
  };

  addObject('<< /Type /Catalog /Pages 2 0 R >>');
  addObject('PAGES_PLACEHOLDER');
  addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');

  // Embed cover image as XObject (object 5) if provided
  let hasCoverImage = false;
  if (coverImageJpegBuffer && Buffer.isBuffer(coverImageJpegBuffer) && coverImageJpegBuffer.length > 0) {
    hasCoverImage = true;
    // Raw binary JPEG stream — width/height from buffer parsed elsewhere
    objects.push(`<< /Type /XObject /Subtype /Image /Width 595 /Height 842 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${coverImageJpegBuffer.length} >>\nstream\nCOVER_IMAGE_PLACEHOLDerendstream`);
  }

  const kids = [];
  pageContents.forEach((content, pageIndex) => {
    const pageObjectNumber = objects.length + 1;
    const contentObjectNumber = objects.length + 2;
    kids.push(`${pageObjectNumber} 0 R`);

    // First page: add cover image XObject to resources if present
    if (pageIndex === 0 && hasCoverImage) {
      addObject(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> /XObject << /CoverImg 5 0 R >> >> /Contents ${contentObjectNumber} 0 R >>`);
    } else {
      addObject(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentObjectNumber} 0 R >>`);
    }
    addObject(`<< /Length ${Buffer.byteLength(content, 'utf8')} >>\nstream\n${content}endstream`);
  });

  objects[1] = `<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${kids.length} >>`;

  // Build binary PDF — cover image must be embedded as raw binary
  const headerStr = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
  const parts = [Buffer.from(headerStr, 'binary')];
  const offsets = [0];

  objects.forEach((body, index) => {
    offsets.push(parts.reduce((sum, p) => sum + p.length, 0));
    const objNum = index + 1;
    if (hasCoverImage && index === 4) {
      // Object 5: embed raw JPEG binary
      const prefix = `${objNum} 0 obj\n<< /Type /XObject /Subtype /Image /Width 595 /Height 842 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${coverImageJpegBuffer.length} >>\nstream\n`;
      const suffix = `\nendstream\nendobj\n`;
      parts.push(Buffer.from(prefix, 'binary'));
      parts.push(coverImageJpegBuffer);
      parts.push(Buffer.from(suffix, 'binary'));
    } else {
      parts.push(Buffer.from(`${objNum} 0 obj\n${body}\nendobj\n`, 'binary'));
    }
  });

  const xrefOffset = parts.reduce((sum, p) => sum + p.length, 0);
  let xrefStr = `xref\n0 ${objects.length + 1}\n`;
  xrefStr += '0000000000 65535 f \n';
  offsets.slice(1).forEach((offset) => {
    xrefStr += `${String(offset).padStart(10, '0')} 00000 n \n`;
  });
  xrefStr += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  parts.push(Buffer.from(xrefStr, 'binary'));

  return Buffer.concat(parts);
}

export function generateEbookPdfBuffer(ebook = {}, productData = {}, storeContext = {}, coverImageJpegBuffer = null) {
  const doc = createPdfDocument();
  const cover = ebook.cover || {};
  const palette = Array.isArray(cover.color_palette) && cover.color_palette[0] ? cover.color_palette[0] : '#0F766E';
  const accent = rgb(palette);
  const dark = [0.06, 0.09, 0.16];
  const soft = [0.36, 0.40, 0.48];
  const title = cleanText(ebook.title || cover.cover_title || `Guide ${productData.title || productData.name || 'produit'}`, 160);
  const subtitle = cleanText(ebook.subtitle || cover.cover_subtitle || ebook.short_description, 260);
  const brand = cleanText(cover.author_or_brand || storeContext.shopName || 'Scalor', 90);
  const productName = cleanText(productData.title || productData.name || '', 140);

  if (coverImageJpegBuffer) {
    // Full-page cover image with dark overlay for text legibility
    doc.addCoverImageCmd();
    // Dark overlay on bottom 55% of page for text legibility
    doc.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT * 0.55, [0.05, 0.07, 0.12]);
    // Dark gradient strip at top for badge
    doc.rect(0, PAGE_HEIGHT - 70, PAGE_WIDTH, 70, [0.04, 0.06, 0.12]);
  } else {
    // Fallback: solid colored header band
    doc.rect(0, PAGE_HEIGHT - 190, PAGE_WIDTH, 190, accent);
  }

  doc.line('EBOOK BONUS', MARGIN_X, 735, 13, 'F2', [1, 1, 1]);
  wrapText(title, 28, PAGE_WIDTH - (MARGIN_X * 2)).slice(0, 3).forEach((entry, index) => {
    doc.line(entry, MARGIN_X, 690 - (index * 35), 28, 'F2', [1, 1, 1]);
  });
  doc.setY(575);
  if (subtitle) doc.textBlock(subtitle, { size: 14, font: 'F1', color: [1, 1, 1], x: MARGIN_X, width: PAGE_WIDTH - (MARGIN_X * 2), gap: 12, leading: 19 });
  doc.setY(520);
  if (productName) doc.textBlock(`Produit associe : ${productName}`, { size: 13, font: 'F2', color: coverImageJpegBuffer ? [1, 1, 1] : dark, gap: 8 });
  if (ebook.short_description) doc.textBlock(ebook.short_description, { size: 12.5, color: coverImageJpegBuffer ? [0.85, 0.87, 0.90] : soft, gap: 16 });
  if (ebook.main_promise) doc.textBlock(`Promesse : ${ebook.main_promise}`, { size: 13, font: 'F2', color: coverImageJpegBuffer ? [0.98, 0.82, 0.20] : accent, gap: 18 });
  doc.line(brand, MARGIN_X, 95, 12, 'F2', coverImageJpegBuffer ? [1, 1, 1] : dark);
  doc.line(`Genere le ${new Date(ebook.generatedAt || Date.now()).toLocaleDateString('fr-FR')}`, MARGIN_X, 76, 10, 'F1', coverImageJpegBuffer ? [0.75, 0.78, 0.82] : soft);

  // ── Page 2 : À propos de cet ebook ──────────────────────────────
  doc.pageBreak();
  doc.rect(0, PAGE_HEIGHT - 8, PAGE_WIDTH, 8, accent);
  doc.heading('A propos de cet ebook', { size: 22, color: dark, gap: 14 });
  if (ebook.short_description) doc.textBlock(ebook.short_description, { size: 13, color: soft, gap: 14, leading: 20 });
  if (ebook.target_reader) {
    doc.textBlock('Pour qui ?', { size: 12, font: 'F2', color: accent, gap: 6 });
    doc.textBlock(ebook.target_reader, { size: 12, color: dark, gap: 14, leading: 19 });
  }
  if (ebook.main_promise) {
    doc.textBlock('Ce que vous allez apprendre', { size: 12, font: 'F2', color: accent, gap: 6 });
    doc.textBlock(ebook.main_promise, { size: 12, color: dark, gap: 14, leading: 19 });
  }
  if (ebook.estimated_value) {
    doc.textBlock(`[ ${ebook.estimated_value} ]`, { size: 13, font: 'F2', color: accent, gap: 6 });
  }

  // ── Page 3 : Sommaire ────────────────────────────────────────────
  const toc = Array.isArray(ebook.table_of_contents) ? ebook.table_of_contents : [];
  if (toc.length) {
    doc.pageBreak();
    doc.rect(0, PAGE_HEIGHT - 8, PAGE_WIDTH, 8, accent);
    doc.heading('Sommaire', { size: 22, color: dark, gap: 20 });
    toc.forEach((item, index) => {
      const num = item.chapter_number || index + 1;
      const chapterTitle = cleanText(item.chapter_title || `Chapitre ${num}`, 180);
      const summary = cleanText(item.chapter_summary || '', 260);
      const rowY = doc.getY();
      // Numéro en accent + titre en gras sur la même ligne
      doc.line(`${String(num).padStart(2, '0')}.`, MARGIN_X, rowY, 13, 'F2', accent);
      doc.line(chapterTitle, MARGIN_X + 28, rowY, 13, 'F2', dark);
      doc.setY(rowY - 20);
      if (summary) doc.textBlock(summary, { size: 11, color: soft, gap: 2, leading: 15, x: MARGIN_X + 28 });
      // Séparateur léger
      doc.rect(MARGIN_X, doc.getY() - 2, PAGE_WIDTH - (MARGIN_X * 2), 0.5, [0.88, 0.90, 0.92]);
      doc.setY(doc.getY() - 12);
    });
  }

  // ── Chapitres ────────────────────────────────────────────────────
  const chapters = Array.isArray(ebook.chapters) ? ebook.chapters : [];
  chapters.forEach((chapter, index) => {
    doc.pageBreak();
    const num = chapter.chapter_number || index + 1;
    const chapterTitle = cleanText(chapter.chapter_title || `Chapitre ${num}`, 180);

    // Bande colorée header de chapitre
    doc.rect(0, PAGE_HEIGHT - 110, PAGE_WIDTH, 110, accent);
    doc.line(`CHAPITRE ${num}`, MARGIN_X, PAGE_HEIGHT - 30, 11, 'F2', [0.8, 0.88, 0.92]);
    wrapText(chapterTitle, 22, PAGE_WIDTH - (MARGIN_X * 2)).slice(0, 2).forEach((entry, i) => {
      doc.line(entry, MARGIN_X, PAGE_HEIGHT - 52 - (i * 28), 22, 'F2', [1, 1, 1]);
    });
    doc.setY(PAGE_HEIGHT - 130);

    // Intro du chapitre
    const intro = cleanText(chapter.chapter_intro || '', 400);
    if (intro) {
      doc.textBlock(intro, { size: 13, font: 'F2', color: [0.14, 0.18, 0.28], gap: 16, leading: 21 });
      doc.rect(MARGIN_X, doc.getY() + 4, PAGE_WIDTH - (MARGIN_X * 2), 1.5, accent);
      doc.setY(doc.getY() - 16);
    }

    // Contenu principal
    const content = cleanText(chapter.chapter_content || chapter.content || chapter.chapter_summary || '', 8000);
    if (content) {
      doc.textBlock(content, { size: 12, color: [0.15, 0.18, 0.25], gap: 10, leading: 20 });
    }

    // Points clés (key_points)
    const keyPoints = Array.isArray(chapter.key_points) ? chapter.key_points : [];
    if (keyPoints.length) {
      doc.setY(doc.getY() - 8);
      doc.textBlock('Points cles a retenir :', { size: 12, font: 'F2', color: accent, gap: 8 });
      keyPoints.forEach((point) => {
        const pt = cleanText(typeof point === 'string' ? point : String(point || ''), 280);
        if (pt) {
          const ptY = doc.getY();
          doc.line('>', MARGIN_X, ptY, 12, 'F2', accent);
          doc.textBlock(pt, { size: 12, color: dark, gap: 5, leading: 18, x: MARGIN_X + 14, width: PAGE_WIDTH - (MARGIN_X * 2) - 14 });
        }
      });
    }

    // Action step
    const actionStep = cleanText(chapter.action_step || '', 400);
    if (actionStep) {
      doc.setY(doc.getY() - 6);
      doc.textBlock('>> Action a faire maintenant', { size: 12, font: 'F2', color: accent, gap: 6 });
      doc.textBlock(actionStep, { size: 12, color: dark, gap: 10, leading: 19 });
    }
  });

  // ── Page finale ──────────────────────────────────────────────────
  if (ebook.final_page?.title || ebook.final_page?.message || ebook.final_page?.cta) {
    doc.pageBreak();
    doc.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, accent);
    const finalTitle = cleanText(ebook.final_page.title || 'Merci pour votre confiance', 160);
    const finalMsg = cleanText(ebook.final_page.message || '', 600);
    const finalCta = cleanText(ebook.final_page.cta || '', 200);
    doc.setY(580);
    wrapText(finalTitle, 28, PAGE_WIDTH - (MARGIN_X * 2)).slice(0, 3).forEach((entry, i) => {
      doc.line(entry, MARGIN_X, doc.getY() - (i * 34), 28, 'F2', [1, 1, 1]);
    });
    doc.setY(doc.getY() - 50);
    if (finalMsg) doc.textBlock(finalMsg, { size: 13, color: [1, 1, 1], gap: 20, leading: 21 });
    if (finalCta) {
      doc.rect(MARGIN_X, doc.getY() - 6, PAGE_WIDTH - (MARGIN_X * 2), 44, [1, 1, 1]);
      doc.textBlock(finalCta, { size: 14, font: 'F2', color: accent, gap: 10 });
    }
    doc.line(brand, MARGIN_X, 80, 12, 'F2', [1, 1, 1]);
  }

  return buildPdfBuffer(doc.finish(), coverImageJpegBuffer);
}

async function generateCoverImageJpeg(imagePrompt) {
  if (!imagePrompt) return null;
  try {
    console.log('[EbookPDF] Generating cover image...');
    const imageUrl = await generateNanoBananaImage(imagePrompt, '3:4');
    if (!imageUrl) return null;

    const response = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 30000 });
    const rawBuffer = Buffer.from(response.data);

    // Resize/convert to exact PDF page dimensions as JPEG
    const jpegBuffer = await sharp(rawBuffer)
      .resize(595, 842, { fit: 'cover', position: 'centre' })
      .jpeg({ quality: 88 })
      .toBuffer();

    console.log(`[EbookPDF] Cover image ready: ${Math.round(jpegBuffer.length / 1024)}KB`);
    return jpegBuffer;
  } catch (err) {
    console.warn('[EbookPDF] Cover image generation failed, using text-only cover:', err.message);
    return null;
  }
}

export async function createAndStoreEbookPdf({ ebook = {}, productData = {}, storeContext = {}, workspaceId = '', userId = '' } = {}) {
  const imagePrompt = ebook.cover?.image_generation_prompt || null;
  const coverImageJpegBuffer = await generateCoverImageJpeg(imagePrompt);
  const pdfBuffer = generateEbookPdfBuffer(ebook, productData, storeContext, coverImageJpegBuffer);
  const fileName = `${slugify(ebook.title || productData.title || productData.name || 'ebook')}.pdf`;
  const generatedAt = new Date().toISOString();

  if (!R2_CONFIG.bucket || !workspaceId) {
    return {
      url: `data:application/pdf;base64,${pdfBuffer.toString('base64')}`,
      fileName,
      mimeType: 'application/pdf',
      size: pdfBuffer.length,
      storage: 'inline',
      generatedAt,
    };
  }

  const storageKey = `ecom/${workspaceId}/digital-products/${randomUUID()}-${fileName}`;
  try {
    const upload = new Upload({
      client: s3Client,
      params: {
        Bucket: R2_CONFIG.bucket,
        Key: storageKey,
        Body: pdfBuffer,
        ContentType: 'application/pdf',
        Metadata: {
          uploadedBy: String(userId || ''),
          workspaceId: String(workspaceId || ''),
          kind: 'digital-product',
          originalName: fileName,
        },
      },
    });

    await upload.done();

    return {
      url: getR2PublicUrl(storageKey),
      fileName,
      mimeType: 'application/pdf',
      size: pdfBuffer.length,
      storageKey,
      storage: 'r2',
      generatedAt,
    };
  } catch (error) {
    console.warn('[EbookPDF] Upload R2 échoué, PDF conservé inline:', error.message);
    return {
      url: `data:application/pdf;base64,${pdfBuffer.toString('base64')}`,
      fileName,
      mimeType: 'application/pdf',
      size: pdfBuffer.length,
      storage: 'inline-fallback',
      generatedAt,
    };
  }
}
