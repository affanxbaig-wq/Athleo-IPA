/**
 * progressPhotoService.ts
 *
 * Manages the local progress photo vault — stores per-check-in photo metadata
 * (URI, angle, date, weight) in MMKV, computes before/after comparison pairs,
 * and derives body measurement deltas across check-ins.
 *
 * No native image picker is used here; the service expects a `uri` (file://
 * path or content:// URI) already obtained from react-native-image-picker or
 * the camera. All data is stored purely locally (MMKV) so it remains
 * available even without an internet connection.
 */

import {appStorage} from './storage';

// ─── Types ────────────────────────────────────────────────────────────────────

export type PhotoAngle = 'front' | 'side' | 'back' | 'custom';

export type ProgressPhoto = {
  id: string;
  uri: string;
  angle: PhotoAngle;
  label: string;
  weightKg: number;
  date: string;
  timestamp: number;
};

export type BodyMeasurementSnapshot = {
  waistCm: number | null;
  chestCm: number | null;
  bicepCm: number | null;
  hipCm: number | null;
  thighCm: number | null;
  date: string;
};

export type CheckIn = {
  id: string;
  date: string;
  timestamp: number;
  weightKg: number;
  photos: ProgressPhoto[];
  measurements: BodyMeasurementSnapshot | null;
};

export type VaultStats = {
  totalPhotos: number;
  totalCheckIns: number;
  weightDeltaKg: number | null;
  firstDate: string | null;
  latestDate: string | null;
  daysSinceStart: number;
};

// ─── Storage Keys ─────────────────────────────────────────────────────────────

const PHOTOS_KEY = 'vault_photos_v1';
const CHECKINS_KEY = 'vault_checkins_v1';

// ─── Internal Helpers ─────────────────────────────────────────────────────────

function loadPhotos(): ProgressPhoto[] {
  return appStorage.getObject<ProgressPhoto[]>(PHOTOS_KEY) ?? [];
}

function savePhotos(photos: ProgressPhoto[]): void {
  appStorage.setObject(PHOTOS_KEY, photos);
}

function loadCheckIns(): CheckIn[] {
  return appStorage.getObject<CheckIn[]>(CHECKINS_KEY) ?? [];
}

function saveCheckIns(checkIns: CheckIn[]): void {
  appStorage.setObject(CHECKINS_KEY, checkIns);
}

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function shortLabel(date: string): string {
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
                  'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const [, monthStr, dayStr] = date.split('-');
  const month = months[(parseInt(monthStr, 10) - 1)] ?? 'UNK';
  const day = parseInt(dayStr, 10);
  return `${month} ${day.toString().padStart(2, '0')}`;
}

// ─── Photo CRUD ───────────────────────────────────────────────────────────────

export function addProgressPhoto(params: {
  uri: string;
  angle: PhotoAngle;
  weightKg: number;
  date?: string;
}): ProgressPhoto {
  const date = params.date ?? todayKey();
  const timestamp = new Date(date).getTime() || Date.now();
  const id = `${params.angle}_${date}_${Date.now()}`;

  const photo: ProgressPhoto = {
    id,
    uri: params.uri,
    angle: params.angle,
    label: shortLabel(date),
    weightKg: params.weightKg,
    date,
    timestamp,
  };

  const photos = loadPhotos();
  photos.push(photo);
  photos.sort((a, b) => a.timestamp - b.timestamp);
  savePhotos(photos);

  upsertCheckIn({date, weightKg: params.weightKg, newPhoto: photo});
  return photo;
}

export function deleteProgressPhoto(photoId: string): void {
  const photos = loadPhotos().filter(p => p.id !== photoId);
  savePhotos(photos);

  const checkIns = loadCheckIns().map(ci => ({
    ...ci,
    photos: ci.photos.filter(p => p.id !== photoId),
  }));
  saveCheckIns(checkIns.filter(ci => ci.photos.length > 0 || ci.measurements !== null));
}

export function getAllProgressPhotos(): ProgressPhoto[] {
  return loadPhotos();
}

export function getPhotosByAngle(angle: PhotoAngle): ProgressPhoto[] {
  return loadPhotos().filter(p => p.angle === angle);
}

// ─── Check-In Management ─────────────────────────────────────────────────────

function upsertCheckIn(params: {
  date: string;
  weightKg: number;
  newPhoto: ProgressPhoto;
}): CheckIn {
  const checkIns = loadCheckIns();
  const idx = checkIns.findIndex(ci => ci.date === params.date);
  const timestamp = new Date(params.date).getTime() || Date.now();

  if (idx >= 0) {
    const existing = checkIns[idx];
    const hasPhoto = existing.photos.some(p => p.id === params.newPhoto.id);
    if (!hasPhoto) {
      existing.photos.push(params.newPhoto);
    }
    existing.weightKg = params.weightKg;
    checkIns[idx] = existing;
    saveCheckIns(checkIns);
    return existing;
  }

  const newCheckIn: CheckIn = {
    id: `checkin_${params.date}`,
    date: params.date,
    timestamp,
    weightKg: params.weightKg,
    photos: [params.newPhoto],
    measurements: null,
  };
  checkIns.push(newCheckIn);
  checkIns.sort((a, b) => a.timestamp - b.timestamp);
  saveCheckIns(checkIns);
  return newCheckIn;
}

export function getAllCheckIns(): CheckIn[] {
  return loadCheckIns();
}

export function updateMeasurements(
  date: string,
  measurements: Omit<BodyMeasurementSnapshot, 'date'>,
): void {
  const checkIns = loadCheckIns();
  const idx = checkIns.findIndex(ci => ci.date === date);
  if (idx >= 0) {
    checkIns[idx].measurements = {...measurements, date};
    saveCheckIns(checkIns);
  }
}

// ─── Analytics ────────────────────────────────────────────────────────────────

export function getVaultStats(): VaultStats {
  const checkIns = loadCheckIns();
  const photos = loadPhotos();

  if (checkIns.length === 0) {
    return {
      totalPhotos: 0,
      totalCheckIns: 0,
      weightDeltaKg: null,
      firstDate: null,
      latestDate: null,
      daysSinceStart: 0,
    };
  }

  const first = checkIns[0];
  const last = checkIns[checkIns.length - 1];
  const weightDelta =
    last.weightKg > 0 && first.weightKg > 0
      ? Math.round((last.weightKg - first.weightKg) * 10) / 10
      : null;

  const daysSinceStart = Math.floor(
    (Date.now() - new Date(first.date).getTime()) / (1000 * 60 * 60 * 24),
  );

  return {
    totalPhotos: photos.length,
    totalCheckIns: checkIns.length,
    weightDeltaKg: weightDelta,
    firstDate: first.date,
    latestDate: last.date,
    daysSinceStart,
  };
}

export function getComparisonPair(
  angle: PhotoAngle,
): [ProgressPhoto, ProgressPhoto] | null {
  const photos = getPhotosByAngle(angle);
  if (photos.length < 2) {
    return null;
  }
  return [photos[0], photos[photos.length - 1]];
}

export function getMeasurementDeltas(): Partial<
  Record<keyof Omit<BodyMeasurementSnapshot, 'date'>, number>
> {
  const checkIns = loadCheckIns().filter(ci => ci.measurements !== null);
  if (checkIns.length < 2) {
    return {};
  }

  const first = checkIns[0].measurements!;
  const last = checkIns[checkIns.length - 1].measurements!;

  const keys: Array<keyof Omit<BodyMeasurementSnapshot, 'date'>> = [
    'waistCm', 'chestCm', 'bicepCm', 'hipCm', 'thighCm',
  ];

  const deltas: Partial<Record<keyof Omit<BodyMeasurementSnapshot, 'date'>, number>> = {};
  for (const key of keys) {
    const f = first[key];
    const l = last[key];
    if (f !== null && l !== null && f !== undefined && l !== undefined) {
      deltas[key] = Math.round((l - f) * 10) / 10;
    }
  }
  return deltas;
}
