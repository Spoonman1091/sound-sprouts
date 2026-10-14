export function stopWhenHidden(doc, player) {
  doc.addEventListener('visibilitychange', () => {
    if (doc.hidden) player.stop();
  });
}
