export function onLongPress(target, ms, callback) {
  let timer = null;
  const cancel = () => {
    clearTimeout(timer);
    timer = null;
    target.classList.remove('holding');
  };
  target.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    cancel();
    target.classList.add('holding');
    timer = setTimeout(() => { cancel(); callback(); }, ms);
  });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach((type) => target.addEventListener(type, cancel));
  target.addEventListener('contextmenu', (event) => event.preventDefault());
}
