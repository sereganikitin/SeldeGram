// Берёт self-contained exe из target/release и кладёт рядом как портативный.
// Tauri 2 встраивает frontend assets в бинарник, так что exe можно носить с
// флешки. Единственное внешнее требование — WebView2 Runtime, который есть
// почти на любом современном Windows.

import { mkdirSync, copyFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

const candidates = [
  join(root, 'src-tauri', 'target', 'release', 'crabogram-desktop.exe'),
  join(root, 'src-tauri', 'target', 'release', 'CraboGram.exe'),
];

const src = candidates.find((p) => existsSync(p));
if (!src) {
  console.error('[portable] release exe not found — run `npm run build` first');
  process.exit(1);
}

const outDir = join(root, 'src-tauri', 'target', 'release', 'portable');
mkdirSync(outDir, { recursive: true });
const dst = join(outDir, 'CraboGram-portable.exe');
copyFileSync(src, dst);

const sizeMb = (statSync(dst).size / 1024 / 1024).toFixed(1);
console.log(`[portable] copied ${src}`);
console.log(`[portable]    →   ${dst} (${sizeMb} MB)`);
console.log('[portable] this exe is self-contained — no install needed.');
console.log('[portable] requires WebView2 Runtime (preinstalled on Win10/11).');
