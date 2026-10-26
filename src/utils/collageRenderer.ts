/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AttendanceRecord, CollageSettings } from '../types/attendance.ts';
import { formatIndonesianDate } from './collageLogic.ts';
import JSZip from 'jszip';

// Cache for loaded HTMLImageElements
const imageCache = new Map<string, HTMLImageElement>();

export function preloadImage(src: string): Promise<HTMLImageElement> {
  if (imageCache.has(src)) {
    return Promise.resolve(imageCache.get(src)!);
  }
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imageCache.set(src, img);
      resolve(img);
    };
    img.onerror = () => {
      // Return empty image on error rather than crashing
      console.warn('Failed to load image:', src);
      resolve(img);
    };
    img.src = src;
  });
}

/**
 * Draws a rounded rectangle path on Canvas 2D
 */
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/**
 * Truncate text with ellipsis if it exceeds maxWidth
 */
function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let len = text.length;
  while (len > 0 && ctx.measureText(text.slice(0, len) + '…').width > maxWidth) {
    len--;
  }
  return text.slice(0, len) + '…';
}

/**
 * Render a single page collage onto a target HTMLCanvasElement
 */
export async function renderCollagePage(
  canvas: HTMLCanvasElement,
  pageRecords: AttendanceRecord[],
  pageIndex: number,
  totalPages: number,
  totalCount: number,
  settings: CollageSettings
): Promise<void> {
  const isPortrait = settings.orientation === 'portrait';
  const width = isPortrait ? 1080 : 1920;
  const height = isPortrait ? 1350 : 1080;

  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Preload all attendee images
  await Promise.all(pageRecords.map((r) => preloadImage(r.photoUrl)));

  // Color schemes according to template
  const tmpl = settings.template;

  let bgFill = '#F8F5EE';
  let headerBg = '#F3EFE6';
  let primaryText = '#292524';
  let secondaryText = '#78716C';
  let accentColor = '#B8860B'; // Dark gold
  let cardBg = '#FFFFFF';
  let cardBorder = '#E7DFCF';
  let footerBg = '#EFE9DC';

  if (tmpl === 'formal') {
    bgFill = '#F1F5F9';
    headerBg = '#0B1D3A';
    primaryText = '#0F172A';
    secondaryText = '#475569';
    accentColor = '#1E3A8A';
    cardBg = '#FFFFFF';
    cardBorder = '#CBD5E1';
    footerBg = '#E2E8F0';
  } else if (tmpl === 'minimal') {
    bgFill = '#FFFFFF';
    headerBg = '#FAFAFA';
    primaryText = '#18181B';
    secondaryText = '#71717A';
    accentColor = '#09090B';
    cardBg = '#FAFAFA';
    cardBorder = '#E4E4E7';
    footerBg = '#F4F4F5';
  }

  // 1. Draw Background
  ctx.fillStyle = bgFill;
  ctx.fillRect(0, 0, width, height);

  // Outer framing decorative line (Beige Elegant & Formal)
  if (tmpl === 'beige') {
    ctx.strokeStyle = '#D9CEB8';
    ctx.lineWidth = 3;
    ctx.strokeRect(28, 28, width - 56, height - 56);

    ctx.strokeStyle = '#EFE6D5';
    ctx.lineWidth = 1;
    ctx.strokeRect(34, 34, width - 68, height - 68);
  } else if (tmpl === 'formal') {
    ctx.strokeStyle = '#0B1D3A';
    ctx.lineWidth = 6;
    ctx.strokeRect(20, 20, width - 40, height - 40);
  }

  // 2. Header Area
  const headerHeight = isPortrait ? 220 : 180;
  if (tmpl === 'formal') {
    ctx.fillStyle = headerBg;
    ctx.fillRect(30, 30, width - 60, headerHeight);

    // Gold accent hairline
    ctx.fillStyle = '#D4AF37';
    ctx.fillRect(30, 30 + headerHeight - 4, width - 60, 4);
  } else if (tmpl === 'beige') {
    ctx.fillStyle = headerBg;
    roundRect(ctx, 44, 44, width - 88, headerHeight - 10, 12);
    ctx.fill();
    ctx.strokeStyle = '#E2D6C0';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  } else {
    // Minimal
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, headerHeight);
    ctx.strokeStyle = '#E4E4E7';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(40, headerHeight);
    ctx.lineTo(width - 40, headerHeight);
    ctx.stroke();
  }

  // Text inside header
  ctx.textAlign = 'center';
  const headerCenterY = isPortrait ? 130 : 110;
  const isFormalHeader = tmpl === 'formal';

  // Subtitle / Institution
  ctx.font = '600 16px "Plus Jakarta Sans", sans-serif';
  ctx.fillStyle = isFormalHeader ? '#94A3B8' : secondaryText;
  const institution = (settings.institutionName || 'DOKUMENTASI ABSENSI HARIAN').toUpperCase();
  const unit = settings.unitName ? ` · ${settings.unitName.toUpperCase()}` : '';
  ctx.fillText(fitText(ctx, `${institution}${unit}`, width - 140), width / 2, headerCenterY - 45);

  // Big Title: "ABSENSI PAGI" / "ABSENSI SORE"
  const sessionTitle = `ABSENSI ${settings.selectedSession.toUpperCase()}`;
  if (tmpl === 'beige') {
    ctx.font = '700 48px "Cormorant Garamond", Georgia, serif';
  } else if (tmpl === 'formal') {
    ctx.font = '800 44px "Plus Jakarta Sans", sans-serif';
  } else {
    ctx.font = '800 42px "Plus Jakarta Sans", sans-serif';
  }
  ctx.fillStyle = isFormalHeader ? '#FFFFFF' : primaryText;
  ctx.fillText(sessionTitle, width / 2, headerCenterY + 10);

  // Date & Page summary
  const dateFormatted = formatIndonesianDate(settings.selectedDate);
  ctx.font = '600 18px "Plus Jakarta Sans", sans-serif';
  ctx.fillStyle = isFormalHeader ? '#E2E8F0' : accentColor;
  ctx.fillText(`${dateFormatted}  ·  HALAMAN ${pageIndex + 1} DARI ${totalPages}`, width / 2, headerCenterY + 45);

  // 3. Photo Grid (3 Columns x 2 Rows = 6 slots)
  const gridTop = headerHeight + (isPortrait ? 50 : 35);
  const gridBottom = height - 80;
  const gridLeft = isPortrait ? 50 : 80;
  const gridRight = width - (isPortrait ? 50 : 80);
  const gridWidth = gridRight - gridLeft;
  const gridHeight = gridBottom - gridTop;

  const cols = 3;
  const rows = 2;
  const gapX = isPortrait ? 24 : 36;
  const gapY = isPortrait ? 28 : 28;

  const cardWidth = (gridWidth - (cols - 1) * gapX) / cols;
  const cardHeight = (gridHeight - (rows - 1) * gapY) / rows;

  for (let slot = 0; slot < 6; slot++) {
    const col = slot % cols;
    const row = Math.floor(slot / cols);
    const cardX = gridLeft + col * (cardWidth + gapX);
    const cardY = gridTop + row * (cardHeight + gapY);

    const attendee = pageRecords[slot];

    // Card background
    ctx.save();
    roundRect(ctx, cardX, cardY, cardWidth, cardHeight, 14);
    ctx.fillStyle = cardBg;
    ctx.fill();
    ctx.strokeStyle = cardBorder;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    if (attendee) {
      // Photo area
      const photoPadding = 12;
      const photoWidth = cardWidth - photoPadding * 2;
      const photoHeight = cardHeight - 88; // Space for name and NIP below
      const photoX = cardX + photoPadding;
      const photoY = cardY + photoPadding;

      // Clip photo to rounded container
      ctx.save();
      roundRect(ctx, photoX, photoY, photoWidth, photoHeight, 10);
      ctx.clip();

      const cachedImg = imageCache.get(attendee.photoUrl);
      if (cachedImg && cachedImg.complete && cachedImg.naturalWidth > 0) {
        // Draw image aspect-fill
        const imgAspect = cachedImg.naturalWidth / cachedImg.naturalHeight;
        const boxAspect = photoWidth / photoHeight;
        let sx = 0, sy = 0, sw = cachedImg.naturalWidth, sh = cachedImg.naturalHeight;

        if (imgAspect > boxAspect) {
          sw = cachedImg.naturalHeight * boxAspect;
          sx = (cachedImg.naturalWidth - sw) / 2;
        } else {
          sh = cachedImg.naturalWidth / boxAspect;
          sy = (cachedImg.naturalHeight - sh) / 2;
        }
        ctx.drawImage(cachedImg, sx, sy, sw, sh, photoX, photoY, photoWidth, photoHeight);
      } else {
        // Fallback photo placeholder
        ctx.fillStyle = '#E2E8F0';
        ctx.fillRect(photoX, photoY, photoWidth, photoHeight);
        ctx.fillStyle = '#64748B';
        ctx.font = '500 14px "Plus Jakarta Sans", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(attendee.name, photoX + photoWidth / 2, photoY + photoHeight / 2);
      }
      ctx.restore();

      // Border around photo
      ctx.strokeStyle = tmpl === 'beige' ? '#DFD5C2' : '#CBD5E1';
      ctx.lineWidth = 1;
      roundRect(ctx, photoX, photoY, photoWidth, photoHeight, 10);
      ctx.stroke();

      // Name & NIP text below photo
      ctx.textAlign = 'center';
      const textCenterY = cardY + cardHeight - 55;

      // Attendee Name
      ctx.font = '700 15px "Plus Jakarta Sans", sans-serif';
      ctx.fillStyle = primaryText;
      const fittedName = fitText(ctx, attendee.name, cardWidth - 24);
      ctx.fillText(fittedName, cardX + cardWidth / 2, textCenterY);

      // NIP in tabular mono font
      ctx.font = '600 13px "JetBrains Mono", monospace';
      ctx.fillStyle = secondaryText;
      const nipDisplay = `NIP: ${attendee.nip}`;
      ctx.fillText(nipDisplay, cardX + cardWidth / 2, textCenterY + 22);

      // Number badge on top right of photo
      const indexNum = String(pageIndex * 6 + slot + 1).padStart(2, '0');
      ctx.fillStyle = tmpl === 'formal' ? '#0B1D3A' : 'rgba(41,37,36,0.85)';
      roundRect(ctx, photoX + photoWidth - 36, photoY + 8, 28, 22, 6);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '700 11px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(indexNum, photoX + photoWidth - 22, photoY + 23);
    } else {
      // Empty slot placeholder
      ctx.strokeStyle = '#E2E8F0';
      ctx.setLineDash([6, 6]);
      roundRect(ctx, cardX + 12, cardY + 12, cardWidth - 24, cardHeight - 24, 10);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.textAlign = 'center';
      ctx.fillStyle = '#94A3B8';
      ctx.font = '500 14px "Plus Jakarta Sans", sans-serif';
      ctx.fillText('Slot Tersedia', cardX + cardWidth / 2, cardY + cardHeight / 2);
    }
    ctx.restore();
  }

  // 4. Footer Bar
  const footerY = height - 56;
  ctx.textAlign = 'center';

  // Divider line above footer
  ctx.strokeStyle = tmpl === 'beige' ? '#DFD5C2' : '#E2E8F0';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(60, footerY - 14);
  ctx.lineTo(width - 60, footerY - 14);
  ctx.stroke();

  // Left text: Total Attendees & Page
  ctx.font = '700 13px "Plus Jakarta Sans", sans-serif';
  ctx.fillStyle = primaryText;
  const leftSummary = `TOTAL: ${totalCount} PESERTA · HALAMAN ${pageIndex + 1} DARI ${totalPages}`;

  // Right text: System notes / Custom footer
  const rightNote = settings.footerNote || 'SISTEM DOKUMENTASI PRESENSI OTOMATIS';

  ctx.textAlign = 'left';
  ctx.fillText(leftSummary, 64, footerY + 10);

  ctx.textAlign = 'right';
  ctx.font = '500 12px "Plus Jakarta Sans", sans-serif';
  ctx.fillStyle = secondaryText;
  ctx.fillText(rightNote.toUpperCase(), width - 64, footerY + 10);
}

/**
 * Download a canvas as a PNG file directly in the browser
 */
export function downloadCanvasAsPng(canvas: HTMLCanvasElement, filename: string): void {
  const link = document.createElement('a');
  link.download = filename;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

/**
 * Copy canvas image to system clipboard
 */
export async function copyCanvasToClipboard(canvas: HTMLCanvasElement): Promise<boolean> {
  return new Promise((resolve) => {
    canvas.toBlob(async (blob) => {
      if (!blob) {
        resolve(false);
        return;
      }
      try {
        await navigator.clipboard.write([
          new ClipboardItem({
            'image/png': blob
          })
        ]);
        resolve(true);
      } catch (err) {
        console.warn('Clipboard write failed:', err);
        resolve(false);
      }
    }, 'image/png');
  });
}

/**
 * Batch generate and download all pages in a ZIP file
 */
export async function downloadAllPagesAsZip(
  attendees: AttendanceRecord[],
  settings: CollageSettings
): Promise<void> {
  const zip = new JSZip();
  const pages: AttendanceRecord[][] = [];
  for (let i = 0; i < attendees.length; i += 6) {
    pages.push(attendees.slice(i, i + 6));
  }
  const totalPages = Math.max(1, pages.length);

  const offscreenCanvas = document.createElement('canvas');

  for (let p = 0; p < totalPages; p++) {
    const pageRecords = pages[p] || [];
    await renderCollagePage(
      offscreenCanvas,
      pageRecords,
      p,
      totalPages,
      attendees.length,
      settings
    );

    const dataUrl = offscreenCanvas.toDataURL('image/png');
    const base64Data = dataUrl.replace(/^data:image\/png;base64,/, '');
    const pageNum = String(p + 1).padStart(2, '0');
    const filename = `Kolase_${settings.selectedSession}_${settings.selectedDate}_Halaman_${pageNum}.png`;
    zip.file(filename, base64Data, { base64: true });
  }

  const content = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(content);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Dokumentasi_Absensi_${settings.selectedSession}_${settings.selectedDate}.zip`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
