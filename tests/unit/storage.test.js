import { describe, it, expect } from 'vitest';
import { CONFIG } from '../../src/config.js';
import { createProgress, recordAttempt } from '../../src/state/progress.js';
import { loadProgress, saveProgress, createMemoryStorage, hasUnreadableBackup, dismissUnreadable } from '../../src/state/storage.js';

const throwing = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('quota'); } };

describe('storage', () => {
  it('returns fresh progress when nothing is saved', () => {
    expect(loadProgress(createMemoryStorage())).toEqual({ progress: createProgress(), status: 'fresh' });
  });

  it('round-trips saved progress', () => {
    const storage = createMemoryStorage();
    const progress = recordAttempt(createProgress(), { itemId: 'ls:s', firstTry: true, sessionId: 's1', at: 1 });
    expect(saveProgress(storage, progress)).toBe(true);
    expect(loadProgress(storage)).toEqual({ progress, status: 'loaded' });
  });

  it.each([
    ['invalid JSON', '{nope'],
    ['an old schema version', JSON.stringify({ ...createProgress(), version: 0 })],
    ['a malformed item', JSON.stringify({ ...createProgress(), items: { x: { attempts: 'bad' } } })],
    ['a malformed session', JSON.stringify({ ...createProgress(), sessions: [{ at: 'yesterday' }] })],
    ['an over-long name', JSON.stringify({ ...createProgress(), childName: 'x'.repeat(CONFIG.NAME_MAX_LENGTH + 1) })],
    ['a non-object', '42'],
  ])('resets on %s', (_, raw) => {
    const storage = createMemoryStorage();
    storage.setItem(CONFIG.STORAGE_KEY, raw);
    expect(loadProgress(storage)).toEqual({ progress: createProgress(), status: 'reset' });
  });

  it('keeps unreadable data aside so the parent is told even after the next save', () => {
    const storage = createMemoryStorage();
    storage.setItem(CONFIG.STORAGE_KEY, '{broken');
    expect(loadProgress(storage).status).toBe('reset');
    expect(storage.getItem(`${CONFIG.STORAGE_KEY}:unreadable`)).toBe('{broken');
    saveProgress(storage, createProgress());
    expect(loadProgress(storage).status).toBe('loaded');
    expect(hasUnreadableBackup(storage)).toBe(true);
    dismissUnreadable(storage);
    expect(hasUnreadableBackup(storage)).toBe(false);
  });

  it('backup helpers never throw on unavailable storage', () => {
    const broken = { getItem() { throw new Error('x'); }, removeItem() { throw new Error('x'); } };
    expect(hasUnreadableBackup(broken)).toBe(false);
    expect(() => dismissUnreadable(broken)).not.toThrow();
  });

  it('reports unavailable storage instead of throwing', () => {
    expect(loadProgress(throwing)).toEqual({ progress: createProgress(), status: 'unavailable' });
    expect(saveProgress(throwing, createProgress())).toBe(false);
  });
});
