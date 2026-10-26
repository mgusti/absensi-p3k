/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  HardDrive,
  ExternalLink,
  QrCode,
  Share2,
  RefreshCw,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  LogOut,
  FolderOpen
} from 'lucide-react';
import { User } from 'firebase/auth';
import {
  googleSignIn,
  logout,
  initAuth,
  fetchLiveGoogleSheetRows,
  uploadCollageToDrive
} from '../services/firebase.ts';
import { AttendanceRecord, CollageSettings } from '../types/attendance.ts';
import { getDriveDirectImageUrl, filterAttendees } from '../utils/collageLogic.ts';
import { generateCollagePdfBlob } from '../utils/collageRenderer.ts';

interface GoogleWorkspacePanelProps {
  onSyncRows: (records: AttendanceRecord[]) => void;
  formUrl: string;
  onOpenShareModal: () => void;
  attendees?: AttendanceRecord[];
  settings?: CollageSettings;
}

export const GoogleWorkspacePanel: React.FC<GoogleWorkspacePanelProps> = ({
  onSyncRows,
  formUrl,
  onOpenShareModal,
  attendees,
  settings
}) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [spreadsheetId, setSpreadsheetId] = useState('');
  const [isFetchingSheet, setIsFetchingSheet] = useState(false);
  const [isUploadingDrive, setIsUploadingDrive] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    const unsubscribe = initAuth(
      (user) => setCurrentUser(user),
      () => setCurrentUser(null)
    );
    return () => unsubscribe();
  }, []);

  const handleSignIn = async () => {
    setIsLoggingIn(true);
    setActionMessage(null);
    try {
      const res = await googleSignIn();
      if (res) {
        setCurrentUser(res.user);
        setActionMessage({
          type: 'success',
          text: `Berhasil login sebagai ${res.user.displayName || res.user.email}. Izin Google Sheets & Drive aktif!`
        });
      }
    } catch (err: any) {
      console.error(err);
      setActionMessage({
        type: 'error',
        text: 'Login Google dibatalkan atau terjadi kendala otorisasi: ' + (err.message || '')
      });
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    setCurrentUser(null);
    setActionMessage({ type: 'success', text: 'Berhasil keluar dari akun Google.' });
  };

  const handleFetchSheet = async () => {
    if (!spreadsheetId.trim()) {
      setActionMessage({
        type: 'error',
        text: 'Masukkan Spreadsheet ID atau URL Google Sheets terlebih dahulu.'
      });
      return;
    }

    // Extract ID if full URL is pasted
    let cleanId = spreadsheetId.trim();
    const match = cleanId.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (match) cleanId = match[1];

    setIsFetchingSheet(true);
    setActionMessage(null);

    try {
      const rows = await fetchLiveGoogleSheetRows(cleanId, 'A:F');
      if (rows.length < 2) {
        setActionMessage({
          type: 'error',
          text: 'Sheet ditemukan namun belum ada baris data respon.'
        });
        return;
      }

      // Parse rows
      const headers = rows[0].map((h) => String(h).toLowerCase());
      let timestampIdx = headers.findIndex((h) => h.includes('timestamp') || h.includes('waktu'));
      let nipIdx = headers.findIndex((h) => h.includes('nip'));
      let nameIdx = headers.findIndex((h) => h.includes('nama'));
      let photoIdx = headers.findIndex((h) => h.includes('foto') || h.includes('bukti') || h.includes('unggah'));
      let sessionIdx = headers.findIndex((h) => h.includes('sesi'));

      if (timestampIdx === -1) timestampIdx = 0;
      if (nipIdx === -1) nipIdx = 1;
      if (nameIdx === -1) nameIdx = 2;
      if (photoIdx === -1) photoIdx = 3;
      if (sessionIdx === -1) sessionIdx = 4;

      const parsed: AttendanceRecord[] = [];
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const rawTime = row[timestampIdx] || '';
        const rawNip = row[nipIdx] || '';
        const rawName = row[nameIdx] || '';
        const rawPhoto = row[photoIdx] || '';
        const rawSession = row[sessionIdx] || 'Pagi';

        if (!rawNip && !rawName) continue;

        let dateStr = '2026-10-26';
        if (rawTime) {
          const parts = String(rawTime).split(' ')[0].split(/[\/\-]/);
          if (parts.length === 3) {
            if (parts[2].length === 4) {
              dateStr = `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
            } else if (parts[0].length === 4) {
              dateStr = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
            }
          }
        }

        parsed.push({
          id: `sheet-live-${i}-${Date.now()}`,
          timestamp: rawTime ? new Date(rawTime).toISOString() : new Date().toISOString(),
          nip: String(rawNip).replace(/\D/g, '') || String(rawNip),
          name: String(rawName),
          session: String(rawSession).toLowerCase().includes('sore') ? 'Sore' : 'Pagi',
          date: dateStr,
          photoUrl: rawPhoto.includes('drive.google.com') ? getDriveDirectImageUrl(rawPhoto) : rawPhoto,
          status: 'valid',
          department: 'Absensi P3K'
        });
      }

      onSyncRows(parsed);
      setActionMessage({
        type: 'success',
        text: `Sukses! Berhasil menarik ${parsed.length} data presensi langsung dari Google Sheets.`
      });
    } catch (err: any) {
      console.error(err);
      setActionMessage({
        type: 'error',
        text: 'Gagal mengambil data dari Google Sheets: ' + (err.message || '')
      });
    } finally {
      setIsFetchingSheet(false);
    }
  };

  const handleUploadToDrive = async () => {
    setIsUploadingDrive(true);
    setActionMessage(null);

    try {
      if (attendees && settings) {
        const active = filterAttendees(attendees, settings.selectedDate, settings.selectedSession);
        const { blob, filename, pageCount } = await generateCollagePdfBlob(active, settings);
        const res = await uploadCollageToDrive(blob, filename);
        setActionMessage({
          type: 'success',
          text: `✅ 1 Berkas PDF (${pageCount} Halaman) berhasil disimpan ke Google Drive Anda! (File ID: ${res.fileId})`
        });
      } else {
        const canvas = document.querySelector('canvas') as HTMLCanvasElement | null;
        if (!canvas) throw new Error('Canvas belum siap');
        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
        if (!blob) throw new Error('Gagal mengonversi gambar');
        const filename = `Dokumentasi_Kolase_P3K_${Date.now()}.png`;
        const res = await uploadCollageToDrive(blob, filename);
        setActionMessage({
          type: 'success',
          text: `Kolase berhasil disimpan ke Google Drive Anda! (File ID: ${res.fileId})`
        });
      }
    } catch (err: any) {
      console.error(err);
      setActionMessage({
        type: 'error',
        text: 'Gagal mengunggah ke Google Drive: ' + (err.message || '')
      });
    } finally {
      setIsUploadingDrive(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-stone-200 p-5 shadow-sm space-y-4">
      {/* Top Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 pb-3">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-stone-500 uppercase tracking-wider">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Konektivitas Google Workspace</span>
          </div>
          <h2 className="text-base font-bold text-stone-900 mt-0.5">
            Integrasi Google Sheets, Drive & Google Forms
          </h2>
        </div>

        {/* Auth status & Official Sign in Button */}
        <div>
          {currentUser ? (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-xs">
                {currentUser.photoURL && (
                  <img
                    src={currentUser.photoURL}
                    alt={currentUser.displayName || ''}
                    className="w-6 h-6 rounded-full border border-stone-200"
                  />
                )}
                <span className="font-semibold text-stone-800">{currentUser.displayName || currentUser.email}</span>
              </div>
              <button
                onClick={handleLogout}
                className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
                title="Logout dari Akun Google"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={handleSignIn}
              disabled={isLoggingIn}
              className="px-3.5 py-1.5 border border-stone-300 rounded-lg text-xs font-semibold text-stone-800 hover:bg-stone-50 shadow-2xs flex items-center gap-2 transition-all disabled:opacity-50"
            >
              <svg className="w-4 h-4" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
              </svg>
              <span>{isLoggingIn ? 'Menghubungkan...' : 'Sign in with Google'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Action status toast */}
      {actionMessage && (
        <div
          className={`p-3 rounded-lg text-xs flex items-center gap-2 ${
            actionMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          {actionMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{actionMessage.text}</span>
        </div>
      )}

      {/* Quick Integration Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Card 1: Google Form Hub */}
        <div className="border border-stone-200 rounded-xl p-3.5 bg-stone-50 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-stone-900">Google Form P3K</span>
              <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-semibold">Tersinkron</span>
            </div>
            <p className="text-[11px] text-stone-600 leading-snug">
              Bagikan formulir presensi ke peserta melalui WhatsApp atau kode QR cetak.
            </p>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={onOpenShareModal}
              className="flex-1 py-1.5 bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors"
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>Bagikan & QR</span>
            </button>
            <a
              href={formUrl}
              target="_blank"
              rel="noreferrer"
              className="p-1.5 bg-white border border-stone-200 hover:bg-stone-100 rounded-lg text-stone-700"
              title="Buka Google Form asli"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {/* Card 2: Live Google Sheets Sync */}
        <div className="border border-stone-200 rounded-xl p-3.5 bg-stone-50 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-stone-900">Google Sheets Sync</span>
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            </div>
            <p className="text-[11px] text-stone-600 leading-snug mb-2">
              Tarik data jawaban langsung via Sheets API atau tempel Spreadsheet ID.
            </p>
            <input
              type="text"
              placeholder="ID / URL Google Spreadsheet..."
              value={spreadsheetId}
              onChange={(e) => setSpreadsheetId(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-white border border-stone-200 rounded-lg text-xs font-mono text-stone-800 focus:outline-none focus:ring-1 focus:ring-stone-900"
            />
          </div>
          <div className="mt-3">
            <button
              onClick={handleFetchSheet}
              disabled={isFetchingSheet}
              className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isFetchingSheet ? 'animate-spin' : ''}`} />
              <span>{isFetchingSheet ? 'Menarik data...' : 'Tarik Data Sheets'}</span>
            </button>
          </div>
        </div>

        {/* Card 3: Google Drive Export */}
        <div className="border border-stone-200 rounded-xl p-3.5 bg-stone-50 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-stone-900">Google Drive Upload</span>
              <HardDrive className="w-4 h-4 text-blue-600" />
            </div>
            <p className="text-[11px] text-stone-600 leading-snug">
              Simpan <strong>1 File PDF (Multi-Halaman)</strong> yang memuat semua halaman kolase langsung ke Google Drive Anda.
            </p>
          </div>
          <div className="mt-3">
            <button
              onClick={handleUploadToDrive}
              disabled={isUploadingDrive}
              className="w-full py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
            >
              <UploadCloud className="w-3.5 h-3.5" />
              <span>{isUploadingDrive ? 'Mengunggah PDF ke Drive...' : 'Simpan 1 PDF ke Drive'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
