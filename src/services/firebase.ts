/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
  signOut
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDocs,
  deleteDoc,
  onSnapshot
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { AttendanceRecord, CollageSettings } from '../types/attendance.ts';
import { extractDriveImageId } from '../utils/collageLogic.ts';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// Google Workspace OAuth Scopes requested by user
export const WORKSPACE_SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/spreadsheets.readonly',
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/forms.body',
  'https://www.googleapis.com/auth/forms.body.readonly',
  'https://www.googleapis.com/auth/forms.responses.readonly'
];

const provider = new GoogleAuthProvider();
WORKSPACE_SCOPES.forEach((scope) => provider.addScope(scope));

const TOKEN_STORAGE_KEY = 'gdrive_workspace_access_token';
let isSigningIn = false;
let cachedAccessToken: string | null = typeof window !== 'undefined'
  ? (sessionStorage.getItem(TOKEN_STORAGE_KEY) || localStorage.getItem(TOKEN_STORAGE_KEY))
  : null;

export const setStoredAccessToken = (token: string | null) => {
  cachedAccessToken = token;
  if (typeof window !== 'undefined') {
    if (token) {
      sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
      window.dispatchEvent(new CustomEvent('gdrive_token_updated', { detail: { token } }));
    } else {
      sessionStorage.removeItem(TOKEN_STORAGE_KEY);
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      window.dispatchEvent(new CustomEvent('gdrive_token_updated', { detail: { token: null } }));
    }
  }
};

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      const token = await getAccessToken();
      if (onAuthSuccess) {
        onAuthSuccess(user, token || '');
      }
    } else {
      setStoredAccessToken(null);
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Gagal mendapatkan token akses dari Google OAuth');
    }
    setStoredAccessToken(credential.accessToken);
    return { user: result.user, accessToken: credential.accessToken };
  } catch (error: any) {
    console.error('Google Sign In Error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  if (cachedAccessToken) return cachedAccessToken;
  if (typeof window !== 'undefined') {
    const stored = sessionStorage.getItem(TOKEN_STORAGE_KEY) || localStorage.getItem(TOKEN_STORAGE_KEY);
    if (stored) {
      cachedAccessToken = stored;
      return stored;
    }
  }
  return null;
};

export const logout = async () => {
  await signOut(auth);
  setStoredAccessToken(null);
};

/* =========================================================================
   FIRESTORE ATTENDANCE PERSISTENCE
   ========================================================================= */

const ATTENDANCE_COLL = 'attendance';
const SETTINGS_COLL = 'settings';

export async function saveAttendanceToFirestore(record: AttendanceRecord): Promise<void> {
  try {
    const docRef = doc(db, ATTENDANCE_COLL, record.id);
    await setDoc(docRef, {
      nip: record.nip,
      name: record.name,
      session: record.session,
      date: record.date,
      photoUrl: record.photoUrl,
      status: record.status,
      department: record.department || '',
      timestamp: record.timestamp
    });
  } catch (err) {
    console.error('Gagal menyimpan ke Firestore:', err);
  }
}

export async function loadAttendanceFromFirestore(): Promise<AttendanceRecord[]> {
  try {
    const snap = await getDocs(collection(db, ATTENDANCE_COLL));
    const list: AttendanceRecord[] = [];
    snap.forEach((d) => {
      const data = d.data();
      list.push({
        id: d.id,
        nip: data.nip,
        name: data.name,
        session: data.session,
        date: data.date,
        photoUrl: data.photoUrl,
        status: data.status,
        department: data.department,
        timestamp: data.timestamp
      });
    });
    return list;
  } catch (err) {
    console.warn('Gagal memuat dari Firestore (menggunakan data lokal/cache):', err);
    return [];
  }
}

export function subscribeAttendance(callback: (records: AttendanceRecord[]) => void) {
  return onSnapshot(
    collection(db, ATTENDANCE_COLL),
    (snap) => {
      const list: AttendanceRecord[] = [];
      snap.forEach((d) => {
        const data = d.data();
        list.push({
          id: d.id,
          nip: data.nip,
          name: data.name,
          session: data.session,
          date: data.date,
          photoUrl: data.photoUrl,
          status: data.status,
          department: data.department,
          timestamp: data.timestamp
        });
      });
      callback(list);
    },
    (err) => {
      console.warn('Firestore snapshot error:', err);
    }
  );
}

export async function deleteAttendanceFromFirestore(recordId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, ATTENDANCE_COLL, recordId));
  } catch (err) {
    console.error('Gagal menghapus dari Firestore:', err);
  }
}

export async function saveSettingsToFirestore(settings: CollageSettings): Promise<void> {
  try {
    await setDoc(doc(db, SETTINGS_COLL, 'global'), settings);
  } catch (err) {
    console.warn('Gagal menyimpan pengaturan ke Firestore:', err);
  }
}

/* =========================================================================
   GOOGLE WORKSPACE DIRECT 1P API CALLS (SHEETS, DRIVE, FORMS)
   ========================================================================= */

/**
 * Membaca baris data langsung dari Google Sheets via Sheets API v4
 */
export async function fetchLiveGoogleSheetRows(
  spreadsheetId: string,
  range = 'Absensi_P3k!A:F'
): Promise<string[][]> {
  const token = await getAccessToken();
  if (!token) throw new Error('Silakan login terlebih dahulu untuk mengakses Google Sheets');

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Gagal membaca Google Sheets (HTTP ${res.status})`);
  }

  const data = await res.json();
  return data.values || [];
}

/**
 * Mengunggah gambar kolase langsung ke Google Drive via Drive API v3
 */
export async function uploadCollageToDrive(
  imageBlob: Blob,
  filename: string,
  parentFolderId?: string
): Promise<{ fileId: string; webViewLink: string }> {
  const token = await getAccessToken();
  if (!token) throw new Error('Silakan login terlebih dahulu untuk mengunggah ke Google Drive');

  const isPdf = filename.toLowerCase().endsWith('.pdf');
  const metadata: any = {
    name: filename,
    mimeType: isPdf ? 'application/pdf' : 'image/png'
  };

  if (parentFolderId) {
    metadata.parents = [parentFolderId];
  }

  const formData = new FormData();
  formData.append(
    'metadata',
    new Blob([JSON.stringify(metadata)], { type: 'application/json' })
  );
  formData.append('file', imageBlob);

  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`
    },
    body: formData
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Gagal mengunggah ke Google Drive (HTTP ${res.status})`);
  }

  const data = await res.json();
  return {
    fileId: data.id,
    webViewLink: `https://drive.google.com/file/d/${data.id}/view`
  };
}

/**
 * Mengambil file gambar asli dari Google Drive menggunakan Google Drive API v3 (alt=media).
 * Mengatasi masalah foto Google Drive privat yang diblokir oleh halaman login / CORS saat dimuat di canvas.
 */
export async function fetchDriveImageBlob(fileIdOrUrl: string): Promise<Blob | null> {
  // Accept both full Google Drive URLs and bare file IDs
  const fileId = extractDriveImageId(fileIdOrUrl)
    || (/^[a-zA-Z0-9_-]{20,}$/.test(fileIdOrUrl) ? fileIdOrUrl : null);
  if (!fileId) return null;

  const token = await getAccessToken();

  // 1. Coba ambil langsung dengan Google Drive API v3 jika user telah menghubungkan akun Google
  if (token) {
    try {
      const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (res.ok) {
        const blob = await res.blob();
        if (blob && blob.size > 0 && !blob.type.includes('text/html')) {
          return blob;
        }
      } else {
        console.warn(`Drive API files.get HTTP ${res.status} untuk fileId: ${fileId}`);
      }
    } catch (e) {
      console.warn('Gagal memanggil Drive API untuk gambar:', e);
    }
  }

  // 2. Coba URL thumbnail / publik jika file memiliki izin berbagi publik
  const candidateUrls = [
    `https://drive.google.com/thumbnail?id=${fileId}&sz=w1200`,
    `https://lh3.googleusercontent.com/d/${fileId}=w1200`
  ];

  for (const url of candidateUrls) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        const ct = res.headers.get('content-type') || '';
        if (!ct.includes('text/html')) {
          const blob = await res.blob();
          if (blob && blob.size > 100 && !blob.type.includes('text/html')) {
            return blob;
          }
        }
      }
    } catch {
      // lanjut ke URL berikutnya
    }
  }

  return null;
}

/**
 * Mengonversi foto Google Drive menjadi base64 Data URL lokal yang aman untuk dirender di Canvas tanpa tainting.
 */
export async function loadDriveImageAsDataUrl(fileIdOrUrl: string): Promise<string | null> {
  try {
    const blob = await fetchDriveImageBlob(fileIdOrUrl);
    if (!blob) return null;

    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve(reader.result as string);
      };
      reader.onerror = () => {
        resolve(null);
      };
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    console.warn('Gagal mengubah blob drive ke Data URL:', err);
    return null;
  }
}
