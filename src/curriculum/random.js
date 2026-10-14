export function shuffle(items, rng = Math.random) {
  return items
    .map((item) => ({ item, key: rng() }))
    .sort((a, b) => a.key - b.key)
    .map(({ item }) => item);
}

export function pick(items, rng = Math.random) {
  if (items.length === 0) throw new Error('pick() needs a non-empty list');
  return items[Math.floor(rng() * items.length)];
}
