/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AttendanceRecord, CollageSettings } from '../types/attendance.ts';
import { formatIndonesianDate, generatePdfFileName, extractDriveImageId } from './collageLogic.ts';
import { fetchDriveImageBlob } from '../services/firebase.ts';
import JSZip from 'jszip';
import { jsPDF } from 'jspdf';

// Cache for resolved Object/Data URLs
export const resolvedUrlCache = new Map<string, string>();
// Cache for loaded HTMLImageElements
export const imageCache = new Map<string, HTMLImageElement>();

/**
 * Mengosongkan cache foto saat token otentikasi Google diperbarui
 */
export function clearImageCache(): void {
  imageCache.clear();
  resolvedUrlCache.clear();
}

/**
 * Resolves Google Drive URLs into local, CORS-safe Blob/Data URLs using OAuth token if available,
 * or fallback endpoints, so photos render sharply on Canvas and embed into PDF without tainting.
 */
export async function resolvePhotoUrl(rawUrl: string): Promise<string> {
  if (!rawUrl) return '';
  // Already safe local data or blob
  if (rawUrl.startsWith('data:') || rawUrl.startsWith('blob:')) {
    return rawUrl;
  }

  if (resolvedUrlCache.has(rawUrl)) {
    return resolvedUrlCache.get(rawUrl)!;
  }

  const fileId = extractDriveImageId(rawUrl);
  if (fileId) {
    try {
      const blob = await fetchDriveImageBlob(fileId);
      if (blob) {
        const objectUrl = URL.createObjectURL(blob);
        resolvedUrlCache.set(rawUrl, objectUrl);
        return objectUrl;
      }
    } catch (e) {
      console.warn('Gagal mengambil blob Drive untuk file ID:', fileId, e);
    }

    // Fallback: fetch via lh3 URL to get CORS-safe Blob URL
    const fallbackUrl = `https://lh3.googleusercontent.com/d/${fileId}=w1000`;
    try {
      const res = await fetch(fallbackUrl);
      if (res.ok) {
        const blob = await res.blob();
        const objectUrl = URL.createObjectURL(blob);
        resolvedUrlCache.set(rawUrl, objectUrl);
        return objectUrl;
      }
    } catch {
      // Last resort: return raw URL (may taint canvas)
    }
  }

  return rawUrl;
}

export async function preloadImage(src: string): Promise<HTMLImageElement> {
  if (imageCache.has(src)) {
    const cached = imageCache.get(src)!;
    if (cached.complete && cached.naturalWidth > 0) {
      return cached;
    }
  }

  const resolved = await resolvePhotoUrl(src);
  if (resolved !== src && imageCache.has(resolved)) {
    const cached = imageCache.get(resolved)!;
    if (cached.complete && cached.naturalWidth > 0) {
      imageCache.set(src, cached);
      return cached;
    }
  }

  return new Promise((resolve) => {
    const img = new Image();
    const isBlobOrData = resolved.startsWith('blob:') || resolved.startsWith('data:');

    // Only set anonymous crossOrigin for external HTTP/HTTPS URLs
    if (!isBlobOrData) {
      img.crossOrigin = 'anonymous';
    }

    img.onload = () => {
      imageCache.set(src, img);
      imageCache.set(resolved, img);
      resolve(img);
    };

    img.onerror = () => {
      console.warn('Gagal memuat gambar peserta:', resolved);
      // Never retry without crossOrigin — that taints the canvas and
      // blocks toDataURL/toBlob on PDF/PNG/ZIP export.
      // Resolve with the failed img (naturalWidth === 0) so the
      // renderer falls through to the avatar-initials fallback.
      imageCache.set(src, img);
      resolve(img);
    };

    img.src = resolved;
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

      const targetUrl = resolvedUrlCache.get(attendee.photoUrl) || attendee.photoUrl;
      const cachedImg = imageCache.get(attendee.photoUrl) || imageCache.get(targetUrl);
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
        // High-fidelity fallback avatar with participant's initials
        ctx.fillStyle = tmpl === 'formal' ? '#0F172A' : '#EAE4D5';
        ctx.fillRect(photoX, photoY, photoWidth, photoHeight);

        // Silhouette avatar shape / monogram circle
        ctx.fillStyle = tmpl === 'formal' ? '#1E293B' : '#D8CFBC';
        ctx.beginPath();
        ctx.arc(photoX + photoWidth / 2, photoY + photoHeight * 0.42, photoWidth * 0.24, 0, Math.PI * 2);
        ctx.fill();

        // Initials in center of circle
        const initials = attendee.name
          .replace(/^(dr\.|drs\.|drg\.|ir\.|h\.|hj\.)\s+/i, '')
          .split(' ')
          .filter(Boolean)
          .slice(0, 2)
          .map((n) => n[0].toUpperCase())
          .join('') || 'P3K';

        ctx.fillStyle = tmpl === 'formal' ? '#94A3B8' : '#78716C';
        ctx.font = '700 24px "Plus Jakarta Sans", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(initials, photoX + photoWidth / 2, photoY + photoHeight * 0.45);

        // Label at bottom
        ctx.fillStyle = tmpl === 'formal' ? '#CBD5E1' : '#44403C';
        ctx.font = '700 11px "Plus Jakarta Sans", sans-serif';
        ctx.fillText('FOTO DOKUMENTASI', photoX + photoWidth / 2, photoY + photoHeight - 16);
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
 * Render all collage pages into a single multi-page PDF document.
 * If there are 2 images/pages (e.g. 7-12 attendees), the resulting PDF has exactly 2 pages.
 * 1 image = 1 PDF page, rendered at high resolution matching the collage orientation.
 */
export async function generateCollagePdfBlob(
  attendees: AttendanceRecord[],
  settings: CollageSettings,
  onProgress?: (current: number, total: number, phase: string) => void
): Promise<{ blob: Blob; filename: string; pageCount: number }> {
  const pages: AttendanceRecord[][] = [];
  for (let i = 0; i < attendees.length; i += 6) {
    pages.push(attendees.slice(i, i + 6));
  }
  const totalPages = Math.max(1, pages.length);

  const isPortrait = settings.orientation === 'portrait';
  // Aspect ratio matches canvas (portrait 1080x1350 = 4:5, landscape 1920x1080 = 16:9)
  const orientation = isPortrait ? 'portrait' : 'landscape';
  // Standard high-definition PDF page dimension in mm
  const pdfWidth = isPortrait ? 210 : 297;
  const pdfHeight = isPortrait ? Math.round(210 * (1350 / 1080)) : Math.round(297 * (1080 / 1920));

  const pdf = new jsPDF({
    orientation,
    unit: 'mm',
    format: [pdfWidth, pdfHeight],
    compress: true
  });

  const offscreenCanvas = document.createElement('canvas');

  for (let p = 0; p < totalPages; p++) {
    if (onProgress) {
      onProgress(p + 1, totalPages, `Merender halaman ${p + 1} dari ${totalPages}...`);
    }

    if (p > 0) {
      pdf.addPage([pdfWidth, pdfHeight], orientation);
    }

    const pageRecords = pages[p] || [];
    await renderCollagePage(
      offscreenCanvas,
      pageRecords,
      p,
      totalPages,
      attendees.length,
      settings
    );

    // High quality JPEG compression for optimal PDF size and razor-sharp clarity
    const imgData = offscreenCanvas.toDataURL('image/jpeg', 0.95);
    pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
  }

  if (onProgress) {
    onProgress(totalPages, totalPages, 'Menyusun dokumen PDF multi-halaman...');
  }

  const filename = generatePdfFileName(settings.selectedSession, settings.selectedDate, totalPages);
  const blob = pdf.output('blob');

  return { blob, filename, pageCount: totalPages };
}

/**
 * Downloads all collage pages as a single multi-page PDF document.
 */
export async function downloadAllPagesAsPdf(
  attendees: AttendanceRecord[],
  settings: CollageSettings,
  onProgress?: (current: number, total: number, phase: string) => void
): Promise<{ filename: string; pageCount: number }> {
  const { blob, filename, pageCount } = await generateCollagePdfBlob(attendees, settings, onProgress);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return { filename, pageCount };
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
