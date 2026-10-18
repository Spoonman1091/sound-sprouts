// Home-screen taps start one thing at a time: a quick tap on a garden plot right after Play (or
// vice versa) is ignored until the first action finishes. The action still starts synchronously,
// inside the tap, so audio can unlock on iOS.
export function oneAtATime() {
  let busy = false;
  return (action) => (...args) => {
    if (busy) return undefined;
    busy = true;
    try {
      return Promise.resolve(action(...args)).finally(() => { busy = false; });
    } catch (error) {
      busy = false;
      throw error;
    }
  };
}
