/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AttendanceRecord, AttendanceSession, DuplicatePolicy } from '../types/attendance.ts';

const INDO_MONTHS = [
  'JANUARI', 'FEBRUARI', 'MARET', 'APRIL', 'MEI', 'JUNI',
  'JULI', 'AGUSTUS', 'SEPTEMBER', 'OKTOBER', 'NOVEMBER', 'DESEMBER'
];

/**
 * Format date string YYYY-MM-DD into "26 OKTOBER 2026"
 */
export function formatIndonesianDate(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const year = parts[0];
  const monthIdx = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);

  const monthName = INDO_MONTHS[monthIdx] || parts[1];
  return `${day} ${monthName} ${year}`;
}

/**
 * Generate standard filename for the combined multi-page PDF output
 * e.g. "Dokumentasi_Absensi_P3K_Pagi_2026-10-26_(2_Halaman).pdf"
 */
export function generatePdfFileName(session: string, date: string, pageCount: number): string {
  const safeSession = (session || 'Semua').replace(/\s+/g, '_');
  const safeDate = date || new Date().toISOString().slice(0, 10);
  const safePages = Math.max(1, pageCount);
  return `Dokumentasi_Absensi_P3K_${safeSession}_${safeDate}_(${safePages}_Halaman).pdf`;
}

/**
 * Summary badge text for the PDF export
 */
export function formatPdfSummary(pageCount: number, recordCount: number): string {
  const pages = Math.max(1, pageCount);
  return `1 File PDF (${pages} Halaman · ${recordCount} Peserta · Maks. 6 Foto/Hal)`;
}

/**
 * Filter attendees by date and optional session.
 * Excludes rejected records, keeps valid or flagged.
 */
export function filterAttendees(
  attendees: AttendanceRecord[],
  date: string,
  session?: AttendanceSession
): AttendanceRecord[] {
  return attendees.filter((item) => {
    const matchesDate = item.date === date;
    const matchesSession = !session || item.session === session;
    return matchesDate && matchesSession;
  });
}

/**
 * Split attendees into pages of maximum `pageSize` (default 6 items per page, 3x2 grid).
 */
export function paginateAttendees(
  attendees: AttendanceRecord[],
  pageSize = 6
): AttendanceRecord[][] {
  if (attendees.length === 0) return [[]];
  const pages: AttendanceRecord[][] = [];
  for (let i = 0; i < attendees.length; i += pageSize) {
    pages.push(attendees.slice(i, i + pageSize));
  }
  return pages;
}

/**
 * Extracts Google Drive file ID from open?id=, /file/d/, /d/, or uc?id= URLs
 */
export function extractDriveImageId(url: string): string | null {
  if (!url) return null;
  // Match id= parameter (open?id=, uc?id=, thumbnail?id=)
  const idMatch = url.match(/[?&]id=([a-zA-Z0-9_-]{20,})/);
  if (idMatch) return idMatch[1];

  // Match /d/ or /file/d/ path
  const dMatch = url.match(/\/d\/([a-zA-Z0-9_-]{20,})/);
  if (dMatch) return dMatch[1];

  // Generic match if Google Drive / Google UserContent URL
  if (url.includes('drive.google.com') || url.includes('googleusercontent.com')) {
    const rawMatch = url.match(/[-\w]{25,}/);
    if (rawMatch) return rawMatch[0];
  }

  return null;
}

/**
 * Returns a high-res direct image URL from a Google Drive sharing link
 */
export function getDriveDirectImageUrl(url: string): string {
  const fileId = extractDriveImageId(url);
  if (!fileId) return url;
  return `https://lh3.googleusercontent.com/d/${fileId}`;
}

/**
 * Matches a local image filename to an attendee by NIP or Name
 */
export function matchPhotoFilenameToAttendee(
  filename: string,
  attendees: AttendanceRecord[]
): AttendanceRecord | undefined {
  const baseName = filename.replace(/\.[^/.]+$/, '').trim().toLowerCase();
  const digitsOnly = baseName.replace(/\D/g, '');

  return attendees.find((a) => {
    // 1. Match exact NIP
    if (digitsOnly && a.nip === digitsOnly) return true;
    // 2. Match partial NIP if at least 4 digits
    if (digitsOnly && digitsOnly.length >= 4 && a.nip.includes(digitsOnly)) return true;
    // 3. Match Name
    const lowerName = a.name.toLowerCase();
    if (baseName && (lowerName.includes(baseName) || baseName.includes(lowerName))) return true;
    return false;
  });
}

/**
 * Parses Google Form responses CSV exported from Google Sheets
 */
export function parseGoogleSheetCsv(csvContent: string): AttendanceRecord[] {
  if (!csvContent || !csvContent.trim()) return [];

  const lines = csvContent
    .trim()
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());

  // Find column indices
  let timestampIdx = headers.findIndex((h) => h.includes('timestamp') || h.includes('waktu'));
  let nipIdx = headers.findIndex((h) => h.includes('nip'));
  let nameIdx = headers.findIndex((h) => h.includes('nama'));
  let photoIdx = headers.findIndex((h) => h.includes('foto') || h.includes('bukti') || h.includes('unggah') || h.includes('drive'));
  let sessionIdx = headers.findIndex((h) => h.includes('sesi'));

  // Fallbacks if header names are slightly different
  if (timestampIdx === -1) timestampIdx = 0;
  if (nipIdx === -1) nipIdx = 1;
  if (nameIdx === -1) nameIdx = 2;
  if (photoIdx === -1) photoIdx = 3;
  if (sessionIdx === -1) sessionIdx = 4;

  const records: AttendanceRecord[] = [];

  for (let i = 1; i < lines.length; i++) {
    const rawLine = lines[i];
    // Split by comma outside quotes
    const cols = rawLine.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map((c) => c.trim().replace(/^"|"$/g, ''));

    const rawTime = cols[timestampIdx] || '';
    const rawNip = cols[nipIdx] || '';
    const rawName = cols[nameIdx] || '';
    const rawPhoto = cols[photoIdx] || '';
    const rawSession = cols[sessionIdx] || 'Pagi';

    if (!rawNip && !rawName) continue;

    // Parse date into YYYY-MM-DD
    let dateStr = '2026-10-26';
    if (rawTime) {
      const parts = rawTime.split(' ')[0].split(/[\/\-]/);
      if (parts.length === 3) {
        // If MM/DD/YYYY (e.g. 10/26/2026)
        if (parts[2].length === 4) {
          const month = parts[0].padStart(2, '0');
          const day = parts[1].padStart(2, '0');
          const year = parts[2];
          dateStr = `${year}-${month}-${day}`;
        } else if (parts[0].length === 4) {
          // YYYY-MM-DD
          dateStr = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
        }
      }
    }

    const session: AttendanceSession = rawSession.toLowerCase().includes('sore') ? 'Sore' : 'Pagi';
    const photoUrl = rawPhoto.includes('drive.google.com')
      ? getDriveDirectImageUrl(rawPhoto)
      : rawPhoto || generateAvatarDataUrl(rawName, 'm', 'Peserta P3K');

    records.push({
      id: `p3k-${i}-${Date.now()}`,
      timestamp: rawTime ? new Date(rawTime).toISOString() : new Date().toISOString(),
      nip: rawNip.replace(/\D/g, '') || rawNip,
      name: rawName,
      session,
      date: dateStr,
      photoUrl,
      status: 'valid',
      department: 'P3K / Tenaga Kerja'
    });
  }

  return records;
}

/**
 * Validate and clean NIP (Civil Servant / Corporate ID).
 * Must contain digits; common length 8-18 digits.
 */
export function validateNip(rawNip: string): { isValid: boolean; cleaned: string; error?: string } {
  const cleaned = rawNip.replace(/\D/g, '');
  if (!cleaned) {
    return { isValid: false, cleaned: '', error: 'NIP wajib diisi dengan angka.' };
  }
  if (cleaned.length < 4) {
    return { isValid: false, cleaned, error: 'NIP minimal 4 digit.' };
  }
  return { isValid: true, cleaned };
}

/**
 * Handles duplicate checking when a participant submits attendance.
 */
export function resolveAttendanceSubmission(
  existingList: AttendanceRecord[],
  candidate: Omit<AttendanceRecord, 'id' | 'status'>,
  policy: DuplicatePolicy
): {
  updatedList: AttendanceRecord[];
  resultStatus: 'created' | 'rejected' | 'flagged' | 'overwritten';
  message: string;
} {
  const existingIndex = existingList.findIndex(
    (item) => item.nip === candidate.nip && item.date === candidate.date && item.session === candidate.session
  );

  const newId = `att-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  if (existingIndex === -1) {
    const newRecord: AttendanceRecord = {
      ...candidate,
      id: newId,
      status: 'valid'
    };
    return {
      updatedList: [newRecord, ...existingList],
      resultStatus: 'created',
      message: `Presensi berhasil dicatat untuk ${candidate.name}.`
    };
  }

  // Handle existing NIP on same date & session
  if (policy === 'reject') {
    return {
      updatedList: existingList,
      resultStatus: 'rejected',
      message: `NIP ${candidate.nip} sudah tercatat pada sesi ${candidate.session} tanggal ${candidate.date}. Duplikasi ditolak.`
    };
  }

  if (policy === 'overwrite') {
    const overwrittenRecord: AttendanceRecord = {
      ...candidate,
      id: existingList[existingIndex].id,
      status: 'overwritten'
    };
    const updated = [...existingList];
    updated[existingIndex] = overwrittenRecord;
    return {
      updatedList: updated,
      resultStatus: 'overwritten',
      message: `Data presensi untuk NIP ${candidate.nip} telah diperbarui dengan data terbaru.`
    };
  }

  // policy === 'flag'
  const flaggedRecord: AttendanceRecord = {
    ...candidate,
    id: newId,
    status: 'duplicate_flagged'
  };
  return {
    updatedList: [flaggedRecord, ...existingList],
    resultStatus: 'flagged',
    message: `Presensi tersimpan dan ditandai sebagai entri duplikat untuk verifikasi admin.`
  };
}

/**
 * Generates an SVG avatar Data URL with realistic professional styling.
 * Used for deterministic, crystal-clear sample attendance documentation.
 */
export function generateAvatarDataUrl(seedName: string, gender: 'm' | 'f' = 'm', role = 'Staff'): string {
  const hash = seedName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const colors = [
    { bg: '#E2E8F0', suit: '#1E293B', tie: '#991B1B', shirt: '#FFFFFF' },
    { bg: '#EDE9FE', suit: '#312E81', tie: '#047857', shirt: '#F8FAFC' },
    { bg: '#FEF3C7', suit: '#451A03', tie: '#B45309', shirt: '#FFFFFF' },
    { bg: '#E0F2FE', suit: '#0C4A6E', tie: '#BE185D', shirt: '#F0FDFA' },
    { bg: '#DCFCE7', suit: '#14532D', tie: '#1D4ED8', shirt: '#FFFFFF' },
    { bg: '#FCE7F3', suit: '#831843', tie: '#4338CA', shirt: '#FFFFFF' },
  ];
  const theme = colors[hash % colors.length];
  const initials = seedName.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();

  const isFemale = gender === 'f';
  const hasHijab = isFemale && (hash % 2 === 0);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 480" width="400" height="480">
    <defs>
      <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${theme.bg}" />
        <stop offset="100%" stop-color="#CBD5E1" />
      </linearGradient>
    </defs>
    <!-- Background -->
    <rect width="400" height="480" fill="url(#bgGrad)" />
    
    <!-- Office background accents -->
    <rect x="0" y="320" width="400" height="160" fill="rgba(0,0,0,0.03)" />
    <line x1="0" y1="320" x2="400" y2="320" stroke="rgba(0,0,0,0.08)" stroke-width="2" />
    <line x1="80" y1="0" x2="80" y2="320" stroke="rgba(0,0,0,0.04)" stroke-width="1.5" />
    <line x1="320" y1="0" x2="320" y2="320" stroke="rgba(0,0,0,0.04)" stroke-width="1.5" />

    <!-- Shoulders / Formal Suit -->
    <path d="M 50 480 C 70 360, 130 330, 200 330 C 270 330, 330 360, 350 480 Z" fill="${theme.suit}" />
    <!-- Shirt collar -->
    <polygon points="200,330 160,370 200,430 240,370" fill="${theme.shirt}" />
    <!-- Tie -->
    <polygon points="194,370 206,370 212,470 200,480 188,470" fill="${theme.tie}" />

    <!-- Neck -->
    <rect x="175" y="240" width="50" height="95" rx="10" fill="#E2A77E" />

    ${hasHijab ? `
      <!-- Hijab / Scarf -->
      <path d="M 120 180 C 110 320, 130 370, 200 370 C 270 370, 290 320, 280 180 C 275 110, 125 110, 120 180 Z" fill="#475569" />
      <!-- Inner face -->
      <ellipse cx="200" cy="205" rx="55" ry="68" fill="#F8CBA6" />
    ` : `
      <!-- Head / Face -->
      <ellipse cx="200" cy="195" rx="65" ry="78" fill="#F8CBA6" />
      <!-- Hair -->
      ${isFemale ? `
        <path d="M 130 195 C 130 100, 270 100, 270 195 C 275 250, 260 280, 255 290 C 240 230, 240 180, 240 180 C 240 150, 160 150, 160 180 C 160 210, 145 270, 145 290 C 135 270, 130 240, 130 195 Z" fill="#1E293B" />
      ` : `
        <path d="M 135 180 C 135 110, 265 110, 265 180 C 265 150, 255 125, 200 125 C 145 125, 135 150, 135 180 Z" fill="#1E293B" />
        <rect x="135" y="150" width="15" height="40" rx="6" fill="#1E293B" />
        <rect x="250" y="150" width="15" height="40" rx="6" fill="#1E293B" />
      `}
    `}

    <!-- Eyes -->
    <ellipse cx="180" cy="195" rx="5" ry="6" fill="#0F172A" />
    <ellipse cx="220" cy="195" rx="5" ry="6" fill="#0F172A" />
    <!-- Eyebrows -->
    <path d="M 170 182 Q 180 178 190 182" stroke="#0F172A" stroke-width="2.5" fill="none" stroke-linecap="round" />
    <path d="M 210 182 Q 220 178 230 182" stroke="#0F172A" stroke-width="2.5" fill="none" stroke-linecap="round" />
    <!-- Smile -->
    <path d="M 186 226 Q 200 238 214 226" stroke="#B45309" stroke-width="3" fill="none" stroke-linecap="round" />
    <!-- Nose -->
    <path d="M 200 196 L 198 212 L 204 212" stroke="#D97706" stroke-width="1.5" fill="none" stroke-linecap="round" />

    <!-- ID Badge Pin -->
    <rect x="100" y="380" width="40" height="28" rx="4" fill="#FFFFFF" stroke="#94A3B8" stroke-width="1.5" />
    <rect x="106" y="386" width="14" height="16" rx="2" fill="#3B82F6" />
    <line x1="124" y1="388" x2="135" y2="388" stroke="#64748B" stroke-width="2" />
    <line x1="124" y1="394" x2="135" y2="394" stroke="#94A3B8" stroke-width="1.5" />
    <line x1="124" y1="399" x2="132" y2="399" stroke="#CBD5E1" stroke-width="1.5" />

    <!-- Name Tag watermark -->
    <rect x="12" y="440" width="110" height="26" rx="6" fill="rgba(15,23,42,0.75)" />
    <text x="67" y="457" fill="#FFFFFF" font-family="sans-serif" font-size="11" font-weight="bold" text-anchor="middle">${initials} · ${role}</text>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/**
 * 14 Realistic Indonesian Attendees representing the user scenario:
 * 14 participants -> Page 1 (6), Page 2 (6), Page 3 (2).
 */
export const SAMPLE_ATTENDEES: AttendanceRecord[] = [
  // User's Real Synchronized Google Form Entries (Absensi P3K)
  {
    id: 'p3k-real-01',
    timestamp: '2026-10-26T14:43:03Z',
    nip: '1123123',
    name: 'aaaaaaaaaa',
    session: 'Pagi',
    date: '2026-10-26',
    photoUrl: getDriveDirectImageUrl('https://drive.google.com/open?id=1a3XjL1j4GiPFVDxHyuhOYFvlOnUhPH90'),
    status: 'valid',
    department: 'Peserta P3K'
  },
  {
    id: 'p3k-real-02',
    timestamp: '2026-10-26T16:00:49Z',
    nip: '1412414',
    name: 'gusti',
    session: 'Pagi',
    date: '2026-10-26',
    photoUrl: getDriveDirectImageUrl('https://drive.google.com/open?id=1qkEdHTDBtQxta0hiqI9MujdCorG_Lf4E'),
    status: 'valid',
    department: 'Peserta P3K'
  },
  {
    id: 'att-01',
    timestamp: '2026-10-26T07:14:22Z',
    nip: '198803152014021001',
    name: 'Drs. Hendra Setiawan, M.Si',
    session: 'Pagi',
    date: '2026-10-26',
    photoUrl: generateAvatarDataUrl('Hendra Setiawan', 'm', 'Kabag'),
    status: 'valid',
    department: 'Bagian Tata Usaha'
  },
  {
    id: 'att-02',
    timestamp: '2026-10-26T07:18:05Z',
    nip: '199105222018012003',
    name: 'Siti Nurhaliza, S.STP',
    session: 'Pagi',
    date: '2026-10-26',
    photoUrl: generateAvatarDataUrl('Siti Nurhaliza', 'f', 'Subbag'),
    status: 'valid',
    department: 'Kepegawaian'
  },
  {
    id: 'att-03',
    timestamp: '2026-10-26T07:22:40Z',
    nip: '198509122010121002',
    name: 'Ir. Bambang Prasetyo, M.T',
    session: 'Pagi',
    date: '2026-10-26',
    photoUrl: generateAvatarDataUrl('Bambang Prasetyo', 'm', 'Pranata'),
    status: 'valid',
    department: 'Infrastruktur IT'
  },
  {
    id: 'att-04',
    timestamp: '2026-10-26T07:25:12Z',
    nip: '199411082020122004',
    name: 'Dewi Anggraini, S.Kom',
    session: 'Pagi',
    date: '2026-10-26',
    photoUrl: generateAvatarDataUrl('Dewi Anggraini', 'f', 'Analis'),
    status: 'valid',
    department: 'Pengembangan Sistem'
  },
  {
    id: 'att-05',
    timestamp: '2026-10-26T07:29:48Z',
    nip: '198902042015031005',
    name: 'Achmad Fauzi, S.E',
    session: 'Pagi',
    date: '2026-10-26',
    photoUrl: generateAvatarDataUrl('Achmad Fauzi', 'm', 'Bendahara'),
    status: 'valid',
    department: 'Keuangan'
  },
  {
    id: 'att-06',
    timestamp: '2026-10-26T07:31:02Z',
    nip: '199307172019032006',
    name: 'Rina Kusuma Wardani, S.Sos',
    session: 'Pagi',
    date: '2026-10-26',
    photoUrl: generateAvatarDataUrl('Rina Kusuma', 'f', 'Humas'),
    status: 'valid',
    department: 'Protokol & Humas'
  },
  // Page 2 (7 - 12)
  {
    id: 'att-07',
    timestamp: '2026-10-26T07:35:19Z',
    nip: '198710252011011007',
    name: 'Budi Santoso, S.Kom, M.M',
    session: 'Pagi',
    date: '2026-10-26',
    photoUrl: generateAvatarDataUrl('Budi Santoso', 'm', 'Kasi'),
    status: 'valid',
    department: 'Data & Informasi'
  },
  {
    id: 'att-08',
    timestamp: '2026-10-26T07:38:44Z',
    nip: '199504192022032008',
    name: 'Anisa Rahmawati, S.Tr.Kom',
    session: 'Pagi',
    date: '2026-10-26',
    photoUrl: generateAvatarDataUrl('Anisa Rahmawati', 'f', 'Teknisi'),
    status: 'valid',
    department: 'Jaringan'
  },
  {
    id: 'att-09',
    timestamp: '2026-10-26T07:41:20Z',
    nip: '199012032016021009',
    name: 'M. Rizky Ramadhan, S.T',
    session: 'Pagi',
    date: '2026-10-26',
    photoUrl: generateAvatarDataUrl('Rizky Ramadhan', 'm', 'Spesialis'),
    status: 'valid',
    department: 'Keamanan Siber'
  },
  {
    id: 'att-10',
    timestamp: '2026-10-26T07:44:00Z',
    nip: '198606112009122010',
    name: 'Nurul Hidayati, M.Pd',
    session: 'Pagi',
    date: '2026-10-26',
    photoUrl: generateAvatarDataUrl('Nurul Hidayati', 'f', 'Widyaiswara'),
    status: 'valid',
    department: 'Pusdiklat'
  },
  {
    id: 'att-11',
    timestamp: '2026-10-26T07:46:15Z',
    nip: '199201302017011011',
    name: 'Doni Firmansyah, S.AP',
    session: 'Pagi',
    date: '2026-10-26',
    photoUrl: generateAvatarDataUrl('Doni Firmansyah', 'm', 'Arsiparis'),
    status: 'valid',
    department: 'Kearsipan'
  },
  {
    id: 'att-12',
    timestamp: '2026-10-26T07:49:50Z',
    nip: '199608142021042012',
    name: 'Putri Ayu Lestari, S.H',
    session: 'Pagi',
    date: '2026-10-26',
    photoUrl: generateAvatarDataUrl('Putri Ayu', 'f', 'Legal'),
    status: 'valid',
    department: 'Biro Hukum'
  },
  // Page 3 (13 - 14)
  {
    id: 'att-13',
    timestamp: '2026-10-26T07:52:10Z',
    nip: '198404282008041013',
    name: 'Dr. Agus Wibowo, S.H., M.H',
    session: 'Pagi',
    date: '2026-10-26',
    photoUrl: generateAvatarDataUrl('Agus Wibowo', 'm', 'Auditor'),
    status: 'valid',
    department: 'Inspektorat'
  },
  {
    id: 'att-14',
    timestamp: '2026-10-26T07:55:00Z',
    nip: '199710052023022014',
    name: 'Farida Zahra, S.Farm',
    session: 'Pagi',
    date: '2026-10-26',
    photoUrl: generateAvatarDataUrl('Farida Zahra', 'f', 'Apoteker'),
    status: 'valid',
    department: 'Layanan Kesehatan'
  },
  // Sore sample records
  {
    id: 'att-15',
    timestamp: '2026-10-26T16:02:11Z',
    nip: '198803152014021001',
    name: 'Drs. Hendra Setiawan, M.Si',
    session: 'Sore',
    date: '2026-10-26',
    photoUrl: generateAvatarDataUrl('Hendra Setiawan', 'm', 'Kabag'),
    status: 'valid',
    department: 'Bagian Tata Usaha'
  },
  {
    id: 'att-16',
    timestamp: '2026-10-26T16:05:40Z',
    nip: '199105222018012003',
    name: 'Siti Nurhaliza, S.STP',
    session: 'Sore',
    date: '2026-10-26',
    photoUrl: generateAvatarDataUrl('Siti Nurhaliza', 'f', 'Subbag'),
    status: 'valid',
    department: 'Kepegawaian'
  },
  {
    id: 'att-17',
    timestamp: '2026-10-26T16:11:15Z',
    nip: '198509122010121002',
    name: 'Ir. Bambang Prasetyo, M.T',
    session: 'Sore',
    date: '2026-10-26',
    photoUrl: generateAvatarDataUrl('Bambang Prasetyo', 'm', 'Pranata'),
    status: 'valid',
    department: 'Infrastruktur IT'
  },
  {
    id: 'att-18',
    timestamp: '2026-10-26T16:14:28Z',
    nip: '199411082020122004',
    name: 'Dewi Anggraini, S.Kom',
    session: 'Sore',
    date: '2026-10-26',
    photoUrl: generateAvatarDataUrl('Dewi Anggraini', 'f', 'Analis'),
    status: 'valid',
    department: 'Pengembangan Sistem'
  }
];
