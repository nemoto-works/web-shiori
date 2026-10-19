import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { join, relative } from 'node:path';
import { spawnSync } from 'node:child_process';

const extensionDir = new URL('.', import.meta.url).pathname;
const repoRoot = join(extensionDir, '..');
const artifactDir = join(repoRoot, 'artifacts');
const output = join(artifactDir, 'web-shiori-extension.zip');
const files = [
  'manifest.json',
  'background.js',
  'contentScript.js',
  'storage.js',
  'popup.html',
  'popup.js',
];

mkdirSync(artifactDir, { recursive: true });
if (existsSync(output)) rmSync(output);

const zip = spawnSync('zip', ['-q', '-r', output, ...files], { cwd: extensionDir, stdio: 'inherit' });
if (zip.status !== 0) {
  throw new Error('zip command failed while creating the extension artifact');
}

console.log(`created ${relative(repoRoot, output)}`);
