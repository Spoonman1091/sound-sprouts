// Builds prompt/word/letter-name MP3s with Piper. Usage: node tools/build-audio.mjs [--force]
import { spawnSync } from 'node:child_process';
import { mkdirSync, existsSync, rmSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { PROMPT_TEXT, WORD_TEXT, LETTER_NAME_TEXT } from './audio-script.mjs';
import { readRecorded } from './recorder/server.mjs';

const PIPER = process.env.PIPER_BIN ?? '.venv-audio/bin/piper';
const VOICE = process.env.PIPER_VOICE ?? 'en_US-ljspeech-high';
const LENGTH_SCALE = process.env.PIPER_LENGTH_SCALE ?? '1.15';
const FORCE = process.argv.includes('--force');
const TRIM_AND_NORMALISE = [
  'silenceremove=start_periods=1:start_threshold=-45dB',
  'areverse', 'silenceremove=start_periods=1:start_threshold=-45dB', 'areverse',
  'loudnorm=I=-16',
].join(',');

function run(cmd, args) {
  const result = spawnSync(cmd, args, { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`${cmd} failed (${result.status}): ${result.stderr}`);
}

// Human recordings always win: they are never regenerated, even with --force.
export function selectJobs(jobs, { force, exists, recorded }) {
  return jobs.filter(([kind, id]) => !recorded.includes(`${kind}/${id}`) && (force || !exists(kind, id)));
}

function synth(kind, id, text) {
  const dir = `assets/audio/${kind}`;
  const mp3 = `${dir}/${id}.mp3`;
  mkdirSync(dir, { recursive: true });
  const wav = `${dir}/${id}.wav`;
  run(PIPER, ['-m', VOICE, '--data-dir', 'voices', '--length-scale', LENGTH_SCALE, '-f', wav, '--', text]);
  run('ffmpeg', ['-y', '-loglevel', 'error', '-i', wav, '-af', TRIM_AND_NORMALISE, '-ac', '1', '-ar', '44100', '-b:a', '64k', mp3]);
  rmSync(wav);
}

const jobs = [
  ...Object.entries(PROMPT_TEXT).map(([id, text]) => ['prompt', id, text]),
  ...Object.entries(WORD_TEXT).map(([id, text]) => ['word', id, text]),
  ...Object.entries(LETTER_NAME_TEXT).map(([id, text]) => ['letter', id, text]),
];

function main() {
  const exists = (kind, id) => existsSync(`assets/audio/${kind}/${id}.mp3`);
  const selected = selectJobs(jobs, { force: FORCE, exists, recorded: readRecorded() });
  selected.forEach(([kind, id, text]) => synth(kind, id, text));
  process.stdout.write(`Built ${selected.length} clips (${jobs.length - selected.length} kept)\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  }
}
