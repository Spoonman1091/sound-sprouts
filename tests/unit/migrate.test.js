import { describe, it, expect } from 'vitest';
import { CONFIG } from '../../src/config.js';
import { migrateProgress } from '../../src/state/migrate.js';

const tries = (pairs) => pairs.map(([firstTry, sessionId], at) => ({ firstTry, sessionId, at }));
const v1 = (items) => ({ version: 1, childName: 'Ava', items, sessions: [] });

describe('migrateProgress from version 1', () => {
  it('upgrades to the current version and keeps everything else', () => {
    const out = migrateProgress(v1({}));
    expect(out).toEqual({ version: CONFIG.SCHEMA_VERSION, childName: 'Ava', items: {}, sessions: [] });
    expect(CONFIG.SCHEMA_VERSION).toBe(2);
  });

  it('sends a sound mastered under the old 3-in-2-lessons rule back to learning, keeping its tries', () => {
    const attempts = tries([[true, 's1'], [true, 's1'], [true, 's2']]);
    const out = migrateProgress(v1({ 'ls:s': { attempts, masteredAt: 2 } }));
    expect(out.items['ls:s']).toEqual({ attempts, masteredAt: null });
  });

  it('keeps sounds that meet the new rule', () => {
    const attempts = tries([[true, 's1'], [true, 's2'], [true, 's3'], [true, 's3']]);
    const out = migrateProgress(v1({ 'ls:s': { attempts, masteredAt: 3 } }));
    expect(out.items['ls:s'].masteredAt).toBe(3);
  });

  it('keeps sounds a parent marked, and remembers that they were marked', () => {
    const out = migrateProgress(v1({ 'ls:a': { attempts: [], masteredAt: 5 }, 'ls:t': { attempts: tries([[false, 's1']]), masteredAt: 6 } }));
    expect(out.items['ls:a']).toEqual({ attempts: [], masteredAt: 5, parentMarked: true });
    expect(out.items['ls:t'].masteredAt).toBe(6);
  });

  it('leaves unmastered sounds alone', () => {
    const item = { attempts: tries([[false, 's1']]), masteredAt: null };
    expect(migrateProgress(v1({ 'ls:s': item })).items['ls:s']).toEqual(item);
  });

  it('passes current-version progress through untouched', () => {
    const current = { version: CONFIG.SCHEMA_VERSION, childName: '', items: { 'ls:s': { attempts: [], masteredAt: 1, parentMarked: true } }, sessions: [] };
    expect(migrateProgress(current)).toBe(current);
  });
});
