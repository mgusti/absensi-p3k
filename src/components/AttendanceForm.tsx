/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { Camera, Upload, CheckCircle2, AlertTriangle, RefreshCw, Sparkles, User, ShieldCheck } from 'lucide-react';
import confetti from 'canvas-confetti';
import { AttendanceRecord, AttendanceSession, DuplicatePolicy } from '../types/attendance.ts';
import { validateNip, resolveAttendanceSubmission, generateAvatarDataUrl } from '../utils/collageLogic.ts';

interface AttendanceFormProps {
  attendees: AttendanceRecord[];
  onAddAttendance: (updatedList: AttendanceRecord[], message: string, status: string) => void;
  selectedDate: string;
  defaultSession: AttendanceSession;
  duplicatePolicy: DuplicatePolicy;
  onGoToStudio: () => void;
}

const PRESET_AVATARS = [
  { name: 'Dr. Ahmad Sanusi, M.Si', gender: 'm' as const, role: 'Kadis' },
  { name: 'Dewi Sekarwangi, S.Pd', gender: 'f' as const, role: 'Sekretaris' },
  { name: 'Rahmat Hidayat, S.Kom', gender: 'm' as const, role: 'Pranata IT' },
  { name: 'Nurlaila Sari, S.E', gender: 'f' as const, role: 'Bendahara' },
  { name: 'H. Suryadi, S.H', gender: 'm' as const, role: 'Analis' },
  { name: 'Indah Puspitasari, S.Tr.Kom', gender: 'f' as const, role: 'Staf' },
];

export const AttendanceForm: React.FC<AttendanceFormProps> = ({
  attendees,
  onAddAttendance,
  selectedDate,
  defaultSession,
  duplicatePolicy,
  onGoToStudio
}) => {
  const [nip, setNip] = useState('');
  const [name, setName] = useState('');
  const [session, setSession] = useState<AttendanceSession>(defaultSession);
  const [department, setDepartment] = useState('Sekretariat / Tata Usaha');
  const [photoMode, setPhotoMode] = useState<'upload' | 'camera' | 'preset'>('preset');
  const [selectedPresetIndex, setSelectedPresetIndex] = useState<number>(0);
  const [customPhotoUrl, setCustomPhotoUrl] = useState<string>('');
  
  // Camera state
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Form error & success message
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<{ name: string; nip: string; session: string; status: string } | null>(null);

  // Stop camera on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setIsCameraActive(true);
    } catch (err) {
      console.warn('Camera access denied or unavailable:', err);
      setCameraError('Kamera tidak dapat diakses atau izin ditolak. Anda dapat menggunakan unggah file atau foto avatar.');
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const captureCameraPhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = 480;
    canvas.height = 600;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Draw centered cropped selfie
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      setCustomPhotoUrl(dataUrl);
      stopCamera();
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setCustomPhotoUrl(event.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const handlePresetSelect = (idx: number) => {
    setSelectedPresetIndex(idx);
    const item = PRESET_AVATARS[idx];
    if (!name) setName(item.name);
    if (!nip) {
      const randomNip = `199${Math.floor(10000000000 + Math.random() * 90000000000)}`;
      setNip(randomNip);
    }
  };

  const getEffectivePhotoUrl = (): string => {
    if (photoMode === 'upload' || photoMode === 'camera') {
      if (customPhotoUrl) return customPhotoUrl;
    }
    const preset = PRESET_AVATARS[selectedPresetIndex] || PRESET_AVATARS[0];
    return generateAvatarDataUrl(name || preset.name, preset.gender, preset.role);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Validate NIP
    const nipValidation = validateNip(nip);
    if (!nipValidation.isValid) {
      setErrorMessage(nipValidation.error || 'NIP tidak valid.');
      return;
    }

    if (!name.trim()) {
      setErrorMessage('Nama lengkap peserta wajib diisi.');
      return;
    }

    const candidate = {
      timestamp: new Date().toISOString(),
      nip: nipValidation.cleaned,
      name: name.trim(),
      session,
      date: selectedDate,
      photoUrl: getEffectivePhotoUrl(),
      department: department.trim()
    };

    const resolution = resolveAttendanceSubmission(attendees, candidate, duplicatePolicy);

    if (resolution.resultStatus === 'rejected') {
      setErrorMessage(resolution.message);
      return;
    }

    // Success
    onAddAttendance(resolution.updatedList, resolution.message, resolution.resultStatus);
    setSuccessInfo({
      name: candidate.name,
      nip: candidate.nip,
      session: candidate.session,
      status: resolution.resultStatus
    });

    try {
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.7 }
      });
    } catch {
      // Ignore if confetti not supported
    }

    // Reset inputs for next attendee
    setNip('');
    setName('');
    setCustomPhotoUrl('');
  };

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      {/* Header Info */}
      <div className="mb-6 bg-white rounded-xl border border-stone-200 p-6 shadow-sm">
        <div className="flex items-center gap-2 text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Formulir Presensi Kehadiran Online</span>
        </div>
        <h1 className="text-2xl font-bold text-stone-900 tracking-tight">
          Dokumentasi Kehadiran Pegawai
        </h1>
        <p className="text-sm text-stone-600 mt-1">
          Setiap pengisian formulir ini akan otomatis terhubung ke sistem rekapitulasi data dan memperbarui kolase foto presensi harian (maks. 6 peserta per gambar).
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-stone-500 border-t border-stone-100 pt-3">
          <span>Tanggal: <strong className="text-stone-800">{selectedDate}</strong></span>
          <span aria-hidden="true">·</span>
          <span>Sesi Aktif: <strong className="text-stone-800">{session}</strong></span>
          <span aria-hidden="true">·</span>
          <span>Aturan Duplikasi: <strong className="text-stone-800">
            {duplicatePolicy === 'reject' ? 'Tolak Duplikat' : duplicatePolicy === 'flag' ? 'Tandai Duplikat' : 'Timpa Data Lama'}
          </strong></span>
        </div>
      </div>

      {/* Success Notification */}
      {successInfo && (
        <div className="mb-6 bg-emerald-50 border border-emerald-200 rounded-xl p-5">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h2 className="text-sm font-bold text-emerald-900">
                Presensi Berhasil Dicatat!
              </h2>
              <p className="text-xs text-emerald-700 mt-0.5">
                Peserta <strong>{successInfo.name}</strong> (NIP: {successInfo.nip}) berhasil dimasukkan ke sesi <strong>{successInfo.session}</strong>. Gambar kolase otomatis diperbarui.
              </p>
              <div className="mt-3 flex items-center gap-3">
                <button
                  onClick={onGoToStudio}
                  className="px-3 py-1.5 bg-emerald-700 text-white rounded-lg text-xs font-semibold hover:bg-emerald-800 transition-colors"
                >
                  Lihat Kolase di Studio
                </button>
                <button
                  onClick={() => setSuccessInfo(null)}
                  className="text-xs text-emerald-800 font-medium hover:underline"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error Alert */}
      {errorMessage && (
        <div className="mb-6 bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h2 className="text-sm font-semibold text-rose-900">Validasi Pengisian</h2>
            <p className="text-xs text-rose-700 mt-0.5">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Form Card */}
      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-stone-200 shadow-sm p-6 space-y-6">
        {/* NIP & Nama */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1">
              NIP (Nomor Induk Pegawai) <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="Contoh: 198803152014021001"
              value={nip}
              onChange={(e) => setNip(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 text-stone-900 text-sm font-mono placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-900"
            />
            <span className="text-[11px] text-stone-500 mt-1 block">
              Gunakan angka tanpa spasi atau tanda hubung.
            </span>
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1">
              Nama Lengkap & Gelar <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="Contoh: Drs. Hendra Setiawan, M.Si"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 text-stone-900 text-sm placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-900"
            />
          </div>
        </div>

        {/* Sesi & Unit Kerja */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1">
              Sesi Absensi <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSession('Pagi')}
                className={`py-2 px-3 rounded-lg text-xs font-bold border transition-colors flex items-center justify-center gap-2 ${
                  session === 'Pagi'
                    ? 'bg-amber-100 border-amber-400 text-amber-900'
                    : 'bg-white border-stone-200 text-stone-700 hover:bg-stone-50'
                }`}
              >
                <span>☀️ Sesi Pagi</span>
              </button>
              <button
                type="button"
                onClick={() => setSession('Sore')}
                className={`py-2 px-3 rounded-lg text-xs font-bold border transition-colors flex items-center justify-center gap-2 ${
                  session === 'Sore'
                    ? 'bg-amber-100 border-amber-400 text-amber-900'
                    : 'bg-white border-stone-200 text-stone-700 hover:bg-stone-50'
                }`}
              >
                <span>🌙 Sesi Sore</span>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1">
              Unit Kerja / Jabatan (Opsional)
            </label>
            <input
              type="text"
              placeholder="Contoh: Bagian Kepegawaian"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="w-full px-3.5 py-2 rounded-lg border border-stone-300 text-stone-900 text-sm placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-900"
            />
          </div>
        </div>

        {/* Photo Selection Section */}
        <div>
          <label className="block text-xs font-bold text-stone-700 mb-1">
            Dokumentasi Foto Peserta <span className="text-rose-500">*</span>
          </label>
          <span className="text-xs text-stone-500 mb-3 block">
            Foto ini akan langsung dipotong rapi dan ditempatkan ke dalam grid kolase 3x2.
          </span>

          {/* Mode Switcher Tabs */}
          <div className="flex items-center gap-2 p-1 bg-stone-100 rounded-lg mb-4">
            <button
              type="button"
              onClick={() => {
                setPhotoMode('preset');
                stopCamera();
              }}
              className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
                photoMode === 'preset'
                  ? 'bg-white text-stone-900 shadow-sm font-semibold'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Foto Cepat (Preset)
            </button>
            <button
              type="button"
              onClick={() => {
                setPhotoMode('upload');
                stopCamera();
              }}
              className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
                photoMode === 'upload'
                  ? 'bg-white text-stone-900 shadow-sm font-semibold'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Unggah File
            </button>
            <button
              type="button"
              onClick={() => {
                setPhotoMode('camera');
                startCamera();
              }}
              className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
                photoMode === 'camera'
                  ? 'bg-white text-stone-900 shadow-sm font-semibold'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Kamera Selfie
            </button>
          </div>

          {/* Tab 1: Preset */}
          {photoMode === 'preset' && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {PRESET_AVATARS.map((preset, idx) => {
                  const avatarUrl = generateAvatarDataUrl(preset.name, preset.gender, preset.role);
                  const isSelected = selectedPresetIndex === idx;
                  return (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => handlePresetSelect(idx)}
                      className={`relative p-1.5 rounded-lg border text-left transition-all ${
                        isSelected
                          ? 'border-stone-900 ring-2 ring-stone-900 bg-amber-50/50'
                          : 'border-stone-200 hover:border-stone-300 bg-white'
                      }`}
                    >
                      <img
                        src={avatarUrl}
                        alt={preset.name}
                        className="w-full h-20 object-cover rounded-md bg-stone-100"
                      />
                      <div className="mt-1 text-[11px] font-semibold text-stone-800 truncate">
                        {preset.name.split(' ')[0]}
                      </div>
                      <div className="text-[10px] text-stone-500 truncate">{preset.role}</div>
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-stone-500">
                Pilih foto figur di atas untuk demonstrasi cepat presensi instan.
              </p>
            </div>
          )}

          {/* Tab 2: Upload File */}
          {photoMode === 'upload' && (
            <div className="border-2 border-dashed border-stone-300 rounded-xl p-6 text-center hover:border-stone-400 transition-colors">
              {customPhotoUrl ? (
                <div className="flex flex-col items-center">
                  <img
                    src={customPhotoUrl}
                    alt="Preview Unggahan"
                    className="w-32 h-40 object-cover rounded-lg border border-stone-200 shadow-sm"
                  />
                  <label className="mt-3 text-xs font-medium text-stone-900 hover:underline cursor-pointer">
                    Ganti Foto Lain
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              ) : (
                <label className="cursor-pointer block">
                  <Upload className="w-8 h-8 text-stone-400 mx-auto mb-2" />
                  <span className="text-xs font-bold text-stone-900 block">
                    Klik untuk memilih foto dari perangkat
                  </span>
                  <span className="text-[11px] text-stone-500 mt-1 block">
                    Format JPG, PNG, atau WebP (Maks. 10MB)
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              )}
            </div>
          )}

          {/* Tab 3: Camera Selfie */}
          {photoMode === 'camera' && (
            <div className="border border-stone-200 rounded-xl p-4 bg-stone-900 text-white text-center">
              {cameraError ? (
                <div className="py-6 px-4">
                  <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto mb-2" />
                  <p className="text-xs text-stone-300 mb-3">{cameraError}</p>
                  <button
                    type="button"
                    onClick={startCamera}
                    className="px-3 py-1.5 bg-white text-stone-900 text-xs font-semibold rounded-lg"
                  >
                    Coba Akses Lagi
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <div className="relative w-64 h-72 rounded-lg overflow-hidden bg-black border border-stone-700">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 border border-white/20 rounded-lg pointer-events-none" />
                  </div>
                  <div className="mt-3 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={captureCameraPhoto}
                      className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-stone-950 text-xs font-bold rounded-lg shadow flex items-center gap-2"
                    >
                      <Camera className="w-4 h-4" />
                      Ambil Foto Presensi
                    </button>
                    {isCameraActive && (
                      <button
                        type="button"
                        onClick={stopCamera}
                        className="px-3 py-2 bg-stone-800 text-stone-300 text-xs rounded-lg hover:bg-stone-700"
                      >
                        Matikan Kamera
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Submit Button */}
        <div className="pt-2 border-t border-stone-100 flex items-center justify-between">
          <span className="text-xs text-stone-500">
            * Kolase halaman akan dibuat/diperbarui otomatis
          </span>
          <button
            type="submit"
            className="px-6 py-2.5 bg-stone-900 hover:bg-stone-800 text-white text-sm font-bold rounded-lg shadow-sm transition-colors flex items-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            Kirim Presensi Sekarang
          </button>
        </div>
      </form>
    </div>
  );
};
