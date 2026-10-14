import { cpSync, rmSync, mkdirSync } from 'node:fs';
import { SITE_ENTRIES } from './site-files.mjs';

rmSync('_site', { recursive: true, force: true });
mkdirSync('_site');
SITE_ENTRIES.forEach((entry) => cpSync(entry, `_site/${entry}`, { recursive: true }));
rmSync('_site/assets/audio/SOURCES.md', { force: true });
process.stdout.write('Built _site/\n');
