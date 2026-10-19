import { createPlayer } from './audio/player.js';
import { stopWhenHidden } from './audio/visibility.js';
import { prompt, phoneme } from './audio/clips.js';
import { CONFIG } from './config.js';
import { loadProgress, saveProgress, createMemoryStorage, hasUnreadableBackup, dismissUnreadable } from './state/storage.js';
import { planLesson } from './curriculum/scheduler.js';
import { renderHome } from './screens/home.js';
import { runSession } from './screens/session.js';
import { runMeet } from './screens/meet.js';
import { renderDone } from './screens/done.js';
import { createProgress, setChildName, markMastered, unmarkMastered } from './state/progress.js';
import { markLetterMastered, unmarkLetterMastered } from './curriculum/unlock.js';
import { oneAtATime } from './ui/one-at-a-time.js';
import { renderGate } from './parent/gate.js';
import { renderDashboard } from './parent/dashboard.js';
import { renderMinibook } from './parent/minibook.js';

const root = document.getElementById('app');

function deviceStorage() {
  try {
    const storage = window.localStorage;
    storage.getItem('probe');
    return { storage, available: true };
  } catch {
    return { storage: createMemoryStorage(), available: false };
  }
}

const { storage, available } = deviceStorage();
const homeAction = oneAtATime();
const loaded = loadProgress(storage);
let state = {
  progress: loaded.progress,
  storageStatus: !available ? 'unavailable' : (hasUnreadableBackup(storage) ? 'reset' : loaded.status),
  audioErrors: [],
};

const player = createPlayer({
  onError: (src) => {
    state = { ...state, audioErrors: [...new Set([...state.audioErrors, src])].slice(-20) };
  },
});

function save(progress) {
  const ok = saveProgress(storage, progress);
  state = { ...state, progress, storageStatus: ok ? state.storageStatus : 'unavailable' };
}

function showHome() {
  renderHome(root, { progress: state.progress, onPlay: homeAction(startSession), onParent: homeAction(showGate), onMeet: homeAction(meetAgain) });
}

async function meetAgain(sound) {
  // play() must start inside the tap handler: that is what unlocks audio on iOS.
  player.play(phoneme(sound));
  try {
    save(await runMeet({ container: root, sound, progress: state.progress, deps: { player } }));
  } finally {
    showHome();
  }
}

async function startSession() {
  const before = state.progress;
  const planIds = planLesson(before);
  // play() must start inside the tap handler: that is what unlocks audio on iOS.
  await player.play(prompt('lets_play'));
  const after = await runSession({
    container: root,
    progress: before,
    planIds,
    sessionId: `s${Date.now()}`,
    deps: { player },
    save,
  });
  renderDone(root, { before, after, player, onHome: showHome, settleMs: CONFIG.SETTLE_MS });
}

function showGate() {
  player.stop();
  renderGate(root, { onPass: showDashboard, onCancel: showHome });
}

function showDashboard() {
  renderDashboard(root, {
    state,
    onSaveName: (name) => { save(setChildName(state.progress, name)); showDashboard(); },
    onReset: () => { save({ ...createProgress(), childName: state.progress.childName }); showDashboard(); },
    onPrint: () => { renderMinibook(document.getElementById('print'), state.progress); window.print(); },
    onDone: showHome,
    onMarkMastered: (letter) => { save(markLetterMastered(state.progress, letter, Date.now())); showDashboard(); },
    onMarkSightWordMastered: (id) => { save(markMastered(state.progress, `sight:${id}`, Date.now())); showDashboard(); },
    onUnmarkMastered: (letter) => { save(unmarkLetterMastered(state.progress, letter)); showDashboard(); },
    onUnmarkSightWordMastered: (id) => { save(unmarkMastered(state.progress, `sight:${id}`)); showDashboard(); },
    onDismissNotice: () => { dismissUnreadable(storage); state = { ...state, storageStatus: 'loaded' }; showDashboard(); },
  });
}

stopWhenHidden(document, player);
showHome();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).catch(() => {
    state = { ...state, audioErrors: [...state.audioErrors, 'offline mode unavailable'] };
  });
}
