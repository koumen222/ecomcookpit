import { Upload } from '@aws-sdk/lib-storage';
import { randomUUID } from 'crypto';
import { s3Client, R2_CONFIG, getR2PublicUrl } from '../config/r2.js';

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
    finish: () => {
      if (current) pages.push(current);
      return pages;
    },
  };
}

function buildPdfBuffer(pageContents = []) {
  const objects = [];
  const addObject = (body) => {
    objects.push(body);
    return objects.length;
  };

  addObject('<< /Type /Catalog /Pages 2 0 R >>');
  addObject('PAGES_PLACEHOLDER');
  addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');

  const kids = [];
  pageContents.forEach((content) => {
    const pageObjectNumber = objects.length + 1;
    const contentObjectNumber = objects.length + 2;
    kids.push(`${pageObjectNumber} 0 R`);
    addObject(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentObjectNumber} 0 R >>`);
    addObject(`<< /Length ${Buffer.byteLength(content, 'utf8')} >>\nstream\n${content}endstream`);
  });

  objects[1] = `<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${kids.length} >>`;

  let pdf = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
  const offsets = [0];
  objects.forEach((body, index) => {
    offsets.push(Buffer.byteLength(pdf, 'binary'));
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });

  const xrefOffset = Buffer.byteLength(pdf, 'binary');
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(pdf, 'binary');
}

export function generateEbookPdfBuffer(ebook = {}, productData = {}, storeContext = {}) {
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

  doc.rect(0, PAGE_HEIGHT - 190, PAGE_WIDTH, 190, accent);
  doc.line('EBOOK BONUS', MARGIN_X, 735, 13, 'F2', [1, 1, 1]);
  wrapText(title, 28, PAGE_WIDTH - (MARGIN_X * 2)).slice(0, 3).forEach((entry, index) => {
    doc.line(entry, MARGIN_X, 690 - (index * 35), 28, 'F2', [1, 1, 1]);
  });
  doc.setY(575);
  if (subtitle) doc.textBlock(subtitle, { size: 14, font: 'F1', color: [1, 1, 1], x: MARGIN_X, width: PAGE_WIDTH - (MARGIN_X * 2), gap: 12, leading: 19 });
  doc.setY(520);
  if (productName) doc.textBlock(`Produit associe : ${productName}`, { size: 13, font: 'F2', color: dark, gap: 8 });
  if (ebook.short_description) doc.textBlock(ebook.short_description, { size: 12.5, color: soft, gap: 16 });
  if (ebook.main_promise) doc.textBlock(`Promesse : ${ebook.main_promise}`, { size: 13, font: 'F2', color: accent, gap: 18 });
  doc.line(brand, MARGIN_X, 95, 12, 'F2', dark);
  doc.line(`Genere le ${new Date(ebook.generatedAt || Date.now()).toLocaleDateString('fr-FR')}`, MARGIN_X, 76, 10, 'F1', soft);

  const toc = Array.isArray(ebook.table_of_contents) ? ebook.table_of_contents : [];
  if (toc.length) {
    doc.pageBreak();
    doc.heading('Sommaire', { size: 24, color: accent });
    toc.forEach((item, index) => {
      const chapterTitle = cleanText(item.chapter_title || `Chapitre ${index + 1}`, 180);
      const summary = cleanText(item.chapter_summary || '', 320);
      doc.textBlock(`${item.chapter_number || index + 1}. ${chapterTitle}${summary ? ` — ${summary}` : ''}`, {
        size: 12.5,
        color: dark,
        gap: 8,
        leading: 18,
      });
    });
  }

  const chapters = Array.isArray(ebook.chapters) ? ebook.chapters : [];
  chapters.forEach((chapter, index) => {
    doc.pageBreak();
    doc.heading(`Chapitre ${chapter.chapter_number || index + 1}`, { size: 13, color: accent, gap: 8 });
    doc.heading(cleanText(chapter.chapter_title || `Chapitre ${index + 1}`, 180), { size: 22, color: dark, gap: 16 });
    doc.textBlock(chapter.chapter_content || chapter.content || chapter.chapter_summary || '', {
      size: 12,
      color: [0.18, 0.20, 0.26],
      gap: 10,
      leading: 18,
    });
  });

  if (ebook.final_page?.title || ebook.final_page?.message || ebook.final_page?.cta) {
    doc.pageBreak();
    doc.heading(cleanText(ebook.final_page.title || 'Merci pour votre confiance', 160), { size: 24, color: accent });
    doc.textBlock(ebook.final_page.message || '', { size: 13, color: dark, gap: 18, leading: 20 });
    doc.textBlock(ebook.final_page.cta || '', { size: 14, font: 'F2', color: accent, gap: 10, leading: 20 });
  }

  return buildPdfBuffer(doc.finish());
}

export async function createAndStoreEbookPdf({ ebook = {}, productData = {}, storeContext = {}, workspaceId = '', userId = '' } = {}) {
  const pdfBuffer = generateEbookPdfBuffer(ebook, productData, storeContext);
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
