import { CONFIG } from '../config.js';
import { createProgress } from './progress.js';
import { migrateProgress } from './migrate.js';

// Older saved versions this build can upgrade.
const READABLE_VERSIONS = Object.freeze([1, CONFIG.SCHEMA_VERSION]);

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isAttempt = (a) => isObject(a) && typeof a.firstTry === 'boolean' && typeof a.sessionId === 'string' && Number.isFinite(a.at);
const isItem = (i) => isObject(i) && Array.isArray(i.attempts) && i.attempts.every(isAttempt)
  && (i.masteredAt === null || Number.isFinite(i.masteredAt))
  && (i.parentMarked === undefined || typeof i.parentMarked === 'boolean');
const isSession = (s) => isObject(s) && typeof s.sessionId === 'string' && Number.isFinite(s.at) && Number.isFinite(s.itemCount);

function isValidProgress(data) {
  return isObject(data)
    && READABLE_VERSIONS.includes(data.version)
    && typeof data.childName === 'string' && data.childName.length <= CONFIG.NAME_MAX_LENGTH
    && isObject(data.items) && Object.values(data.items).every(isItem)
    && Array.isArray(data.sessions) && data.sessions.every(isSession);
}

function parse(raw) {
  try {
    const data = JSON.parse(raw);
    return isValidProgress(data) ? migrateProgress(data) : null;
  } catch {
    return null;
  }
}

const BACKUP_KEY = `${CONFIG.STORAGE_KEY}:unreadable`;

// Unreadable data is set aside (not lost) and flags a notice until the parent dismisses it.
function backUpUnreadable(storage, raw) {
  try {
    storage.setItem(BACKUP_KEY, raw);
  } catch {
    // Storage full: the notice still shows for this run via status 'reset'.
  }
}

export function hasUnreadableBackup(storage) {
  try {
    return storage.getItem(BACKUP_KEY) !== null;
  } catch {
    return false;
  }
}

export function dismissUnreadable(storage) {
  try {
    storage.removeItem(BACKUP_KEY);
  } catch {
    // Nothing to clear if storage is unavailable.
  }
}

export function loadProgress(storage) {
  try {
    const raw = storage.getItem(CONFIG.STORAGE_KEY);
    if (raw === null) return { progress: createProgress(), status: 'fresh' };
    const progress = parse(raw);
    if (progress) return { progress, status: 'loaded' };
    backUpUnreadable(storage, raw);
    return { progress: createProgress(), status: 'reset' };
  } catch {
    return { progress: createProgress(), status: 'unavailable' };
  }
}

export function saveProgress(storage, progress) {
  try {
    storage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(progress));
    return true;
  } catch {
    return false;
  }
}

export function createMemoryStorage() {
  const data = new Map();
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => { data.set(key, String(value)); },
    removeItem: (key) => { data.delete(key); },
  };
}
