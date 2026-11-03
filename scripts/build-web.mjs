// Copies the web game into www/, which Capacitor packages into the app.
import { cpSync, rmSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'www');
const include = ['index.html', 'manifest.webmanifest', 'sw.js', 'css', 'js', 'fonts', 'icons'];

rmSync(out, { recursive: true, force: true });
mkdirSync(out);
for (const item of include) cpSync(join(root, item), join(out, item), { recursive: true });
console.log(`Built web app into ${out}`);
