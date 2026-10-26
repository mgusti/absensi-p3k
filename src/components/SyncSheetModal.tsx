/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { X, RefreshCw, Upload, Check, FileSpreadsheet, Sparkles, AlertCircle } from 'lucide-react';
import { AttendanceRecord } from '../types/attendance.ts';
import { parseGoogleSheetCsv } from '../utils/collageLogic.ts';

interface SyncSheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportRecords: (newRecords: AttendanceRecord[]) => void;
}

const DEFAULT_USER_CSV = `Timestamp, NIP,Nama Lengkap & Gelar,Unggah Foto Diri / Bukti Kehadiran,Sesi Absensi
10/26/2026 14:43:03,1123123,aaaaaaaaaa,https://drive.google.com/open?id=1a3XjL1j4GiPFVDxHyuhOYFvlOnUhPH90,Pagi
10/26/2026 16:00:49,1412414,gusti,https://drive.google.com/open?id=1qkEdHTDBtQxta0hiqI9MujdCorG_Lf4E,Pagi`;

export const SyncSheetModal: React.FC<SyncSheetModalProps> = ({
  isOpen,
  onClose,
  onImportRecords
}) => {
  if (!isOpen) return null;

  const [csvText, setCsvText] = useState(DEFAULT_USER_CSV);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const handleApplyImport = () => {
    try {
      const records = parseGoogleSheetCsv(csvText);
      if (records.length === 0) {
        setStatusMsg('Tidak ada baris data valid yang terdeteksi dari teks CSV.');
        return;
      }
      onImportRecords(records);
      setStatusMsg(`Berhasil mengimpor ${records.length} data presensi.`);
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err: any) {
      setStatusMsg('Gagal memproses data: ' + err.message);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setCsvText(event.target.result as string);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-stone-200 relative">
        <div className="flex items-center justify-between pb-3 border-b border-stone-100">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
            <h2 className="text-base font-bold text-stone-900">
              Sinkronisasi Data Google Sheets 'Absensi_P3k'
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-4 space-y-4">
          <p className="text-xs text-stone-600">
            Salin baris respons dari Google Sheets Anda (termasuk baris header <code>Timestamp, NIP, Nama, Foto, Sesi</code>) dan tempel di bawah ini untuk langsung memperbarui lembar kolase.
          </p>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-stone-700">
                Data CSV dari Google Sheets:
              </label>
              <label className="text-xs text-stone-600 hover:text-stone-900 font-medium cursor-pointer underline flex items-center gap-1">
                <Upload className="w-3 h-3" />
                <span>Unggah File .CSV</span>
                <input
                  type="file"
                  accept=".csv,text/csv,text/plain"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>
            <textarea
              rows={6}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder="Tempel data CSV di sini..."
              className="w-full p-3 font-mono text-xs border border-stone-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-stone-900 bg-stone-50 text-stone-800"
            />
          </div>

          {statusMsg && (
            <div className="p-3 bg-stone-100 rounded-lg text-xs font-semibold text-stone-800 flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600" />
              <span>{statusMsg}</span>
            </div>
          )}

          <div className="pt-3 border-t border-stone-100 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setCsvText(DEFAULT_USER_CSV)}
              className="text-xs text-stone-500 hover:text-stone-800 flex items-center gap-1"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              <span>Isi Data P3K Terbaru</span>
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-stone-600 hover:bg-stone-100 rounded-lg"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleApplyImport}
                className="px-4 py-2 text-xs font-bold text-white bg-stone-900 hover:bg-stone-800 rounded-lg flex items-center gap-1.5 shadow-sm"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Sinkronkan ke Kolase</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
