import { CONFIG } from '../config.js';

// One shared element: iOS unlocks an element once it is played from a tap, so reuse keeps audio unlocked.
export function createPlayer({
  audio = new Audio(),
  timeoutMs = CONFIG.AUDIO_TIMEOUT_MS,
  speech = globalThis.speechSynthesis ?? null,
  Utterance = globalThis.SpeechSynthesisUtterance,
  onError = () => {},
} = {}) {
  let pending = null;

  function stop() {
    if (pending) {
      audio.pause();
      pending.finish({ ok: false, stopped: true });
    }
    speech?.cancel?.();
  }

  function play(src) {
    stop();
    return new Promise((resolve) => {
      const token = Symbol(src);
      let timer = null;
      const finish = (result) => {
        if (pending?.token !== token) return;
        pending = null;
        clearTimeout(timer);
        audio.onended = null;
        audio.onerror = null;
        if (!result.ok && !result.stopped) onError(src);
        resolve(result);
      };
      pending = { token, finish };
      timer = setTimeout(() => finish({ ok: false }), timeoutMs);
      audio.onended = () => finish({ ok: true });
      audio.onerror = () => finish({ ok: false });
      audio.src = src;
      try {
        Promise.resolve(audio.play()).catch(() => finish({ ok: false }));
      } catch {
        finish({ ok: false });
      }
    });
  }

  async function playSequence(srcs) {
    let allOk = true;
    for (const src of srcs) {
      const result = await play(src);
      if (result.stopped) return result;
      allOk = allOk && result.ok;
    }
    return { ok: allOk };
  }

  function say(text) {
    stop();
    if (!speech || typeof Utterance !== 'function') return Promise.resolve({ ok: false });
    return new Promise((resolve) => {
      const utterance = new Utterance(text);
      utterance.rate = 0.8;
      const timer = setTimeout(() => resolve({ ok: false }), timeoutMs);
      utterance.onend = () => { clearTimeout(timer); resolve({ ok: true }); };
      utterance.onerror = () => { clearTimeout(timer); resolve({ ok: false }); };
      speech.speak(utterance);
    });
  }

  return { play, playSequence, say, stop };
}
