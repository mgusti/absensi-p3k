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
import { GoogleFormShareModal } from './components/GoogleFormShareModal.tsx';
import { SyncSheetModal } from './components/SyncSheetModal.tsx';
import { GoogleWorkspacePanel } from './components/GoogleWorkspacePanel.tsx';
import { downloadCanvasAsPng, downloadAllPagesAsPdf } from './utils/collageRenderer.ts';
import { filterAttendees } from './utils/collageLogic.ts';
import { saveAttendanceToFirestore, subscribeAttendance } from './services/firebase.ts';

const STORAGE_KEY_ATTENDEES = 'autoabsen_attendees_v2';
const STORAGE_KEY_SETTINGS = 'autoabsen_settings_v2';

export const USER_GOOGLE_FORM_URL =
  'https://docs.google.com/forms/d/e/1FAIpQLScYbiBkznkdZq8j2EE2qEwD_gKzMwwX4aVcfb8ADDTslgHikA/viewform';

export default function App() {
  const [activeTab, setActiveTab] = useState<'studio' | 'form' | 'table' | 'script'>('studio');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);

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
      institutionName: 'DOKUMENTASI ABSENSI P3K',
      unitName: 'PEGAWAI PEMERINTAH DENGAN PERJANJIAN KERJA',
      logoType: 'garuda',
      footerNote: 'Dokumentasi Resmi Kehadiran P3K',
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

  // Optional Firestore real-time listener
  useEffect(() => {
    const unsub = subscribeAttendance((remoteRecords) => {
      if (remoteRecords.length > 0) {
        setAttendees((prev) => {
          // Merge unique records
          const existingIds = new Set(prev.map((r) => r.id));
          const newOnes = remoteRecords.filter((r) => !existingIds.has(r.id));
          return newOnes.length > 0 ? [...newOnes, ...prev] : prev;
        });
      }
    });
    return () => unsub();
  }, []);

  const updateSettings = (partial: Partial<CollageSettings>) => {
    setSettings((prev) => ({ ...prev, ...partial }));
  };

  const handleAddAttendance = (updatedList: AttendanceRecord[]) => {
    setAttendees(updatedList);
    // Sync the top record to Firestore
    if (updatedList.length > 0) {
      saveAttendanceToFirestore(updatedList[0]);
    }
  };

  const handleImportRecords = (newRecords: AttendanceRecord[]) => {
    setAttendees((prev) => {
      const existingNips = new Set(prev.map((r) => `${r.nip}-${r.date}-${r.session}`));
      const fresh = newRecords.filter((r) => !existingNips.has(`${r.nip}-${r.date}-${r.session}`));
      fresh.forEach((r) => saveAttendanceToFirestore(r));
      return [...fresh, ...prev];
    });
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

  // Quick download 1 PDF file containing all pages from top bar
  const handleQuickDownload = async () => {
    const active = filterAttendees(attendees, settings.selectedDate, settings.selectedSession);
    try {
      await downloadAllPagesAsPdf(active, settings);
    } catch (err) {
      console.error('Quick download PDF error:', err);
      // Fallback to active tab
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
        onOpenShareModal={() => setIsShareModalOpen(true)}
        totalAttendeesCount={attendees.length}
      />

      {/* Main View Router */}
      <main className="flex-1">
        {/* Workspace Quick Panel at Top of Studio */}
        {activeTab === 'studio' && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6">
            <GoogleWorkspacePanel
              onSyncRows={handleImportRecords}
              formUrl={USER_GOOGLE_FORM_URL}
              onOpenShareModal={() => setIsShareModalOpen(true)}
              attendees={attendees}
              settings={settings}
            />
          </div>
        )}

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
            onOpenSyncModal={() => setIsSyncModalOpen(true)}
            onOpenShareModal={() => setIsShareModalOpen(true)}
            onUpdateAttendees={setAttendees}
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

      {/* Google Form Share & QR Code Modal */}
      <GoogleFormShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        formUrl={USER_GOOGLE_FORM_URL}
      />

      {/* Google Sheets Sync & Import Modal */}
      <SyncSheetModal
        isOpen={isSyncModalOpen}
        onClose={() => setIsSyncModalOpen(false)}
        onImportRecords={handleImportRecords}
      />

      {/* Footer */}
      <footer className="border-t border-stone-200 bg-white py-6 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-stone-500">
          <div>
            <strong>AutoAbsen Kolase P3K</strong> — Terhubung dengan Google Forms, Google Sheets, Google Drive & Firebase Firestore.
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsShareModalOpen(true)}
              className="text-stone-700 hover:text-stone-900 font-semibold transition-colors flex items-center gap-1"
            >
              <span>📱 Bagikan Google Form P3K</span>
            </button>
            <span aria-hidden="true">·</span>
            <button
              onClick={() => setActiveTab('script')}
              className="hover:text-stone-900 transition-colors"
            >
              Panduan Tombol Sign Sheet
            </button>
            <span aria-hidden="true">·</span>
            <button
              onClick={() => setActiveTab('studio')}
              className="hover:text-stone-900 transition-colors"
            >
              Studio Kolase
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
