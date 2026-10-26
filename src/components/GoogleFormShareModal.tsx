/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { X, Copy, Check, ExternalLink, Share2, QrCode, Download, Printer, Eye } from 'lucide-react';
import QRCode from 'qrcode';

interface GoogleFormShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  formUrl: string;
}

export const GoogleFormShareModal: React.FC<GoogleFormShareModalProps> = ({
  isOpen,
  onClose,
  formUrl
}) => {
  if (!isOpen) return null;

  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [viewMode, setViewMode] = useState<'qr' | 'embed'>('qr');

  useEffect(() => {
    QRCode.toDataURL(formUrl, {
      width: 320,
      margin: 2,
      color: {
        dark: '#1c1917',
        light: '#ffffff'
      }
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error(err));
  }, [formUrl]);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(formUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = formUrl;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleShareWhatsApp = () => {
    const text = encodeURIComponent(
      `*PRESENSI HARIAN PEGAWAI (ABSENSI P3K)*\n\n` +
      `Bapak/Ibu rekan P3K, silakan mengisi formulir kehadiran dan mengunggah foto selfie dokumentasi melalui tautan berikut:\n` +
      `${formUrl}\n\n` +
      `Pastikan mengisi NIP, Nama, dan Sesi yang sesuai. Foto akan otomatis disusun menjadi lembar kolase dokumentasi kehadiran.`
    );
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  };

  const handleDownloadQr = () => {
    if (!qrDataUrl) return;
    const link = document.createElement('a');
    link.download = 'QR_Code_Absensi_P3K.png';
    link.href = qrDataUrl;
    link.click();
  };

  const handlePrintQrSheet = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Cetak QR Code Absensi P3K</title>
          <style>
            body { font-family: sans-serif; text-align: center; padding: 40px; }
            .card { border: 2px solid #292524; border-radius: 16px; padding: 30px; max-width: 480px; margin: 0 auto; }
            h1 { font-size: 24px; margin-bottom: 4px; color: #1c1917; }
            p { color: #57534e; font-size: 14px; margin-top: 0; }
            img { width: 280px; height: 280px; margin: 20px 0; }
            .footer { font-size: 12px; color: #78716c; border-top: 1px solid #e7e5e4; padding-top: 15px; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>SCAN UNTUK PRESENSI</h1>
            <p>Dokumentasi Kehadiran Pegawai P3K</p>
            <img src="${qrDataUrl}" alt="QR Code" />
            <p>Arahkan kamera HP Anda ke QR code di atas untuk membuka formulir absensi.</p>
            <div class="footer">Sistem AutoAbsen Kolase Otomatis</div>
          </div>
          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-stone-200 overflow-hidden relative">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-stone-100">
          <div className="flex items-center gap-2">
            <QrCode className="w-5 h-5 text-amber-600" />
            <h2 className="text-base font-bold text-stone-900">
              Bagikan Formulir Absensi Google Form
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* View mode toggle */}
        <div className="mt-4 flex items-center gap-2 p-1 bg-stone-100 rounded-lg">
          <button
            onClick={() => setViewMode('qr')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center justify-center gap-2 ${
              viewMode === 'qr'
                ? 'bg-white text-stone-900 shadow-sm'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <QrCode className="w-4 h-4" />
            <span>Tautan & QR Code Scan HP</span>
          </button>
          <button
            onClick={() => setViewMode('embed')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center justify-center gap-2 ${
              viewMode === 'embed'
                ? 'bg-white text-stone-900 shadow-sm'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <Eye className="w-4 h-4" />
            <span>Pratinjau Langsung Formulir</span>
          </button>
        </div>

        {viewMode === 'qr' ? (
          <div className="mt-5 space-y-5">
            {/* Link Box */}
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                Tautan Langsung Google Form Peserta:
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={formUrl}
                  className="flex-1 px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs font-mono text-stone-700 select-all"
                />
                <button
                  onClick={handleCopyLink}
                  className="px-3 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shrink-0 transition-colors"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Tersalin' : 'Salin'}</span>
                </button>
                <a
                  href={formUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="p-2 border border-stone-200 hover:bg-stone-50 rounded-lg text-stone-700 transition-colors"
                  title="Buka di tab baru"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>

            {/* QR Code Container */}
            <div className="border border-stone-200 rounded-xl p-4 bg-stone-50 flex flex-col sm:flex-row items-center gap-6">
              <div className="bg-white p-2 rounded-xl shadow-sm border border-stone-200 shrink-0">
                {qrDataUrl ? (
                  <img src={qrDataUrl} alt="QR Code Presensi" className="w-36 h-36" />
                ) : (
                  <div className="w-36 h-36 bg-stone-100 flex items-center justify-center text-xs text-stone-400">
                    Membuat QR...
                  </div>
                )}
              </div>

              <div className="flex-1 text-center sm:text-left space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-stone-700">
                  Scan QR Code Menggunakan Kamera HP
                </h3>
                <p className="text-xs text-stone-600">
                  Peserta cukup mengarahkan kamera ponsel ke QR code ini untuk langsung membuka Google Form absensi tanpa perlu mengetik tautan.
                </p>
                <div className="pt-2 flex flex-wrap items-center justify-center sm:justify-start gap-2">
                  <button
                    onClick={handleDownloadQr}
                    className="px-3 py-1.5 bg-white border border-stone-300 hover:bg-stone-50 text-stone-800 text-xs font-semibold rounded-lg shadow-2xs flex items-center gap-1.5 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Unduh Gambar QR</span>
                  </button>
                  <button
                    onClick={handlePrintQrSheet}
                    className="px-3 py-1.5 bg-white border border-stone-300 hover:bg-stone-50 text-stone-800 text-xs font-semibold rounded-lg shadow-2xs flex items-center gap-1.5 transition-colors"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Cetak Lembar Meja</span>
                  </button>
                </div>
              </div>
            </div>

            {/* WhatsApp Share Button */}
            <div className="pt-2 border-t border-stone-100">
              <button
                onClick={handleShareWhatsApp}
                className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm flex items-center justify-center gap-2 transition-colors"
              >
                <Share2 className="w-4 h-4" />
                <span>Bagikan Tautan Absensi ke Grup WhatsApp</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-4">
            <div className="w-full h-[460px] rounded-xl overflow-hidden border border-stone-200 bg-stone-50">
              <iframe
                src={formUrl}
                width="100%"
                height="100%"
                title="Google Form Presensi"
                className="w-full h-full border-none"
              >
                Memuat formulir Google Form...
              </iframe>
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-stone-500">
              <span>Jika iframe tidak tampil karena batasan Google, buka langsung melalui link.</span>
              <a
                href={formUrl}
                target="_blank"
                rel="noreferrer"
                className="text-stone-900 font-semibold underline flex items-center gap-1"
              >
                Buka Tab Penuh <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
