/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { X, CheckCircle2, User, Building } from 'lucide-react';
import { AttendanceRecord, AttendanceSession, DuplicatePolicy } from '../types/attendance.ts';
import { validateNip, resolveAttendanceSubmission, generateAvatarDataUrl } from '../utils/collageLogic.ts';

interface AddAttendeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  attendees: AttendanceRecord[];
  onAdd: (updatedList: AttendanceRecord[], message: string) => void;
  selectedDate: string;
  defaultSession: AttendanceSession;
  duplicatePolicy: DuplicatePolicy;
}

export const AddAttendeeModal: React.FC<AddAttendeeModalProps> = ({
  isOpen,
  onClose,
  attendees,
  onAdd,
  selectedDate,
  defaultSession,
  duplicatePolicy
}) => {
  if (!isOpen) return null;

  const [nip, setNip] = useState('');
  const [name, setName] = useState('');
  const [session, setSession] = useState<AttendanceSession>(defaultSession);
  const [department, setDepartment] = useState('Dinas Kominfo');
  const [gender, setGender] = useState<'m' | 'f'>('m');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const nipVal = validateNip(nip);
    if (!nipVal.isValid) {
      setError(nipVal.error || 'NIP tidak valid.');
      return;
    }

    if (!name.trim()) {
      setError('Nama lengkap wajib diisi.');
      return;
    }

    const candidate = {
      timestamp: new Date().toISOString(),
      nip: nipVal.cleaned,
      name: name.trim(),
      session,
      date: selectedDate,
      photoUrl: generateAvatarDataUrl(name.trim(), gender, department.slice(0, 10)),
      department: department.trim()
    };

    const res = resolveAttendanceSubmission(attendees, candidate, duplicatePolicy);
    if (res.resultStatus === 'rejected') {
      setError(res.message);
      return;
    }

    onAdd(res.updatedList, res.message);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-stone-200">
        <div className="flex items-center justify-between pb-3 border-b border-stone-100">
          <h2 className="text-base font-bold text-stone-900">
            Tambah Data Presensi Manual
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mt-3 p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1">
              NIP (Nomor Induk Pegawai)
            </label>
            <input
              type="text"
              required
              placeholder="Contoh: 199307172019031005"
              value={nip}
              onChange={(e) => setNip(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-stone-300 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-stone-900"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1">
              Nama Lengkap & Gelar
            </label>
            <input
              type="text"
              required
              placeholder="Contoh: Ir. Muhammad Rizky, M.Eng"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-stone-300 text-xs focus:outline-none focus:ring-1 focus:ring-stone-900"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">Sesi</label>
              <select
                value={session}
                onChange={(e) => setSession(e.target.value as AttendanceSession)}
                className="w-full px-3 py-2 rounded-lg border border-stone-300 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-stone-900"
              >
                <option value="Pagi">☀️ Sesi Pagi</option>
                <option value="Sore">🌙 Sesi Sore</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">Model Avatar</label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value as 'm' | 'f')}
                className="w-full px-3 py-2 rounded-lg border border-stone-300 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-stone-900"
              >
                <option value="m">Pria (Jas/Dasi)</option>
                <option value="f">Wanita (Hijab/Formal)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1">
              Unit Kerja / Bidang
            </label>
            <input
              type="text"
              placeholder="Contoh: Bagian Kepegawaian"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-stone-300 text-xs focus:outline-none focus:ring-1 focus:ring-stone-900"
            />
          </div>

          <div className="pt-3 border-t border-stone-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-stone-600 hover:bg-stone-100 rounded-lg"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-bold text-white bg-stone-900 hover:bg-stone-800 rounded-lg flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              Simpan Presensi
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
