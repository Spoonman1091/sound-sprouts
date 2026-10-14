# Audio sources

## Phonemes (`phoneme/*.mp3`)
s, a, t, p, i, n were recorded by the family using `npm run record` (tools/recorder). They are trimmed,
high-passed and loudness-normalised by ffmpeg on save. They are original recordings, released with this project.

Wikimedia Commons and Piper phoneme candidates were auditioned (tools/audition) and rejected.

## Prompts, words and letter names (`prompt/`, `word/`, `letter/`)
- Generator: Piper TTS (https://github.com/OHF-Voice/piper1-gpl)
- PIPER_VOICE=en_US-ljspeech-high
- Voice dataset: LJ Speech (https://keithito.com/LJ-Speech-Dataset/), public domain
- Model card: https://huggingface.co/rhasspy/piper-voices/blob/main/en/en_US/ljspeech/high/MODEL_CARD
- Command template: `.venv-audio/bin/piper -m en_US-ljspeech-high --data-dir voices --length-scale 1.15 -f <out.wav> -- "<text>"`
- Rebuild: `npm run content:audio` (add `--force` to regenerate existing clips)
