// The sounds a grown-up records for slice 1, with coaching tips shown on the recorder page.
export const RECORDING_CLIPS = Object.freeze([
  { id: 's', label: 's', example: 'sun', tip: 'Hiss like a snake, about one second: "sssss". No "suh".' },
  { id: 'a', label: 'a', example: 'apple', tip: 'Short a, as at the start of "apple". Not the letter name "ay".' },
  { id: 't', label: 't', example: 'tent', tip: 'A quick, whispered tongue tap: "t". No "tuh" — no voice after it.' },
  { id: 'p', label: 'p', example: 'pig', tip: 'A quick, whispered lip pop: "p". No "puh" — no voice after it.' },
  { id: 'i', label: 'i', example: 'itchy', tip: 'Short i, as at the start of "itchy". Not the letter name "eye".' },
  { id: 'n', label: 'n', example: 'nest', tip: 'Hum through your nose, about one second: "nnnnn". No "nuh".' },
]);

export const findClip = (id) => RECORDING_CLIPS.find((clip) => clip.id === id) ?? null;
