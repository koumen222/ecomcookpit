import { Upload } from '@aws-sdk/lib-storage';
import { randomUUID } from 'crypto';
import axios from 'axios';
import sharp from 'sharp';
import { s3Client, R2_CONFIG, getR2PublicUrl } from '../config/r2.js';
import { generateNanoBananaImage } from './nanoBananaService.js';
import { generateGeminiTextToImage, isGeminiConfigured } from './geminiImageService.js';

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN_X = 54;
const MARGIN_BOTTOM = 58;
const TOP_Y = 775;
const IMG_INLINE_W = PAGE_WIDTH - MARGIN_X * 2;   // 487.28
const IMG_INLINE_H = Math.round(IMG_INLINE_W * 9 / 16); // ~274

const cleanText = (value = '', max = 5000) => String(value || '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ')
  .replace(/&amp;/g, '&')
  .replace(/\s+/g, ' ')
  .trim()
  .slice(0, max);

const cleanBlock = (value = '', max = 9000) => String(value || '')
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<\/p>/gi, '\n\n')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ')
  .replace(/&amp;/g, '&')
  .replace(/[^\S\n]+/g, ' ')
  .replace(/\n{3,}/g, '\n\n')
  .trim()
  .slice(0, max);

const slugify = (value = 'ebook') => cleanText(value, 120)
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '')
  .slice(0, 80) || 'ebook';

// Win1252 encoding table for codepoints 0x80–0x9F (the "CP1252 extension" block)
// Everything else maps directly: 0x00-0x7F = ASCII, 0xA0-0xFF = Latin-1
const WIN1252_EXT = {
  0x20AC: 0x80, 0x201A: 0x82, 0x0192: 0x83, 0x201E: 0x84, 0x2026: 0x85,
  0x2020: 0x86, 0x2021: 0x87, 0x02C6: 0x88, 0x2030: 0x89, 0x0160: 0x8A,
  0x2039: 0x8B, 0x0152: 0x8C, 0x017D: 0x8E, 0x2018: 0x91, 0x2019: 0x92,
  0x201C: 0x93, 0x201D: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97,
  0x02DC: 0x98, 0x2122: 0x99, 0x0161: 0x9A, 0x203A: 0x9B, 0x0153: 0x9C,
  0x017E: 0x9E, 0x0178: 0x9F,
};
// Fallback map for chars that have no Win1252 equivalent
const ACCENT_FALLBACK = {
  0x2018: "'", 0x2019: "'", 0x201C: '"', 0x201D: '"',
  0x2013: '-', 0x2014: '-', 0x2026: '...', 0x2022: '-',
};

function toWin1252(str) {
  const out = [];
  for (const ch of String(str || '')) {
    const cp = ch.codePointAt(0);
    if (cp <= 0xFF) {
      // Direct Latin-1 / ASCII (skips 0x81,0x8D,0x8F,0x90,0x9D which are undefined in Win1252)
      if (cp === 0x81 || cp === 0x8D || cp === 0x8F || cp === 0x90 || cp === 0x9D) {
        out.push(0x3F); // '?'
      } else {
        out.push(cp);
      }
    } else if (WIN1252_EXT[cp] !== undefined) {
      out.push(WIN1252_EXT[cp]);
    } else if (ACCENT_FALLBACK[cp]) {
      for (const c of ACCENT_FALLBACK[cp]) out.push(c.charCodeAt(0));
    } else {
      out.push(0x3F); // '?' for unmappable
    }
  }
  return Buffer.from(out);
}

// Encode text as a PDF literal string with Win1252 bytes, escaped for PDF syntax
const pdfStr = (value = '') => {
  const buf = toWin1252(String(value || ''));
  let s = '';
  for (const b of buf) {
    if (b === 0x28) s += '\\(';        // (
    else if (b === 0x29) s += '\\)';   // )
    else if (b === 0x5C) s += '\\\\';  // backslash
    else if (b < 0x20 || b > 0x7E) s += `\\${b.toString(8).padStart(3, '0')}`; // octal for non-ASCII
    else s += String.fromCharCode(b);
  }
  return `(${s})`;
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

// ── Key quote / stat callout box ────────────────────────────────────────────
function drawKeyQuote(doc, quote, accent) {
  if (!quote) return;
  const q = cleanText(quote, 320);
  if (!q) return;
  const textW = PAGE_WIDTH - MARGIN_X * 2 - 28;
  const qLines = wrapText(`" ${q} "`, 12.5, textW).filter(Boolean);
  if (!qLines.length) return;
  const padY = 13;
  const leading = 19;
  const boxH = qLines.length * leading + padY * 2;
  if (doc.getY() - boxH - 10 < MARGIN_BOTTOM) doc.pageBreak();
  const topY = doc.getY();
  const botY = topY - boxH;
  const [r, g, b] = accent;
  // Light tinted background
  doc.rect(MARGIN_X, botY, PAGE_WIDTH - MARGIN_X * 2, boxH, [r * 0.10 + 0.90, g * 0.10 + 0.90, b * 0.10 + 0.90]);
  // Left accent bar (4px)
  doc.rect(MARGIN_X, botY, 4, boxH, accent);
  // Quote text
  qLines.forEach((ln, i) => {
    doc.line(ln, MARGIN_X + 14, topY - padY - i * leading, 12.5, 'F2', accent);
  });
  doc.setY(botY - 14);
}

// ── Table renderer ──────────────────────────────────────────────────────────
function drawTable(doc, headers, rows, accent) {
  if (!headers?.length || !rows?.length) return;
  const colCount = headers.length;
  const totalW = PAGE_WIDTH - MARGIN_X * 2;
  const colW = totalW / colCount;
  const cellPadX = 7;
  const cellPadY = 9;
  const fontSize = 10;
  const leading = 15;
  const headerH = leading + cellPadY * 2;
  if (doc.getY() - headerH * 3 < MARGIN_BOTTOM) doc.pageBreak();

  // Header row
  let topY = doc.getY();
  doc.rect(MARGIN_X, topY - headerH, totalW, headerH, accent);
  headers.forEach((hdr, ci) => {
    doc.line(
      cleanText(String(hdr || ''), 80),
      MARGIN_X + ci * colW + cellPadX,
      topY - cellPadY,
      fontSize, 'F2', [1, 1, 1]
    );
  });
  topY -= headerH;
  doc.setY(topY);

  // Data rows
  rows.forEach((row, ri) => {
    const cells = Array.isArray(row) ? row : [];
    const wrapped = cells.map(cell =>
      wrapText(cleanText(String(cell || ''), 260), fontSize, colW - cellPadX * 2).filter(Boolean)
    );
    const maxLines = Math.max(1, ...wrapped.map(l => l.length));
    const rowH = maxLines * leading + cellPadY * 2;
    if (topY - rowH < MARGIN_BOTTOM) { doc.pageBreak(); topY = doc.getY(); }
    const rowBg = ri % 2 === 0 ? [0.95, 0.96, 0.975] : [1, 1, 1];
    doc.rect(MARGIN_X, topY - rowH, totalW, rowH, rowBg);
    wrapped.forEach((lines, ci) => {
      lines.forEach((ln, li) => {
        doc.line(ln, MARGIN_X + ci * colW + cellPadX, topY - cellPadY - li * leading, fontSize, 'F1', [0.12, 0.14, 0.20]);
      });
    });
    topY -= rowH;
    doc.setY(topY);
    // Thin bottom separator
    doc.rect(MARGIN_X, topY, totalW, 0.5, [0.82, 0.84, 0.88]);
  });
  doc.setY(doc.getY() - 16);
}

// ── Inline chapter illustration ─────────────────────────────────────────────
function drawChapterImage(doc, chapterIndex, caption) {
  const neededH = IMG_INLINE_H + 30;
  if (doc.getY() - neededH < MARGIN_BOTTOM) doc.pageBreak();
  const imgBottomY = doc.getY() - IMG_INLINE_H;
  // Rounded rectangle placeholder bg in case image fails (not rendered but XObject may be absent)
  doc.raw(`q ${IMG_INLINE_W.toFixed(2)} 0 0 ${IMG_INLINE_H.toFixed(2)} ${MARGIN_X.toFixed(2)} ${imgBottomY.toFixed(2)} cm /CI${chapterIndex} Do Q\n`);
  doc.setY(imgBottomY - 6);
  const cap = cleanText(caption || 'Illustration', 120);
  doc.line(cap, MARGIN_X, doc.getY(), 9, 'F1', [0.55, 0.58, 0.65]);
  doc.setY(doc.getY() - 18);
}

function createPdfDocument() {
  const pages = [];
  let current = '';
  let y = TOP_Y;
  let pageNumber = 0;
  let skipNextPageNumber = false;

  const addPage = (opts = {}) => {
    if (current) {
      if (pageNumber > 0 && !skipNextPageNumber) {
        const pnText = pdfStr(String(pageNumber + 1));
        const pnX = (PAGE_WIDTH / 2 - 8).toFixed(2);
        current += `0.600 0.620 0.660 rg\nBT /F1 9 Tf ${pnX} 28.00 Td ${pnText} Tj ET\n`;
      }
      pages.push(current);
    }
    skipNextPageNumber = opts.skipPageNumber || false;
    current = '';
    y = TOP_Y;
    pageNumber++;
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
    current += `${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg\nBT /${font} ${size} Tf ${x.toFixed(2)} ${lineY.toFixed(2)} Td ${pdfStr(text)} Tj ET\n`;
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

  const pageBreak = (opts) => addPage(opts);

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
    raw: (cmd) => { current += cmd; },
    addCoverImageCmd: () => {
      current += `q ${PAGE_WIDTH.toFixed(2)} 0 0 ${PAGE_HEIGHT.toFixed(2)} 0 0 cm /CoverImg Do Q\n`;
    },
    finish: () => {
      if (current) {
        if (pageNumber > 0 && !skipNextPageNumber) {
          const pnText = pdfStr(String(pageNumber + 1));
          const pnX = (PAGE_WIDTH / 2 - 8).toFixed(2);
          current += `0.600 0.620 0.660 rg\nBT /F1 9 Tf ${pnX} 28.00 Td ${pnText} Tj ET\n`;
        }
        pages.push(current);
      }
      return pages;
    },
    getPageNumber: () => pageNumber,
  };
}

// chapterImages: Array indexed by chapter — null | { buffer, width, height }
function buildPdfBuffer(pageContents = [], coverImageJpegBuffer = null, chapterImages = []) {
  // Build ordered list of all image XObjects
  const imageXObjects = [];
  if (coverImageJpegBuffer?.length) {
    imageXObjects.push({ name: 'CoverImg', buffer: coverImageJpegBuffer, width: 595, height: 842 });
  }
  (chapterImages || []).forEach((img, i) => {
    if (img?.buffer?.length) {
      imageXObjects.push({ name: `CI${i}`, buffer: img.buffer, width: img.width || 487, height: img.height || 274 });
    }
  });

  const objects = [];
  const addObject = (body) => { objects.push(body); return objects.length; };

  addObject('<< /Type /Catalog /Pages 2 0 R >>');
  addObject('PAGES_PLACEHOLDER');
  addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');

  // One PDF object per image XObject (objects 5, 6, 7, ...)
  const imgObjNums = {};
  imageXObjects.forEach((img, i) => {
    imgObjNums[img.name] = 5 + i;
    objects.push(`IMG_BINARY:${img.name}`); // replaced with binary during build
  });

  // All pages share the same XObject resource dict (covers cover + all chapter images)
  const xObjEntries = Object.entries(imgObjNums).map(([n, num]) => `/${n} ${num} 0 R`).join(' ');
  const xObjRes = xObjEntries ? `/XObject << ${xObjEntries} >>` : '';

  const kids = [];
  pageContents.forEach((content, _pageIndex) => {
    const pageObjNum = objects.length + 1;
    const contentObjNum = objects.length + 2;
    kids.push(`${pageObjNum} 0 R`);
    addObject(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> ${xObjRes} >> /Contents ${contentObjNum} 0 R >>`);
    addObject(`<< /Length ${Buffer.byteLength(content, 'utf8')} >>\nstream\n${content}endstream`);
  });

  objects[1] = `<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${kids.length} >>`;

  // Binary assembly
  const headerStr = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
  const parts = [Buffer.from(headerStr, 'binary')];
  const offsets = [0];

  objects.forEach((body, index) => {
    offsets.push(parts.reduce((sum, p) => sum + p.length, 0));
    const objNum = index + 1;
    if (typeof body === 'string' && body.startsWith('IMG_BINARY:')) {
      const imgName = body.slice('IMG_BINARY:'.length);
      const img = imageXObjects.find(x => x.name === imgName);
      const prefix = `${objNum} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${img.width} /Height ${img.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${img.buffer.length} >>\nstream\n`;
      parts.push(Buffer.from(prefix, 'binary'));
      parts.push(img.buffer);
      parts.push(Buffer.from('\nendstream\nendobj\n', 'binary'));
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

// chapterImages: Array indexed by chapter — null | { buffer, width, height }
export function generateEbookPdfBuffer(ebook = {}, productData = {}, storeContext = {}, coverImageJpegBuffer = null, chapterImages = []) {
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

  // ── Page 1 : Couverture ──────────────────────────────────────────────────
  if (coverImageJpegBuffer) {
    doc.addCoverImageCmd();
    doc.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT * 0.55, [0.05, 0.07, 0.12]);
    doc.rect(0, PAGE_HEIGHT - 70, PAGE_WIDTH, 70, [0.04, 0.06, 0.12]);
  } else {
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

  // ── Page 2 : À propos ────────────────────────────────────────────────────
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

  // ── Page 3 : Sommaire ────────────────────────────────────────────────────
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
      doc.line(`${String(num).padStart(2, '0')}.`, MARGIN_X, rowY, 13, 'F2', accent);
      doc.line(chapterTitle, MARGIN_X + 28, rowY, 13, 'F2', dark);
      doc.setY(rowY - 20);
      if (summary) doc.textBlock(summary, { size: 11, color: soft, gap: 2, leading: 15, x: MARGIN_X + 28 });
      doc.rect(MARGIN_X, doc.getY() - 2, PAGE_WIDTH - (MARGIN_X * 2), 0.5, [0.88, 0.90, 0.92]);
      doc.setY(doc.getY() - 12);
    });
  }

  // ── Chapitres ────────────────────────────────────────────────────────────
  const chapters = Array.isArray(ebook.chapters) ? ebook.chapters : [];
  chapters.forEach((chapter, index) => {
    doc.pageBreak();
    const num = chapter.chapter_number || index + 1;
    const chapterTitle = cleanText(chapter.chapter_title || `Chapitre ${num}`, 180);

    // Bande colorée en-tête de chapitre
    doc.rect(0, PAGE_HEIGHT - 110, PAGE_WIDTH, 110, accent);
    doc.line(`CHAPITRE ${num}`, MARGIN_X, PAGE_HEIGHT - 30, 11, 'F2', [0.8, 0.88, 0.92]);
    wrapText(chapterTitle, 22, PAGE_WIDTH - (MARGIN_X * 2)).slice(0, 2).forEach((entry, i) => {
      doc.line(entry, MARGIN_X, PAGE_HEIGHT - 52 - (i * 28), 22, 'F2', [1, 1, 1]);
    });
    doc.setY(PAGE_HEIGHT - 130);

    // Intro (bold accroche)
    const intro = cleanText(chapter.chapter_intro || '', 400);
    if (intro) {
      doc.textBlock(intro, { size: 13, font: 'F2', color: [0.14, 0.18, 0.28], gap: 16, leading: 21 });
      doc.rect(MARGIN_X, doc.getY() + 4, PAGE_WIDTH - (MARGIN_X * 2), 1.5, accent);
      doc.setY(doc.getY() - 16);
    }

    // Illustration inline (si générée)
    const chapterImg = Array.isArray(chapterImages) ? chapterImages[index] : null;
    if (chapterImg?.buffer) {
      drawChapterImage(doc, index, chapter.illustration_caption || `Illustration - ${chapterTitle}`);
    }

    // Contenu principal (paragraphes préservés)
    const content = cleanBlock(chapter.chapter_content || chapter.content || chapter.chapter_summary || '', 9000);
    if (content) {
      doc.textBlock(content, { size: 12, color: [0.15, 0.18, 0.25], gap: 10, leading: 20 });
    }

    // Tableau récapitulatif (chapter_table)
    const chTable = chapter.chapter_table;
    if (chTable?.headers?.length && chTable?.rows?.length) {
      doc.setY(doc.getY() - 6);
      doc.textBlock('Tableau recapitulatif :', { size: 11, font: 'F2', color: accent, gap: 8 });
      drawTable(doc, chTable.headers, chTable.rows, accent);
    }

    // Citation / stat clé (key_quote)
    if (chapter.key_quote) {
      drawKeyQuote(doc, chapter.key_quote, accent);
    }

    // Points clés
    const keyPoints = Array.isArray(chapter.key_points) ? chapter.key_points : [];
    if (keyPoints.length) {
      doc.setY(doc.getY() - 8);
      doc.textBlock('Points cles a retenir :', { size: 12, font: 'F2', color: accent, gap: 8 });
      keyPoints.forEach((point) => {
        const pt = cleanText(typeof point === 'string' ? point : String(point || ''), 280);
        if (pt) {
          if (doc.getY() - 36 < MARGIN_BOTTOM) doc.pageBreak();
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

  // ── Page finale ──────────────────────────────────────────────────────────
  if (ebook.final_page?.title || ebook.final_page?.message || ebook.final_page?.cta) {
    doc.pageBreak({ skipPageNumber: true });
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

  return buildPdfBuffer(doc.finish(), coverImageJpegBuffer, chapterImages);
}

// Try KIE NanoBanana first, fall back to Gemini if KIE fails (401, 500, timeout)
async function generateImageUrl(prompt, aspectRatio) {
  try {
    const url = await generateNanoBananaImage(prompt, aspectRatio);
    if (url) return url;
  } catch (kieErr) {
    console.warn(`[EbookPDF] KIE image failed (${kieErr.message}) — trying Gemini...`);
  }
  if (isGeminiConfigured()) {
    try {
      const url = await generateGeminiTextToImage(prompt, aspectRatio);
      if (url) { console.log('[EbookPDF] Gemini image fallback OK'); return url; }
    } catch (gemErr) {
      console.warn(`[EbookPDF] Gemini image also failed: ${gemErr.message}`);
    }
  }
  return null;
}

async function generateCoverImageJpeg(imagePrompt) {
  if (!imagePrompt) return { buffer: null, url: null };
  try {
    console.log('[EbookPDF] Generating cover image...');
    const imageUrl = await generateImageUrl(imagePrompt, '3:4');
    if (!imageUrl) return { buffer: null, url: null };

    const response = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 30000 });
    const rawBuffer = Buffer.from(response.data);

    const jpegBuffer = await sharp(rawBuffer)
      .resize(595, 842, { fit: 'cover', position: 'centre' })
      .jpeg({ quality: 88 })
      .toBuffer();

    console.log(`[EbookPDF] Cover ready: ${Math.round(jpegBuffer.length / 1024)}KB`);
    return { buffer: jpegBuffer, url: imageUrl };
  } catch (err) {
    console.warn('[EbookPDF] Cover generation failed:', err.message);
    return { buffer: null, url: null };
  }
}

async function generateChapterIllustrations(chapters = []) {
  const targets = [];
  chapters.forEach((ch, i) => {
    if (ch.illustration_prompt && targets.length < 4) {
      targets.push({ index: i, prompt: ch.illustration_prompt });
    }
  });

  const chapterImages = new Array(chapters.length).fill(null);
  if (!targets.length) return chapterImages;

  await Promise.allSettled(
    targets.map(async ({ index, prompt }) => {
      try {
        const imgUrl = await generateImageUrl(prompt, '16:9');
        if (!imgUrl) return;
        const resp = await axios.get(imgUrl, { responseType: 'arraybuffer', timeout: 30000 });
        const jpeg = await sharp(Buffer.from(resp.data))
          .resize(487, 274, { fit: 'cover', position: 'centre' })
          .jpeg({ quality: 82 })
          .toBuffer();
        chapterImages[index] = { buffer: jpeg, width: 487, height: 274 };
        console.log(`[EbookPDF] Illustration ch${index + 1}: ${Math.round(jpeg.length / 1024)}KB`);
      } catch (err) {
        console.warn(`[EbookPDF] Illustration ch${index + 1} failed: ${err.message}`);
      }
    })
  );

  return chapterImages;
}

export async function createAndStoreEbookPdf({ ebook = {}, productData = {}, storeContext = {}, workspaceId = '', userId = '' } = {}) {
  const imagePrompt = ebook.cover?.image_generation_prompt || null;
  const chapters = Array.isArray(ebook.chapters) ? ebook.chapters : [];

  // Cover image + chapter illustrations in parallel
  const [{ buffer: coverImageJpegBuffer, url: coverImageUrl }, chapterImages] = await Promise.all([
    generateCoverImageJpeg(imagePrompt),
    generateChapterIllustrations(chapters),
  ]);

  const pdfBuffer = generateEbookPdfBuffer(ebook, productData, storeContext, coverImageJpegBuffer, chapterImages);
  const fileName = `${slugify(ebook.title || productData.title || productData.name || 'ebook')}.pdf`;
  const generatedAt = new Date().toISOString();

  if (!R2_CONFIG.bucket || !workspaceId) {
    return {
      url: `data:application/pdf;base64,${pdfBuffer.toString('base64')}`,
      fileName,
      mimeType: 'application/pdf',
      size: pdfBuffer.length,
      storage: 'inline',
      coverImageUrl: coverImageUrl || null,
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
      coverImageUrl: coverImageUrl || null,
      generatedAt,
    };
  } catch (error) {
    console.warn('[EbookPDF] Upload R2 échoué, inline fallback:', error.message);
    return {
      url: `data:application/pdf;base64,${pdfBuffer.toString('base64')}`,
      fileName,
      mimeType: 'application/pdf',
      size: pdfBuffer.length,
      storage: 'inline-fallback',
      coverImageUrl: coverImageUrl || null,
      generatedAt,
    };
  }
}
