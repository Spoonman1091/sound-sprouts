import { createPlayer } from './audio/player.js';
import { stopWhenHidden } from './audio/visibility.js';
import { prompt } from './audio/clips.js';
import { loadProgress, saveProgress, createMemoryStorage } from './state/storage.js';
import { planSession } from './curriculum/scheduler.js';
import { renderHome } from './screens/home.js';
import { runSession } from './screens/session.js';
import { renderDone } from './screens/done.js';
import { createProgress, setChildName } from './state/progress.js';
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
const loaded = loadProgress(storage);
let state = {
  progress: loaded.progress,
  storageStatus: available ? loaded.status : 'unavailable',
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
  renderHome(root, { progress: state.progress, onPlay: startSession, onParent: showGate });
}

async function startSession() {
  const before = state.progress;
  const planIds = planSession(before);
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
  renderDone(root, { before, after, player, onHome: showHome });
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
  });
}

stopWhenHidden(document, player);
showHome();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).catch(() => {
    state = { ...state, audioErrors: [...state.audioErrors, 'offline mode unavailable'] };
  });
}
