# Sound Sprouts 🌱

A free, ad-free phonics garden for young readers. Runs in a tablet browser, works offline, and stores progress only on the device.

## Use it
Open the site on the tablet, then **Add to Home screen** (Chrome menu on Android, Share → Add to Home Screen on iPad).
Grown-ups: press and hold the ⚙ in the corner for 2 seconds.

## Develop
```bash
npm install
npm test          # unit tests + coverage
npm run e2e       # Playwright (Android tablet + iPad profiles)
npm run serve     # http://127.0.0.1:4173
npm run precache  # after changing or recording any app file
```

## Record your own voice
```bash
npm run record    # http://localhost:4174
```
Record letter sounds, instructions, and (optionally) picture words and letter names. Anything not recorded uses the Piper voice. Recordings are listed in `tools/recorder/recorded.json` and are never overwritten by `npm run content:audio`.

Content tools (`tools/`) rebuild speech (Piper + ffmpeg), pictures (OpenMoji) and fonts. See `assets/audio/SOURCES.md` and `credits.html`.
