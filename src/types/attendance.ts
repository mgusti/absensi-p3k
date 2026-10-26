/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type AttendanceSession = 'Pagi' | 'Sore';

export interface AttendanceRecord {
  id: string;
  timestamp: string; // ISO string
  nip: string;
  name: string;
  session: AttendanceSession;
  date: string; // YYYY-MM-DD
  photoUrl: string;
  status: 'valid' | 'duplicate_flagged' | 'overwritten';
  department?: string;
}

export type CollageTemplate = 'beige' | 'formal' | 'minimal';
export type CollageOrientation = 'portrait' | 'landscape';
export type LogoPreset = 'garuda' | 'pemerintah' | 'bumn' | 'kemenkes' | 'custom' | 'none';
export type DuplicatePolicy = 'reject' | 'flag' | 'overwrite';

export interface CollageSettings {
  template: CollageTemplate;
  orientation: CollageOrientation;
  institutionName: string;
  unitName: string;
  logoType: LogoPreset;
  customLogoUrl?: string;
  footerNote: string;
  accentColor?: string;
  showTimestamp: boolean;
  duplicatePolicy: DuplicatePolicy;
  selectedDate: string;
  selectedSession: AttendanceSession;
}
