// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { processTake } from '../../tools/recorder/server.mjs';

const hasFfmpeg = spawnSync('ffmpeg', ['-version']).status === 0;
const duration = (file) => Number(spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], { encoding: 'utf8' }).stdout);

describe.skipIf(!hasFfmpeg)('processTake (real ffmpeg)', () => {
  it('trims lead-in silence but keeps a soft trailing sound, plus a short natural tail', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ss-test-'));
    try {
      const take = join(dir, 'take.wav');
      // 0.5s silence, 0.6s loud word, 0.4s soft fading "s"-like tail at about -46 dB, 0.6s silence
      spawnSync('ffmpeg', ['-y', '-loglevel', 'error',
        '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=mono:d=0.5',
        '-f', 'lavfi', '-i', 'sine=f=300:d=0.6,volume=0.3',
        '-f', 'lavfi', '-i', 'anoisesrc=d=0.4:a=0.006:c=white',
        '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=mono:d=0.6',
        '-filter_complex', '[0][1][2][3]concat=n=4:v=0:a=1', take]);
      const out = join(dir, 'out.mp3');
      processTake(readFileSync(take), out);
      const seconds = duration(out);
      expect(seconds).toBeGreaterThanOrEqual(1.1);
      expect(seconds).toBeLessThan(1.6);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
