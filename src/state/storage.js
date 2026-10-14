import { CONFIG } from '../config.js';
import { createProgress } from './progress.js';

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isAttempt = (a) => isObject(a) && typeof a.firstTry === 'boolean' && typeof a.sessionId === 'string' && Number.isFinite(a.at);
const isItem = (i) => isObject(i) && Array.isArray(i.attempts) && i.attempts.every(isAttempt)
  && (i.masteredAt === null || Number.isFinite(i.masteredAt));
const isSession = (s) => isObject(s) && typeof s.sessionId === 'string' && Number.isFinite(s.at) && Number.isFinite(s.itemCount);

function isValidProgress(data) {
  return isObject(data)
    && data.version === CONFIG.SCHEMA_VERSION
    && typeof data.childName === 'string' && data.childName.length <= CONFIG.NAME_MAX_LENGTH
    && isObject(data.items) && Object.values(data.items).every(isItem)
    && Array.isArray(data.sessions) && data.sessions.every(isSession);
}

function parse(raw) {
  try {
    const data = JSON.parse(raw);
    return isValidProgress(data) ? data : null;
  } catch {
    return null;
  }
}

export function loadProgress(storage) {
  try {
    const raw = storage.getItem(CONFIG.STORAGE_KEY);
    if (raw === null) return { progress: createProgress(), status: 'fresh' };
    const progress = parse(raw);
    return progress ? { progress, status: 'loaded' } : { progress: createProgress(), status: 'reset' };
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
