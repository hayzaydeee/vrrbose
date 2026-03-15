#!/usr/bin/env node
/**
 * Bundles CLI and daemon into dist/ for npm publishing.
 *
 * Output layout:
 *   dist/
 *     cli.cjs       ← vrrbose CLI entry (bin)
 *     daemon.cjs    ← daemon entry (spawned by start command)
 *     schema.sql    ← SQLite schema (read by daemon at runtime)
 *     ui/           ← static web export (optional, from packages/web/out/)
 */

import { build } from 'esbuild';
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const distDir = join(root, 'dist');

// Clean dist
if (existsSync(distDir)) rmSync(distDir, { recursive: true });
mkdirSync(distDir, { recursive: true });

// Externals: native modules and packages with complex interop
const external = [
  'better-sqlite3',
  '*.node',
  'socket.io',         // complex CJS/ESM, keep as runtime dep
  '@anthropic-ai/sdk', // large, keep as runtime dep
];

// CJS format: avoids ESM/CJS interop issues entirely.
// We define import.meta.url explicitly — esbuild doesn't polyfill it in CJS bundles.
const sharedOptions = {
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'cjs',
  external,
  // NOTE: post-build we patch import_meta.url (see patchImportMeta below)

};

console.log('Bundling CLI...');
await build({
  ...sharedOptions,
  entryPoints: [join(root, 'packages/cli/src/index.ts')],
  outfile: join(distDir, 'cli.cjs'),
});

console.log('Bundling daemon...');
await build({
  ...sharedOptions,
  entryPoints: [join(root, 'packages/daemon/src/index.ts')],
  outfile: join(distDir, 'daemon.cjs'),
});

// Patch import.meta.url in CJS bundles.
// esbuild generates `var import_meta = {};` (empty) for import.meta in CJS output.
// We replace every occurrence with a proper __filename-based URL.
function patchImportMeta(filePath) {
  let src = readFileSync(filePath, 'utf8');
  // esbuild generates import_meta, import_meta2, import_meta3, ... for each bundled module
  const patched = src.replace(
    /var (import_meta\d*)\s*=\s*\{\s*\};/g,
    `var $1 = { url: require("url").pathToFileURL(__filename).href };`,
  );
  if (patched === src) console.warn(`  warn: no import_meta stub found in ${filePath}`);
  writeFileSync(filePath, patched, 'utf8');
}

console.log('Patching import.meta in CLI bundle...');
patchImportMeta(join(distDir, 'cli.cjs'));
console.log('Patching import.meta in daemon bundle...');
patchImportMeta(join(distDir, 'daemon.cjs'));

// Copy schema.sql — daemon reads it via __dirname + '/schema.sql'
console.log('Copying schema.sql...');
copyFileSync(
  join(root, 'packages/daemon/src/db/schema.sql'),
  join(distDir, 'schema.sql'),
);

// Copy web UI static export if it exists
const webOut = join(root, 'packages/web/out');
if (existsSync(webOut)) {
  console.log('Copying web UI...');
  cpSync(webOut, join(distDir, 'ui'), { recursive: true });
} else {
  console.log('Web UI not built — skipping (run `pnpm --filter @vrrbose/web build` first)');
}

console.log('Done → dist/');
