# Audio sources

All shipped clips — letter sounds (`phoneme/`), instructions and praise (`prompt/`), picture words (`word/`)
and letter names (`letter/`) — were recorded by the family with `npm run record` (tools/recorder).
On save each take is high-passed, trimmed of silence and loudness-normalised by ffmpeg.
The list of recorded clips is in `tools/recorder/recorded.json`; `npm run content:audio` never overwrites them.

## Fallback generator (not currently shipped)
If a clip is missing, `npm run content:audio` generates it with Piper TTS:
- PIPER_VOICE=en_US-ljspeech-high (LJ Speech dataset, public domain)
- Model card: https://huggingface.co/rhasspy/piper-voices/blob/main/en/en_US/ljspeech/high/MODEL_CARD
- If any generated clip ships, credit Piper and LJ Speech in credits.html (a test enforces this).

Wikimedia Commons and Piper phoneme candidates were auditioned (tools/audition) and rejected.
