import { copyFileSync, mkdirSync } from 'node:fs';

const SRC = 'node_modules/@fontsource/andika/files';
mkdirSync('assets/fonts', { recursive: true });
[400, 700].forEach((weight) => {
  copyFileSync(`${SRC}/andika-latin-${weight}-normal.woff2`, `assets/fonts/andika-${weight}.woff2`);
});
process.stdout.write('Copied Andika fonts\n');
