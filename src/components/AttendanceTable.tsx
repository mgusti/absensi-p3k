/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Search, Download, Trash2, Eye, Plus, CheckCircle2, AlertTriangle, FileSpreadsheet, X } from 'lucide-react';
import { AttendanceRecord, AttendanceSession } from '../types/attendance.ts';

interface AttendanceTableProps {
  attendees: AttendanceRecord[];
  onDeleteAttendee: (id: string) => void;
  onClearAll: () => void;
  onResetDemo: () => void;
  onOpenAddModal: () => void;
}

export const AttendanceTable: React.FC<AttendanceTableProps> = ({
  attendees,
  onDeleteAttendee,
  onClearAll,
  onResetDemo,
  onOpenAddModal
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sessionFilter, setSessionFilter] = useState<string>('all');
  const [selectedPhotoModal, setSelectedPhotoModal] = useState<{ url: string; name: string } | null>(null);

  // Filtered list
  const filtered = attendees.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.nip.includes(searchQuery);
    const matchesSession = sessionFilter === 'all' || item.session === sessionFilter;
    return matchesSearch && matchesSession;
  });

  const exportCsv = () => {
    const headers = ['ID', 'Waktu', 'NIP', 'Nama', 'Sesi', 'Tanggal', 'Status', 'Unit Kerja'];
    const rows = filtered.map((item) => [
      item.id,
      item.timestamp,
      `'${item.nip}`, // Prefix with quote so spreadsheet preserves leading zeroes
      `"${item.name.replace(/"/g, '""')}"`,
      item.session,
      item.date,
      item.status,
      `"${(item.department || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Rekap_Absensi_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  };

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6">
      {/* Photo Modal */}
      {selectedPhotoModal && (
        <div
          className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4"
          onClick={() => setSelectedPhotoModal(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-sm w-full p-4 overflow-hidden relative shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-stone-200">
              <span className="text-sm font-bold text-stone-900 truncate">
                {selectedPhotoModal.name}
              </span>
              <button
                onClick={() => setSelectedPhotoModal(null)}
                className="p-1 rounded-lg text-stone-500 hover:bg-stone-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="py-4 flex justify-center">
              <img
                src={selectedPhotoModal.url}
                alt={selectedPhotoModal.name}
                className="w-full max-h-[380px] object-cover rounded-xl border border-stone-200 shadow-inner"
              />
            </div>
          </div>
        </div>
      )}

      {/* Header Info */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white rounded-xl border border-stone-200 p-5 shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1">
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Basis Data Sheet 'ABSENSI'</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-stone-900 tracking-tight">
            Rekapitulasi Kehadiran Peserta
          </h1>
          <p className="text-xs text-stone-500 mt-1">
            Tabel sinkronisasi data presensi dari Google Forms / formulir mandiri dengan waktu pencatatan dan status validasi.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={onOpenAddModal}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-stone-900 hover:bg-stone-800 text-white rounded-lg shadow-sm transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tambah Data Manual</span>
          </button>

          <button
            onClick={exportCsv}
            disabled={filtered.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-lg transition-colors disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Ekspor CSV</span>
          </button>

          <button
            onClick={onResetDemo}
            className="px-3 py-2 text-xs font-semibold text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-colors"
          >
            Reset Contoh 14 Data
          </button>
        </div>
      </div>

      {/* Table Filter Toolbar */}
      <div className="bg-white rounded-xl border border-stone-200 p-4 shadow-sm mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Cari berdasarkan NIP atau Nama..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-stone-200 text-xs text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-1 focus:ring-stone-900"
          />
        </div>

        {/* Sesi Tabs */}
        <div className="flex items-center gap-1 p-1 bg-stone-100 rounded-lg self-start sm:self-auto">
          <button
            onClick={() => setSessionFilter('all')}
            className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
              sessionFilter === 'all'
                ? 'bg-white text-stone-900 shadow-sm'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            Semua Sesi ({attendees.length})
          </button>
          <button
            onClick={() => setSessionFilter('Pagi')}
            className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
              sessionFilter === 'Pagi'
                ? 'bg-white text-stone-900 shadow-sm'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            ☀️ Pagi ({attendees.filter((a) => a.session === 'Pagi').length})
          </button>
          <button
            onClick={() => setSessionFilter('Sore')}
            className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
              sessionFilter === 'Sore'
                ? 'bg-white text-stone-900 shadow-sm'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            🌙 Sore ({attendees.filter((a) => a.session === 'Sore').length})
          </button>
        </div>
      </div>

      {/* Table Container */}
      <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-200 text-stone-600 font-bold uppercase tracking-wider">
                <th className="py-3 px-4 w-12 text-center">No</th>
                <th className="py-3 px-4 w-16">Foto</th>
                <th className="py-3 px-4">Nama Lengkap</th>
                <th className="py-3 px-4">NIP</th>
                <th className="py-3 px-4">Sesi</th>
                <th className="py-3 px-4">Tanggal</th>
                <th className="py-3 px-4">Waktu Catat</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-stone-500">
                    Tidak ada data presensi yang sesuai dengan kriteria pencarian.
                  </td>
                </tr>
              ) : (
                filtered.map((item, index) => {
                  const timeFormatted = item.timestamp
                    ? new Date(item.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
                    : '-';
                  return (
                    <tr key={item.id} className="hover:bg-stone-50/70 transition-colors">
                      <td className="py-3 px-4 text-center font-mono text-stone-500">
                        {index + 1}
                      </td>
                      <td className="py-3 px-4">
                        <button
                          type="button"
                          onClick={() => setSelectedPhotoModal({ url: item.photoUrl, name: item.name })}
                          className="relative group w-10 h-12 rounded-md overflow-hidden border border-stone-200 bg-stone-100 block"
                          title="Klik untuk melihat foto"
                        >
                          <img
                            src={item.photoUrl}
                            alt={item.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                          <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                            <Eye className="w-3.5 h-3.5 text-white" />
                          </div>
                        </button>
                      </td>
                      <td className="py-3 px-4 font-semibold text-stone-900">
                        <div>{item.name}</div>
                        {item.department && (
                          <div className="text-[10px] text-stone-500 font-normal">{item.department}</div>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono font-medium text-stone-700">
                        {item.nip}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 font-semibold ${
                            item.session === 'Pagi' ? 'text-amber-800' : 'text-blue-800'
                          }`}
                        >
                          {item.session === 'Pagi' ? '☀️ Pagi' : '🌙 Sore'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-stone-700 font-mono">
                        {item.date}
                      </td>
                      <td className="py-3 px-4 text-stone-500 font-mono">
                        {timeFormatted}
                      </td>
                      <td className="py-3 px-4">
                        {item.status === 'valid' && (
                          <span className="text-emerald-700 font-medium flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            Valid
                          </span>
                        )}
                        {item.status === 'duplicate_flagged' && (
                          <span className="text-amber-700 font-medium flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                            Duplikat
                          </span>
                        )}
                        {item.status === 'overwritten' && (
                          <span className="text-blue-700 font-medium">
                            Diperbarui
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => onDeleteAttendee(item.id)}
                          className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title="Hapus Peserta"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer info strip */}
        <div className="bg-stone-50 border-t border-stone-200 px-4 py-3 flex items-center justify-between text-xs text-stone-500">
          <span>Menampilkan {filtered.length} dari total {attendees.length} data presensi</span>
          {attendees.length > 0 && (
            <button
              onClick={onClearAll}
              className="text-stone-500 hover:text-rose-600 font-medium text-xs transition-colors"
            >
              Kosongkan Semua Data
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
