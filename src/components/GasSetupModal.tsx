/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Copy, Check, ExternalLink, Code2, FolderGit2, CheckCircle2, ChevronRight, FileCode } from 'lucide-react';
import { GOOGLE_APPS_SCRIPT_CODE } from '../utils/googleAppsScriptTemplate.ts';

export const GasSetupModal: React.FC = () => {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'code' | 'guide' | 'structure'>('code');

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(GOOGLE_APPS_SCRIPT_CODE);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = GOOGLE_APPS_SCRIPT_CODE;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 sm:px-6">
      {/* Header Info */}
      <div className="mb-6 bg-white rounded-xl border border-stone-200 p-6 shadow-sm">
        <div className="flex items-center gap-2 text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1">
          <Code2 className="w-4 h-4 text-amber-600" />
          <span>Integrasi Google Workspace</span>
        </div>
        <h1 className="text-2xl font-bold text-stone-900 tracking-tight">
          Kode Google Apps Script & Panduan Penyiapan
        </h1>
        <p className="text-sm text-stone-600 mt-1">
          Gunakan script di bawah ini pada Google Sheets Anda agar setiap kali peserta mengisi Google Forms, gambar kolase dokumentasi presensi otomatis dibuat di Google Drive tanpa perlu campur tangan admin.
        </p>

        {/* Tab switchers */}
        <div className="mt-5 flex items-center gap-2 border-b border-stone-100 pb-2 overflow-x-auto whitespace-nowrap">
          <button
            onClick={() => setActiveTab('code')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-2 shrink-0 ${
              activeTab === 'code'
                ? 'bg-stone-900 text-white'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
            }`}
          >
            <FileCode className="w-4 h-4 shrink-0" />
            <span>Kode Script Lengkap (.gs)</span>
          </button>
          <button
            onClick={() => setActiveTab('guide')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-2 shrink-0 ${
              activeTab === 'guide'
                ? 'bg-stone-900 text-white'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
            }`}
          >
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>5 Langkah Google Form</span>
          </button>
          <button
            onClick={() => setActiveTab('structure')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-2 shrink-0 ${
              activeTab === 'structure'
                ? 'bg-stone-900 text-white'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
            }`}
          >
            <FolderGit2 className="w-4 h-4 shrink-0" />
            <span>Struktur Sheets & Drive</span>
          </button>
        </div>
      </div>

      {/* Tab 1: Code */}
      {activeTab === 'code' && (
        <div className="bg-stone-950 text-stone-100 rounded-xl border border-stone-800 shadow-xl overflow-hidden">
          <div className="bg-stone-900/90 border-b border-stone-800 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-rose-500/80 inline-block" />
              <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block" />
              <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block" />
              <span className="text-xs font-mono text-stone-400 ml-2">AutoAbsenKolase.gs</span>
            </div>
            <button
              onClick={handleCopyCode}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-white text-xs font-semibold rounded-lg transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Tersalin ke Clipboard!' : 'Salin Seluruh Kode'}</span>
            </button>
          </div>
          <pre className="p-4 text-xs font-mono overflow-x-auto text-stone-300 max-h-[600px] leading-relaxed">
            <code>{GOOGLE_APPS_SCRIPT_CODE}</code>
          </pre>
        </div>
      )}

      {/* Tab 2: Step-by-step Guide */}
      {activeTab === 'guide' && (
        <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-sm space-y-6">
          <h2 className="text-base font-bold text-stone-900">
            Panduan 5 Langkah Menghubungkan Google Forms ke Sistem Kolase Otomatis
          </h2>

          <div className="space-y-4">
            {/* Step 1 */}
            <div className="border border-stone-200 rounded-xl p-4 flex items-start gap-4 hover:border-stone-300 transition-colors">
              <div className="w-7 h-7 rounded-full bg-stone-900 text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                1
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-stone-900">Buat Google Form Baru</h3>
                <p className="text-xs text-stone-600 mt-1">
                  Buka <strong>forms.google.com</strong> dan buat formulir dengan urutan pertanyaan berikut:
                </p>
                <ul className="mt-2 text-xs text-stone-600 list-disc list-inside space-y-1 bg-stone-50 p-3 rounded-lg border border-stone-100">
                  <li><strong>Pertanyaan 1:</strong> NIP (Jenis: Jawaban Singkat, Wajib Diisi)</li>
                  <li><strong>Pertanyaan 2:</strong> Nama Lengkap & Gelar (Jenis: Jawaban Singkat, Wajib Diisi)</li>
                  <li><strong>Pertanyaan 3:</strong> Sesi Absensi (Jenis: Pilihan Ganda: <em>Pagi</em> dan <em>Sore</em>, Wajib Diisi)</li>
                  <li><strong>Pertanyaan 4:</strong> Unggah Foto Diri / Bukti Kehadiran (Jenis: Upload File ke Drive, Maks 10MB, Wajib Diisi)</li>
                </ul>
              </div>
            </div>

            {/* Step 2 */}
            <div className="border border-stone-200 rounded-xl p-4 flex items-start gap-4 hover:border-stone-300 transition-colors">
              <div className="w-7 h-7 rounded-full bg-stone-900 text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                2
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-stone-900">Hubungkan Form ke Google Spreadsheet</h3>
                <p className="text-xs text-stone-600 mt-1">
                  Pada tab <strong>Jawaban (Responses)</strong> di Google Form, klik ikon <strong>Link to Sheets (Hubungkan ke Spreadsheet)</strong> untuk membuat spreadsheet baru.
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="border border-stone-200 rounded-xl p-4 flex items-start gap-4 hover:border-stone-300 transition-colors">
              <div className="w-7 h-7 rounded-full bg-stone-900 text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                3
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-stone-900">Tempel Kode Apps Script</h3>
                <p className="text-xs text-stone-600 mt-1">
                  Di Google Spreadsheet yang baru dibuat, klik menu <strong>Ekstensi (Extensions) &gt; Apps Script</strong>. Hapus kode default yang ada, lalu salin dan tempel kode dari tab <em>Kode Script Lengkap</em>. Simpan dengan menekan Ctrl+S.
                </p>
              </div>
            </div>

            {/* Step 4 */}
            <div className="border border-stone-200 rounded-xl p-4 flex items-start gap-4 hover:border-stone-300 transition-colors">
              <div className="w-7 h-7 rounded-full bg-stone-900 text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                4
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-stone-900">Jalankan Inisialisasi Sheet</h3>
                <p className="text-xs text-stone-600 mt-1">
                  Pilih fungsi <code>inisialisasiSpreadsheet</code> pada dropdown fungsi di toolbar Apps Script, lalu klik <strong>Jalankan (Run)</strong>. Setujui permintaan otorisasi Google. Tindakan ini akan membuat sheet <code>PENGATURAN</code> secara otomatis di spreadsheet.
                </p>
              </div>
            </div>

            {/* Step 5 */}
            <div className="border border-stone-200 rounded-xl p-4 flex items-start gap-4 hover:border-stone-300 transition-colors">
              <div className="w-7 h-7 rounded-full bg-stone-900 text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                5
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-stone-900">Pasang Pemicu Otomatis (Trigger onFormSubmit)</h3>
                <p className="text-xs text-stone-600 mt-1">
                  Di panel kiri Apps Script, klik ikon jam (<strong>Triggers / Pemicu</strong>), lalu klik <strong>+ Add Trigger</strong>:
                </p>
                <div className="mt-2 bg-stone-50 p-3 rounded-lg border border-stone-100 text-xs text-stone-700 space-y-1 font-mono">
                  <div>• Pilih fungsi: onFormSubmitTrigger</div>
                  <div>• Sumber acara: Dari spreadsheet</div>
                  <div>• Jenis acara: Saat mengirim formulir (On form submit)</div>
                </div>
                <p className="text-xs text-emerald-700 font-semibold mt-2">
                  ✓ Selesai! Mulai sekarang, setiap peserta yang mengirim form akan otomatis diolah dan kolasenya tersimpan di folder Google Drive.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Structure */}
      {activeTab === 'structure' && (
        <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-sm space-y-6">
          <h2 className="text-base font-bold text-stone-900">
            Struktur Data Google Sheets & Folder Google Drive
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Sheet Structure */}
            <div className="border border-stone-200 rounded-xl p-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-2">
                1. Struktur Kolom Google Sheets
              </h3>
              <div className="space-y-2 text-xs font-mono">
                <div className="p-2 bg-stone-50 rounded border border-stone-100">
                  <span className="font-bold text-stone-900">Kolom A:</span> Timestamp (Waktu Otomatis)
                </div>
                <div className="p-2 bg-stone-50 rounded border border-stone-100">
                  <span className="font-bold text-stone-900">Kolom B:</span> NIP Peserta (Contoh: 19880315...)
                </div>
                <div className="p-2 bg-stone-50 rounded border border-stone-100">
                  <span className="font-bold text-stone-900">Kolom C:</span> Nama Lengkap & Gelar
                </div>
                <div className="p-2 bg-stone-50 rounded border border-stone-100">
                  <span className="font-bold text-stone-900">Kolom D:</span> Sesi (Pagi / Sore)
                </div>
                <div className="p-2 bg-stone-50 rounded border border-stone-100">
                  <span className="font-bold text-stone-900">Kolom E:</span> Tautan File Foto Drive
                </div>
                <div className="p-2 bg-stone-50 rounded border border-stone-100">
                  <span className="font-bold text-stone-900">Kolom F:</span> Status Pemrosesan Kolase
                </div>
              </div>
            </div>

            {/* Drive Structure */}
            <div className="border border-stone-200 rounded-xl p-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-2">
                2. Struktur Otomatis Folder Google Drive
              </h3>
              <div className="bg-stone-900 text-stone-200 p-3.5 rounded-lg font-mono text-xs leading-relaxed overflow-x-auto">
                <div className="text-amber-400 font-bold">ABSENSI HARIAN/</div>
                <div className="ml-4 text-stone-400">├── 2026-10-26/</div>
                <div className="ml-8 text-stone-300">├── PAGI/</div>
                <div className="ml-12 text-emerald-400">├── Kolase_01.png (Peserta 1-6)</div>
                <div className="ml-12 text-emerald-400">├── Kolase_02.png (Peserta 7-12)</div>
                <div className="ml-12 text-emerald-400">└── Kolase_03.png (Peserta 13-14)</div>
                <div className="ml-8 text-stone-300">└── SORE/</div>
                <div className="ml-12 text-emerald-400">└── Kolase_01.png (Peserta 1-4)</div>
                <div className="ml-4 text-stone-400">└── 2026-10-27/</div>
              </div>
              <p className="text-xs text-stone-500 mt-3">
                File diperbarui secara otomatis tanpa membuat salinan berulang setiap kali peserta baru mengisi form.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
