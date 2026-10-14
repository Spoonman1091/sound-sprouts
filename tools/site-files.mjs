import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

export const APP_ROOTS = Object.freeze(['index.html', 'credits.html', 'manifest.webmanifest', 'styles', 'src', 'assets']);
export const SITE_ENTRIES = Object.freeze([...APP_ROOTS, 'sw.js', 'precache.js']);
const IGNORED = /(^|\/)(\.DS_Store|SOURCES\.md)$/;

const walk = (path) => (statSync(path).isDirectory()
  ? readdirSync(path).sort().flatMap((name) => walk(join(path, name)))
  : [path]);

export const appFiles = () => APP_ROOTS.flatMap(walk).map((f) => f.split('\\').join('/')).filter((f) => !IGNORED.test(f));
