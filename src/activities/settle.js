const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Lets a freshly shown activity sit quietly for a moment before its first instruction plays.
export const settle = ({ wait = pause, settleMs = 0 } = {}) => (settleMs > 0 ? wait(settleMs) : Promise.resolve());
