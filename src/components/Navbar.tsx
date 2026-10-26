/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Camera, Image as ImageIcon, FileSpreadsheet, Code2, Download } from 'lucide-react';

interface NavbarProps {
  activeTab: 'studio' | 'form' | 'table' | 'script';
  setActiveTab: (tab: 'studio' | 'form' | 'table' | 'script') => void;
  onQuickDownload: () => void;
  totalAttendeesCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  onQuickDownload,
  totalAttendeesCount
}) => {
  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-stone-200">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-8 px-4 sm:px-6 py-3.5">
        {/* Zone 1: Single text element Brand Zone */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-9 h-9 rounded-lg bg-stone-900 text-amber-100 flex items-center justify-center font-bold text-base shadow-sm">
            <Camera className="w-5 h-5 text-amber-200" />
          </div>
          <a
            href="#studio"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('studio');
            }}
            className="text-lg font-bold tracking-tight text-stone-900 whitespace-nowrap shrink-0 hover:text-amber-900 transition-colors"
          >
            AutoAbsen Kolase
          </a>
        </div>

        {/* Zone 2: 4 single-line clean nav links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-stone-600">
          <button
            onClick={() => setActiveTab('studio')}
            className={`flex items-center gap-2 py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              activeTab === 'studio'
                ? 'border-stone-900 text-stone-900 font-semibold'
                : 'border-transparent hover:text-stone-900'
            }`}
          >
            <ImageIcon className="w-4 h-4" />
            Studio Kolase
          </button>
          <button
            onClick={() => setActiveTab('form')}
            className={`flex items-center gap-2 py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              activeTab === 'form'
                ? 'border-stone-900 text-stone-900 font-semibold'
                : 'border-transparent hover:text-stone-900'
            }`}
          >
            <Camera className="w-4 h-4" />
            Isi Presensi Peserta
          </button>
          <button
            onClick={() => setActiveTab('table')}
            className={`flex items-center gap-2 py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              activeTab === 'table'
                ? 'border-stone-900 text-stone-900 font-semibold'
                : 'border-transparent hover:text-stone-900'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            Rekap Sheets ({totalAttendeesCount})
          </button>
          <button
            onClick={() => setActiveTab('script')}
            className={`flex items-center gap-2 py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              activeTab === 'script'
                ? 'border-stone-900 text-stone-900 font-semibold'
                : 'border-transparent hover:text-stone-900'
            }`}
          >
            <Code2 className="w-4 h-4" />
            Google Apps Script
          </button>
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={onQuickDownload}
            className="flex items-center gap-1.5 px-3 sm:px-4 py-2 text-xs font-semibold text-white bg-stone-900 hover:bg-stone-800 rounded-lg shadow-sm transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Unduh PNG Kolase</span>
            <span className="sm:hidden">Unduh PNG</span>
          </button>
        </div>
      </div>

      {/* Mobile nav strip */}
      <div className="md:hidden flex items-center justify-around border-t border-stone-100 bg-stone-50/80 px-2 py-2 text-xs font-medium text-stone-600">
        <button
          onClick={() => setActiveTab('studio')}
          className={`px-2 py-1 rounded ${activeTab === 'studio' ? 'bg-stone-200 text-stone-900 font-bold' : ''}`}
        >
          Studio
        </button>
        <button
          onClick={() => setActiveTab('form')}
          className={`px-2 py-1 rounded ${activeTab === 'form' ? 'bg-stone-200 text-stone-900 font-bold' : ''}`}
        >
          Presensi
        </button>
        <button
          onClick={() => setActiveTab('table')}
          className={`px-2 py-1 rounded ${activeTab === 'table' ? 'bg-stone-200 text-stone-900 font-bold' : ''}`}
        >
          Rekap ({totalAttendeesCount})
        </button>
        <button
          onClick={() => setActiveTab('script')}
          className={`px-2 py-1 rounded ${activeTab === 'script' ? 'bg-stone-200 text-stone-900 font-bold' : ''}`}
        >
          Apps Script
        </button>
      </div>
    </header>
  );
};
