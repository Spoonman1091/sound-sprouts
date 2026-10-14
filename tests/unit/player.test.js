import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createPlayer } from '../../src/audio/player.js';

function fakeAudio({ playImpl } = {}) {
  return {
    src: '',
    onended: null,
    onerror: null,
    play: vi.fn(playImpl ?? (() => Promise.resolve())),
    pause: vi.fn(),
  };
}

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe('createPlayer', () => {
  it('resolves ok when the clip ends', async () => {
    const audio = fakeAudio();
    const player = createPlayer({ audio });
    const result = player.play('a.mp3');
    expect(audio.src).toBe('a.mp3');
    audio.onended();
    await expect(result).resolves.toEqual({ ok: true });
  });

  it('resolves not-ok and reports on a media error', async () => {
    const audio = fakeAudio();
    const onError = vi.fn();
    const result = createPlayer({ audio, onError }).play('missing.mp3');
    audio.onerror();
    await expect(result).resolves.toEqual({ ok: false });
    expect(onError).toHaveBeenCalledWith('missing.mp3');
  });

  it('resolves not-ok when play() is rejected (autoplay blocked)', async () => {
    const audio = fakeAudio({ playImpl: () => Promise.reject(new Error('NotAllowedError')) });
    const onError = vi.fn();
    await expect(createPlayer({ audio, onError }).play('a.mp3')).resolves.toEqual({ ok: false });
    expect(onError).toHaveBeenCalledOnce();
  });

  it('resolves not-ok when play() throws synchronously', async () => {
    const audio = fakeAudio({ playImpl: () => { throw new Error('boom'); } });
    await expect(createPlayer({ audio }).play('a.mp3')).resolves.toEqual({ ok: false });
  });

  it('times out if the clip never ends', async () => {
    const audio = fakeAudio();
    const result = createPlayer({ audio, timeoutMs: 1000 }).play('a.mp3');
    await vi.advanceTimersByTimeAsync(1000);
    await expect(result).resolves.toEqual({ ok: false });
  });

  it('stop() resolves the current clip as stopped without reporting', async () => {
    const audio = fakeAudio();
    const onError = vi.fn();
    const player = createPlayer({ audio, onError });
    const result = player.play('a.mp3');
    player.stop();
    await expect(result).resolves.toEqual({ ok: false, stopped: true });
    expect(audio.pause).toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });

  it('a new play() stops the previous one and late events are ignored', async () => {
    const audio = fakeAudio();
    const player = createPlayer({ audio });
    const first = player.play('a.mp3');
    const firstEnded = audio.onended;
    const second = player.play('b.mp3');
    await expect(first).resolves.toEqual({ ok: false, stopped: true });
    firstEnded();
    audio.onended();
    await expect(second).resolves.toEqual({ ok: true });
  });

  it('playSequence plays clips in order and aborts when stopped', async () => {
    const audio = fakeAudio();
    const player = createPlayer({ audio });
    const seq = player.playSequence(['a.mp3', 'b.mp3', 'c.mp3']);
    audio.onended();
    await vi.advanceTimersByTimeAsync(0);
    expect(audio.src).toBe('b.mp3');
    player.stop();
    await expect(seq).resolves.toEqual({ ok: false, stopped: true });
    expect(audio.src).toBe('b.mp3');
  });

  it('playSequence reports not-ok if any clip failed but still plays the rest', async () => {
    const audio = fakeAudio();
    const seq = createPlayer({ audio }).playSequence(['a.mp3', 'b.mp3']);
    audio.onerror();
    await vi.advanceTimersByTimeAsync(0);
    audio.onended();
    await expect(seq).resolves.toEqual({ ok: false });
  });

  it('say() uses speech synthesis when available', async () => {
    const speech = { speak: vi.fn((u) => u.onend()), cancel: vi.fn() };
    function Utterance(text) { this.text = text; }
    const player = createPlayer({ audio: fakeAudio(), speech, Utterance });
    await expect(player.say('Ava')).resolves.toEqual({ ok: true });
    expect(speech.speak.mock.calls[0][0].text).toBe('Ava');
  });

  it('say() resolves not-ok without speech support, on error, or on timeout', async () => {
    await expect(createPlayer({ audio: fakeAudio(), speech: null }).say('Ava')).resolves.toEqual({ ok: false });
    function Utterance(text) { this.text = text; }
    const failing = { speak: vi.fn((u) => u.onerror()), cancel: vi.fn() };
    await expect(createPlayer({ audio: fakeAudio(), speech: failing, Utterance }).say('Ava')).resolves.toEqual({ ok: false });
    const silent = { speak: vi.fn(), cancel: vi.fn() };
    const pending = createPlayer({ audio: fakeAudio(), speech: silent, Utterance, timeoutMs: 500 }).say('Ava');
    await vi.advanceTimersByTimeAsync(500);
    await expect(pending).resolves.toEqual({ ok: false });
  });
});
