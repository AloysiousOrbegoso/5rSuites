import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

// Renders the market report as a branded one-page PDF. Content comes from template.js.

const NAVY = rgb(0x1d / 255, 0x35 / 255, 0x57 / 255);
const GOLD = rgb(0xc8 / 255, 0x96 / 255, 0x3e / 255);
const INK = rgb(0x14 / 255, 0x21 / 255, 0x3d / 255);
const MUTED = rgb(0x6b / 255, 0x76 / 255, 0x90 / 255);
const TILE = rgb(0xf5 / 255, 0xf6 / 255, 0xfa / 255);

// Standard PDF fonts only cover WinAnsi; replace anything else so odd characters in an
// address can't crash the render.
export function pdfSafe(text) {
  return String(text ?? '')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\x20-\x7e\n]/g, '?');
}

function wrap(text, font, size, maxWidth) {
  const words = pdfSafe(text).split(/\s+/);
  const lines = [];
  let line = '';
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(next, size) > maxWidth && line) {
      lines.push(line);
      line = w;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export async function renderReportPdf(report) {
  const doc = await PDFDocument.create();
  doc.setTitle(pdfSafe(`${report.title} - ${report.address}`));
  doc.setAuthor('5R Suites');
  doc.setCreator('5R Suites');

  const page = doc.addPage([612, 792]); // US Letter
  const { width, height } = page.getSize();
  const sans = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const serif = await doc.embedFont(StandardFonts.TimesRomanBold);
  const margin = 54;
  const contentWidth = width - margin * 2;

  const text = (s, x, y, { font = sans, size = 11, color = INK } = {}) => page.drawText(pdfSafe(s), { x, y, font, size, color });
  const paragraph = (s, y, { font = sans, size = 11, color = INK, lineHeight = 1.45 } = {}) => {
    for (const line of wrap(s, font, size, contentWidth)) {
      text(line, margin, y, { font, size, color });
      y -= size * lineHeight;
    }
    return y;
  };

  // Header band with wordmark (placeholder until final brand assets are supplied).
  page.drawRectangle({ x: 0, y: height - 96, width, height: 96, color: NAVY });
  text('5R', margin, height - 60, { font: serif, size: 30, color: GOLD });
  text('SUITES', margin + serif.widthOfTextAtSize('5R', 30) + 8, height - 58, { font: bold, size: 14, color: rgb(1, 1, 1) });
  const dateW = sans.widthOfTextAtSize(pdfSafe(report.date), 10);
  text(report.date, width - margin - dateW, height - 56, { size: 10, color: rgb(0.85, 0.88, 0.93) });
  page.drawRectangle({ x: 0, y: height - 100, width, height: 4, color: GOLD });

  let y = height - 138;
  text(report.title, margin, y, { font: serif, size: 24 });
  y -= 26;
  y = paragraph(report.address, y, { font: bold, size: 12 });
  y = paragraph(`Prepared for ${report.preparedFor}`, y - 2, { size: 10, color: MUTED });

  // Metric tiles: property row, then (if available) city-average row.
  const gap = 12;
  const tileW = (contentWidth - gap * 3) / 4;
  const row = (label, tiles, { accent, fill, tileH }) => {
    y -= 14;
    text(label.toUpperCase(), margin, y, { font: bold, size: 8, color: MUTED });
    y -= 8;
    tiles.forEach((tile, i) => {
      const x = margin + i * (tileW + gap);
      page.drawRectangle({ x, y: y - tileH, width: tileW, height: tileH, color: fill });
      page.drawRectangle({ x, y: y - 3, width: tileW, height: 3, color: accent });
      text(tile.value, x + 12, y - tileH / 2 - 2, { font: bold, size: 17, color: NAVY });
      text(tile.label.toUpperCase(), x + 12, y - tileH + 12, { size: 7, color: MUTED });
    });
    y -= tileH + 6;
  };
  y -= 6;
  row(report.tilesLabel || 'Your property', report.tiles, { accent: GOLD, fill: TILE, tileH: 66 });
  if (report.cityTiles) row(report.cityLabel, report.cityTiles, { accent: NAVY, fill: rgb(0.97, 0.955, 0.915), tileH: 58 });
  y -= 18;

  text('What the market says', margin, y, { font: serif, size: 15 });
  y -= 23;
  for (const p of report.paragraphs) y = paragraph(p, y, { size: 10.5, lineHeight: 1.4 }) - 5;

  y -= 10;
  text('Next steps', margin, y, { font: serif, size: 15 });
  y -= 23;
  for (const p of report.nextSteps) y = paragraph(p, y, { size: 10.5, lineHeight: 1.4 }) - 5;

  if (report.schedulingUrl) {
    y -= 6;
    page.drawRectangle({ x: margin, y: y - 44, width: contentWidth, height: 52, color: NAVY });
    text('Book a call with our team:', margin + 16, y - 14, { font: bold, size: 11, color: rgb(1, 1, 1) });
    text(report.schedulingUrl, margin + 16, y - 32, { size: 10, color: GOLD });
    y -= 64;
  }

  // Footer disclaimer
  let fy = 76;
  page.drawLine({ start: { x: margin, y: fy + 14 }, end: { x: width - margin, y: fy + 14 }, thickness: 0.5, color: MUTED });
  for (const line of wrap(report.disclaimer, sans, 7.5, contentWidth)) {
    text(line, margin, fy, { size: 7.5, color: MUTED });
    fy -= 10;
  }
  text('www.5rsuites.com', margin, 30, { font: bold, size: 8, color: NAVY });

  return doc.save();
}
