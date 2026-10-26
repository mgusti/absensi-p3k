/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useEffect, useState } from 'react';
import {
  Download,
  Share2,
  Copy,
  ChevronLeft,
  ChevronRight,
  Sliders,
  Check,
  Building,
  Calendar,
  Layers,
  Sparkles,
  FileArchive
} from 'lucide-react';
import {
  AttendanceRecord,
  AttendanceSession,
  CollageOrientation,
  CollageSettings,
  CollageTemplate,
  LogoPreset
} from '../types/attendance.ts';
import { filterAttendees, paginateAttendees, formatIndonesianDate } from '../utils/collageLogic.ts';
import {
  renderCollagePage,
  downloadCanvasAsPng,
  downloadAllPagesAsZip,
  copyCanvasToClipboard
} from '../utils/collageRenderer.ts';

interface CollageStudioProps {
  attendees: AttendanceRecord[];
  settings: CollageSettings;
  onUpdateSettings: (newSettings: Partial<CollageSettings>) => void;
  onQuickAddDemo: () => void;
}

export const CollageStudio: React.FC<CollageStudioProps> = ({
  attendees,
  settings,
  onUpdateSettings,
  onQuickAddDemo
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [isRendering, setIsRendering] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isDownloadingZip, setIsDownloadingZip] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Filter attendees based on selected date & session
  const activeAttendees = filterAttendees(
    attendees,
    settings.selectedDate,
    settings.selectedSession
  );

  const pages = paginateAttendees(activeAttendees, 6);
  const totalPages = Math.max(1, pages.length);

  // Ensure valid page index when list changes
  useEffect(() => {
    if (currentPageIndex >= totalPages) {
      setCurrentPageIndex(Math.max(0, totalPages - 1));
    }
  }, [totalPages, currentPageIndex]);

  // Re-render canvas whenever settings, attendees, or page change
  useEffect(() => {
    let isCancelled = false;
    const render = async () => {
      if (!canvasRef.current) return;
      setIsRendering(true);
      const currentRecords = pages[currentPageIndex] || [];
      await renderCollagePage(
        canvasRef.current,
        currentRecords,
        currentPageIndex,
        totalPages,
        activeAttendees.length,
        settings
      );
      if (!isCancelled) {
        setIsRendering(false);
      }
    };
    render();
    return () => {
      isCancelled = true;
    };
  }, [settings, attendees, currentPageIndex, totalPages, activeAttendees.length]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleDownloadSingle = () => {
    if (!canvasRef.current) return;
    const pageNum = String(currentPageIndex + 1).padStart(2, '0');
    const filename = `Kolase_${settings.selectedSession}_${settings.selectedDate}_Hal_${pageNum}.png`;
    downloadCanvasAsPng(canvasRef.current, filename);
    showToast(`Halaman ${currentPageIndex + 1} berhasil diunduh sebagai PNG.`);
  };

  const handleDownloadAllZip = async () => {
    setIsDownloadingZip(true);
    try {
      await downloadAllPagesAsZip(activeAttendees, settings);
      showToast(`Seluruh ${totalPages} halaman kolase berhasil diunduh dalam file ZIP.`);
    } catch (e) {
      console.error(e);
      showToast('Gagal membuat file ZIP.');
    } finally {
      setIsDownloadingZip(false);
    }
  };

  const handleCopyClipboard = async () => {
    if (!canvasRef.current) return;
    const success = await copyCanvasToClipboard(canvasRef.current);
    if (success) {
      setIsCopied(true);
      showToast('Gambar kolase berhasil disalin ke clipboard! Siap ditempel di dokumen / chat.');
      setTimeout(() => setIsCopied(false), 2500);
    } else {
      showToast('Browser belum mengizinkan penyalinan gambar langsung.');
    }
  };

  const handleWhatsAppShare = () => {
    const text = encodeURIComponent(
      `*DOKUMENTASI ABSENSI ${settings.selectedSession.toUpperCase()}*\n` +
      `Tanggal: ${formatIndonesianDate(settings.selectedDate)}\n` +
      `Total Kehadiran: ${activeAttendees.length} Peserta\n` +
      `Instansi: ${settings.institutionName}\n\n` +
      `Kolase foto presensi telah dibuat otomatis.`
    );
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  };

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-stone-900 text-white text-xs font-semibold px-4 py-3 rounded-xl shadow-xl border border-stone-700 animate-fade-in flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header & Breadcrumb Info */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white rounded-xl border border-stone-200 p-5 shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1">
            <span>Studio Dokumentasi</span>
            <span aria-hidden="true">·</span>
            <span className="text-stone-800 font-bold">Generator Kolase Otomatis</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-stone-900 tracking-tight">
            Pratinjau & Kustomisasi Kolase Foto
          </h1>
          <p className="text-xs text-stone-500 mt-1">
            Menyusun peserta ke dalam kisi 3 kolom × 2 baris (maks. 6 foto per halaman). Gambar beresolusi tinggi siap cetak atau dibagikan.
          </p>
        </div>

        {/* Quick actions */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleCopyClipboard}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-lg transition-colors"
          >
            {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{isCopied ? 'Tersalin!' : 'Salin Gambar'}</span>
          </button>

          <button
            onClick={handleWhatsAppShare}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Bagikan Ringkasan</span>
          </button>

          <button
            onClick={handleDownloadSingle}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-stone-900 hover:bg-stone-800 text-white rounded-lg shadow-sm transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Unduh Halaman {currentPageIndex + 1} (PNG)</span>
          </button>

          {totalPages > 1 && (
            <button
              onClick={handleDownloadAllZip}
              disabled={isDownloadingZip}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-amber-700 hover:bg-amber-800 text-white rounded-lg shadow-sm transition-colors disabled:opacity-50"
            >
              <FileArchive className="w-3.5 h-3.5" />
              <span>{isDownloadingZip ? 'Membuat ZIP...' : `Unduh Semua (${totalPages} Hal. ZIP)`}</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Studio Grid: Left Canvas Viewport + Right Control Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: Canvas Preview (lg:col-span-8) */}
        <div className="lg:col-span-8 flex flex-col items-center">
          {/* Top Session & Date selector pill bar */}
          <div className="w-full bg-white rounded-xl border border-stone-200 p-3 mb-4 flex flex-wrap items-center justify-between gap-3 shadow-sm">
            {/* Sesi selector */}
            <div className="flex items-center gap-1 p-1 bg-stone-100 rounded-lg">
              <button
                onClick={() => {
                  onUpdateSettings({ selectedSession: 'Pagi' });
                  setCurrentPageIndex(0);
                }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                  settings.selectedSession === 'Pagi'
                    ? 'bg-white text-stone-900 shadow-sm'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                ☀️ Absensi Pagi ({attendees.filter(a => a.date === settings.selectedDate && a.session === 'Pagi').length})
              </button>
              <button
                onClick={() => {
                  onUpdateSettings({ selectedSession: 'Sore' });
                  setCurrentPageIndex(0);
                }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                  settings.selectedSession === 'Sore'
                    ? 'bg-white text-stone-900 shadow-sm'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                🌙 Absensi Sore ({attendees.filter(a => a.date === settings.selectedDate && a.session === 'Sore').length})
              </button>
            </div>

            {/* Date Input */}
            <div className="flex items-center gap-2 text-xs">
              <Calendar className="w-4 h-4 text-stone-400" />
              <input
                type="date"
                value={settings.selectedDate}
                onChange={(e) => {
                  onUpdateSettings({ selectedDate: e.target.value });
                  setCurrentPageIndex(0);
                }}
                className="px-2 py-1 rounded border border-stone-200 text-stone-800 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-stone-900"
              />
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPageIndex((prev) => Math.max(0, prev - 1))}
                disabled={currentPageIndex === 0}
                className="p-1.5 rounded-lg border border-stone-200 text-stone-700 hover:bg-stone-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Halaman Sebelumnya"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-bold text-stone-800 px-1">
                Hal {currentPageIndex + 1} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPageIndex((prev) => Math.min(totalPages - 1, prev + 1))}
                disabled={currentPageIndex >= totalPages - 1}
                className="p-1.5 rounded-lg border border-stone-200 text-stone-700 hover:bg-stone-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Halaman Berikutnya"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Canvas Display Viewport */}
          <div className="w-full bg-stone-200/70 border border-stone-300 rounded-2xl p-4 sm:p-6 flex flex-col items-center justify-center min-h-[520px] overflow-x-auto shadow-inner relative">
            {isRendering && (
              <div className="absolute top-4 right-4 bg-stone-900/80 text-white text-xs px-2.5 py-1 rounded-md backdrop-blur-sm flex items-center gap-1.5 z-10 shadow-sm">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                <span>Memperbarui canvas...</span>
              </div>
            )}

            {/* Interactive Canvas Container */}
            <div className="relative shadow-2xl rounded-xl overflow-hidden max-w-full flex justify-center items-center bg-white">
              <canvas
                ref={canvasRef}
                className="max-h-[600px] sm:max-h-[640px] max-w-full w-auto h-auto object-contain transition-all duration-300 block"
                style={{
                  aspectRatio: settings.orientation === 'portrait' ? '1080 / 1350' : '1920 / 1080'
                }}
              />
            </div>

            {/* Page thumbnails strip if multiple pages */}
            {totalPages > 1 && (
              <div className="mt-4 flex items-center gap-2 overflow-x-auto py-2">
                {Array.from({ length: totalPages }).map((_, idx) => {
                  const isCurrent = currentPageIndex === idx;
                  const countInPage = pages[idx]?.length || 0;
                  return (
                    <button
                      key={idx}
                      onClick={() => setCurrentPageIndex(idx)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                        isCurrent
                          ? 'bg-stone-900 text-white border-stone-900 shadow-md'
                          : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-50'
                      }`}
                    >
                      Halaman {idx + 1} ({countInPage} Foto)
                    </button>
                  );
                })}
              </div>
            )}

            {/* Info Summary below canvas */}
            <div className="mt-3 text-center text-xs text-stone-600">
              Menampilkan {pages[currentPageIndex]?.length || 0} dari total {activeAttendees.length} peserta pada sesi ini · Resolusi ekspor: {settings.orientation === 'portrait' ? '1080 × 1350 px (4:5)' : '1920 × 1080 px (16:9)'}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Settings & Customization Panel (lg:col-span-4) */}
        <div className="lg:col-span-4 bg-white rounded-xl border border-stone-200 p-5 shadow-sm space-y-6">
          <div className="flex items-center gap-2 border-b border-stone-100 pb-3">
            <Sliders className="w-4 h-4 text-stone-700" />
            <h2 className="text-sm font-bold text-stone-900">Pengaturan Desain & Format</h2>
          </div>

          {/* 1. Template Bingkai Selection */}
          <div>
            <label className="block text-xs font-bold text-stone-700 mb-2">
              Pilihan Desain Bingkai
            </label>
            <div className="grid grid-cols-1 gap-2">
              {/* Template A: Elegan Beige */}
              <button
                type="button"
                onClick={() => onUpdateSettings({ template: 'beige' })}
                className={`p-3 rounded-xl border text-left transition-all flex items-start gap-3 ${
                  settings.template === 'beige'
                    ? 'border-amber-600 bg-amber-50/60 ring-2 ring-amber-600/30'
                    : 'border-stone-200 hover:border-stone-300 bg-white'
                }`}
              >
                <div className="w-8 h-8 rounded-lg bg-[#F8F5EE] border border-[#D9CEB8] shrink-0 flex items-center justify-center">
                  <span className="text-amber-800 text-xs font-serif font-bold">A</span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-stone-900">Elegan Beige (Referensi)</span>
                    {settings.template === 'beige' && <Check className="w-3.5 h-3.5 text-amber-700" />}
                  </div>
                  <p className="text-[11px] text-stone-500 mt-0.5 leading-snug">
                    Latar krem hangat, border tipis, tipografi klasik modern. Cocok untuk dokumentasi formal.
                  </p>
                </div>
              </button>

              {/* Template B: Formal Instansi */}
              <button
                type="button"
                onClick={() => onUpdateSettings({ template: 'formal' })}
                className={`p-3 rounded-xl border text-left transition-all flex items-start gap-3 ${
                  settings.template === 'formal'
                    ? 'border-blue-800 bg-blue-50/60 ring-2 ring-blue-800/30'
                    : 'border-stone-200 hover:border-stone-300 bg-white'
                }`}
              >
                <div className="w-8 h-8 rounded-lg bg-[#0B1D3A] text-white shrink-0 flex items-center justify-center font-bold text-xs">
                  B
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-stone-900">Formal Instansi</span>
                    {settings.template === 'formal' && <Check className="w-3.5 h-3.5 text-blue-800" />}
                  </div>
                  <p className="text-[11px] text-stone-500 mt-0.5 leading-snug">
                    Header biru tua, border tegas, aksen emas. Tampilan arsip kantor & dinas pemerintah.
                  </p>
                </div>
              </button>

              {/* Template C: Minimalis Modern */}
              <button
                type="button"
                onClick={() => onUpdateSettings({ template: 'minimal' })}
                className={`p-3 rounded-xl border text-left transition-all flex items-start gap-3 ${
                  settings.template === 'minimal'
                    ? 'border-stone-900 bg-stone-100 ring-2 ring-stone-900/30'
                    : 'border-stone-200 hover:border-stone-300 bg-white'
                }`}
              >
                <div className="w-8 h-8 rounded-lg bg-white border border-stone-300 text-stone-900 shrink-0 flex items-center justify-center font-bold text-xs">
                  C
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-stone-900">Minimalis Modern</span>
                    {settings.template === 'minimal' && <Check className="w-3.5 h-3.5 text-stone-900" />}
                  </div>
                  <p className="text-[11px] text-stone-500 mt-0.5 leading-snug">
                    Latar putih bersih, garis tipis presisi, kontras tinggi dan ringan.
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* 2. Orientasi Gambar */}
          <div>
            <label className="block text-xs font-bold text-stone-700 mb-2">
              Orientasi Gambar Kolase
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onUpdateSettings({ orientation: 'portrait' })}
                className={`py-2 px-3 rounded-lg border text-xs font-semibold text-center transition-all ${
                  settings.orientation === 'portrait'
                    ? 'border-stone-900 bg-stone-900 text-white'
                    : 'border-stone-200 text-stone-700 hover:bg-stone-50'
                }`}
              >
                <span>📱 Potret 4:5</span>
                <span className="block text-[10px] opacity-80">1080 × 1350 (WhatsApp)</span>
              </button>
              <button
                type="button"
                onClick={() => onUpdateSettings({ orientation: 'landscape' })}
                className={`py-2 px-3 rounded-lg border text-xs font-semibold text-center transition-all ${
                  settings.orientation === 'landscape'
                    ? 'border-stone-900 bg-stone-900 text-white'
                    : 'border-stone-200 text-stone-700 hover:bg-stone-50'
                }`}
              >
                <span>🖥️ Lanskap 16:9</span>
                <span className="block text-[10px] opacity-80">1920 × 1080 (Laporan)</span>
              </button>
            </div>
          </div>

          {/* 3. Identitas Instansi & Header */}
          <div className="space-y-3 border-t border-stone-100 pt-3">
            <label className="block text-xs font-bold text-stone-700">
              Identitas Instansi / Organisasi
            </label>
            <div>
              <span className="text-[11px] text-stone-500 mb-1 block">Nama Instansi</span>
              <input
                type="text"
                value={settings.institutionName}
                onChange={(e) => onUpdateSettings({ institutionName: e.target.value })}
                placeholder="Contoh: DINAS KOMUNIKASI DAN INFORMATIKA"
                className="w-full px-3 py-1.5 rounded-lg border border-stone-300 text-stone-900 text-xs focus:outline-none focus:ring-1 focus:ring-stone-900"
              />
            </div>
            <div>
              <span className="text-[11px] text-stone-500 mb-1 block">Sub-Unit Kerja (Opsional)</span>
              <input
                type="text"
                value={settings.unitName}
                onChange={(e) => onUpdateSettings({ unitName: e.target.value })}
                placeholder="Contoh: BIDANG TATA USAHA"
                className="w-full px-3 py-1.5 rounded-lg border border-stone-300 text-stone-900 text-xs focus:outline-none focus:ring-1 focus:ring-stone-900"
              />
            </div>
            <div>
              <span className="text-[11px] text-stone-500 mb-1 block">Catatan / Slogan Footer</span>
              <input
                type="text"
                value={settings.footerNote}
                onChange={(e) => onUpdateSettings({ footerNote: e.target.value })}
                placeholder="Contoh: Dokumentasi Kehadiran Resmi Pegawai"
                className="w-full px-3 py-1.5 rounded-lg border border-stone-300 text-stone-900 text-xs focus:outline-none focus:ring-1 focus:ring-stone-900"
              />
            </div>
          </div>

          {/* 4. Kebijakan Duplikasi NIP */}
          <div className="border-t border-stone-100 pt-3">
            <label className="block text-xs font-bold text-stone-700 mb-1">
              Aturan Jika NIP Mengisi 2x di Sesi Sama
            </label>
            <select
              value={settings.duplicatePolicy}
              onChange={(e) => onUpdateSettings({ duplicatePolicy: e.target.value as any })}
              className="w-full px-3 py-2 rounded-lg border border-stone-300 text-stone-900 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-stone-900"
            >
              <option value="reject">Tolak Duplikasi (Hanya absensi pertama yang sah)</option>
              <option value="flag">Simpan & Tandai Duplikat (Untuk verifikasi admin)</option>
              <option value="overwrite">Timpa dengan Absensi Terbaru</option>
            </select>
          </div>

          {/* Quick Demo Button */}
          <div className="border-t border-stone-100 pt-3">
            <button
              type="button"
              onClick={onQuickAddDemo}
              className="w-full py-2 px-3 border border-stone-300 rounded-lg text-xs font-medium text-stone-700 hover:bg-stone-50 transition-colors flex items-center justify-center gap-2"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              <span>Muat Ulang 14 Peserta Demo (3 Halaman: 6+6+2)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
