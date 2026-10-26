/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AttendanceRecord, CollageSettings } from './types/attendance.ts';
import { SAMPLE_ATTENDEES } from './utils/collageLogic.ts';
import { Navbar } from './components/Navbar.tsx';
import { CollageStudio } from './components/CollageStudio.tsx';
import { AttendanceForm } from './components/AttendanceForm.tsx';
import { AttendanceTable } from './components/AttendanceTable.tsx';
import { GasSetupModal } from './components/GasSetupModal.tsx';
import { AddAttendeeModal } from './components/AddAttendeeModal.tsx';
import { downloadCanvasAsPng } from './utils/collageRenderer.ts';

const STORAGE_KEY_ATTENDEES = 'autoabsen_attendees_v1';
const STORAGE_KEY_SETTINGS = 'autoabsen_settings_v1';

export default function App() {
  const [activeTab, setActiveTab] = useState<'studio' | 'form' | 'table' | 'script'>('studio');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Attendees list
  const [attendees, setAttendees] = useState<AttendanceRecord[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_ATTENDEES);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    return SAMPLE_ATTENDEES;
  });

  // Collage settings
  const [settings, setSettings] = useState<CollageSettings>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_SETTINGS);
      if (stored) return JSON.parse(stored);
    } catch {
      // ignore
    }
    return {
      template: 'beige',
      orientation: 'portrait',
      institutionName: 'DINAS KOMUNIKASI DAN INFORMATIKA',
      unitName: 'SEKRETARIAT & TATA USAHA',
      logoType: 'garuda',
      footerNote: 'Dokumentasi Resmi Kehadiran Pegawai',
      showTimestamp: true,
      duplicatePolicy: 'reject',
      selectedDate: '2026-10-26',
      selectedSession: 'Pagi'
    };
  });

  // Save to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_ATTENDEES, JSON.stringify(attendees));
  }, [attendees]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
  }, [settings]);

  const updateSettings = (partial: Partial<CollageSettings>) => {
    setSettings((prev) => ({ ...prev, ...partial }));
  };

  const handleAddAttendance = (updatedList: AttendanceRecord[]) => {
    setAttendees(updatedList);
  };

  const handleDeleteAttendee = (id: string) => {
    setAttendees((prev) => prev.filter((a) => a.id !== id));
  };

  const handleClearAll = () => {
    if (window.confirm('Yakin ingin mengosongkan semua data presensi?')) {
      setAttendees([]);
    }
  };

  const handleResetDemo = () => {
    setAttendees(SAMPLE_ATTENDEES);
    setSettings((prev) => ({
      ...prev,
      selectedDate: '2026-10-26',
      selectedSession: 'Pagi'
    }));
  };

  // Quick download from top bar
  const handleQuickDownload = () => {
    const canvas = document.querySelector('canvas') as HTMLCanvasElement | null;
    if (canvas) {
      downloadCanvasAsPng(
        canvas,
        `Dokumentasi_Absensi_${settings.selectedSession}_${settings.selectedDate}.png`
      );
    } else {
      setActiveTab('studio');
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 flex flex-col font-sans">
      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onQuickDownload={handleQuickDownload}
        totalAttendeesCount={attendees.length}
      />

      {/* Main View Router */}
      <main className="flex-1">
        {activeTab === 'studio' && (
          <CollageStudio
            attendees={attendees}
            settings={settings}
            onUpdateSettings={updateSettings}
            onQuickAddDemo={handleResetDemo}
          />
        )}

        {activeTab === 'form' && (
          <AttendanceForm
            attendees={attendees}
            onAddAttendance={(newList) => {
              handleAddAttendance(newList);
            }}
            selectedDate={settings.selectedDate}
            defaultSession={settings.selectedSession}
            duplicatePolicy={settings.duplicatePolicy}
            onGoToStudio={() => setActiveTab('studio')}
          />
        )}

        {activeTab === 'table' && (
          <AttendanceTable
            attendees={attendees}
            onDeleteAttendee={handleDeleteAttendee}
            onClearAll={handleClearAll}
            onResetDemo={handleResetDemo}
            onOpenAddModal={() => setIsAddModalOpen(true)}
          />
        )}

        {activeTab === 'script' && <GasSetupModal />}
      </main>

      {/* Manual Attendee Entry Modal */}
      <AddAttendeeModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        attendees={attendees}
        onAdd={handleAddAttendance}
        selectedDate={settings.selectedDate}
        defaultSession={settings.selectedSession}
        duplicatePolicy={settings.duplicatePolicy}
      />

      {/* Quiet Footer */}
      <footer className="border-t border-stone-200 bg-white py-6 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-stone-500">
          <div>
            <strong>AutoAbsen Kolase</strong> — Sistem Dokumentasi Kehadiran Pegawai berbasis Google Forms, Sheets & Apps Script.
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setActiveTab('script')}
              className="hover:text-stone-900 transition-colors"
            >
              Setup Google Forms
            </button>
            <span aria-hidden="true">·</span>
            <button
              onClick={() => setActiveTab('studio')}
              className="hover:text-stone-900 transition-colors"
            >
              Studio Kolase
            </button>
            <span aria-hidden="true">·</span>
            <span>Grid 3×2 (Maks 6 Foto / Halaman)</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
