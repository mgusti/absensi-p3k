/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatIndonesianDate,
  filterAttendees,
  paginateAttendees,
  validateNip,
  resolveAttendanceSubmission,
  SAMPLE_ATTENDEES
} from './collageLogic.ts';
import { AttendanceRecord } from '../types/attendance.ts';

test('formatIndonesianDate converts YYYY-MM-DD correctly', () => {
  assert.equal(formatIndonesianDate('2026-10-26'), '26 OKTOBER 2026');
  assert.equal(formatIndonesianDate('2026-01-01'), '1 JANUARI 2026');
  assert.equal(formatIndonesianDate('2026-12-31'), '31 DESEMBER 2026');
});

test('paginateAttendees splits 14 items into 3 pages (6, 6, 2)', () => {
  const pagi14 = filterAttendees(SAMPLE_ATTENDEES, '2026-10-26', 'Pagi');
  assert.equal(pagi14.length, 14);

  const pages = paginateAttendees(pagi14, 6);
  assert.equal(pages.length, 3);
  assert.equal(pages[0].length, 6);
  assert.equal(pages[1].length, 6);
  assert.equal(pages[2].length, 2);
});

test('filterAttendees filters correctly by date and session', () => {
  const soreRecords = filterAttendees(SAMPLE_ATTENDEES, '2026-10-26', 'Sore');
  assert.equal(soreRecords.length, 4);
  assert.ok(soreRecords.every(r => r.session === 'Sore'));

  const emptyDate = filterAttendees(SAMPLE_ATTENDEES, '2025-01-01');
  assert.equal(emptyDate.length, 0);
});

test('validateNip cleans formatting and checks minimum length', () => {
  const valid = validateNip('1988 0315-201402 1 001');
  assert.equal(valid.isValid, true);
  assert.equal(valid.cleaned, '198803152014021001');

  const short = validateNip('12');
  assert.equal(short.isValid, false);
  assert.ok(short.error);

  const nonDigit = validateNip('abc');
  assert.equal(nonDigit.isValid, false);
});

test('resolveAttendanceSubmission respects duplicate policies', () => {
  const baseList: AttendanceRecord[] = [
    {
      id: 'att-1',
      timestamp: '2026-10-26T07:00:00Z',
      nip: '19880101',
      name: 'Andi Pratama',
      session: 'Pagi',
      date: '2026-10-26',
      photoUrl: 'data:...',
      status: 'valid'
    }
  ];

  // 1. Unique candidate
  const newCandidate = {
    timestamp: '2026-10-26T07:10:00Z',
    nip: '19990202',
    name: 'Budi Santoso',
    session: 'Pagi' as const,
    date: '2026-10-26',
    photoUrl: 'data:...'
  };
  const res1 = resolveAttendanceSubmission(baseList, newCandidate, 'reject');
  assert.equal(res1.resultStatus, 'created');
  assert.equal(res1.updatedList.length, 2);

  // 2. Duplicate with reject policy
  const dupCandidate = {
    timestamp: '2026-10-26T07:15:00Z',
    nip: '19880101',
    name: 'Andi Pratama (Duplicate)',
    session: 'Pagi' as const,
    date: '2026-10-26',
    photoUrl: 'data:...'
  };
  const resReject = resolveAttendanceSubmission(baseList, dupCandidate, 'reject');
  assert.equal(resReject.resultStatus, 'rejected');
  assert.equal(resReject.updatedList.length, 1);

  // 3. Duplicate with flag policy
  const resFlag = resolveAttendanceSubmission(baseList, dupCandidate, 'flag');
  assert.equal(resFlag.resultStatus, 'flagged');
  assert.equal(resFlag.updatedList.length, 2);
  assert.equal(resFlag.updatedList[0].status, 'duplicate_flagged');

  // 4. Duplicate with overwrite policy
  const resOverwrite = resolveAttendanceSubmission(baseList, dupCandidate, 'overwrite');
  assert.equal(resOverwrite.resultStatus, 'overwritten');
  assert.equal(resOverwrite.updatedList.length, 1);
  assert.equal(resOverwrite.updatedList[0].name, 'Andi Pratama (Duplicate)');
});
