import { mkdirSync, readdirSync, statSync } from 'node:fs';
import { basename, join, relative } from 'node:path';
import { spawnSync } from 'node:child_process';

const extensionDir = new URL('.', import.meta.url).pathname;
const repoRoot = join(extensionDir, '..');
const artifactDir = join(repoRoot, 'artifacts');
const output = join(artifactDir, 'web-shiori-extension.zip');
const files = [];

function collect(dir) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules') continue;
    const path = join(dir, entry);
    const rel = relative(extensionDir, path);
    if (rel === basename(output)) continue;
    if (statSync(path).isDirectory()) collect(path);
    else files.push(rel);
  }
}

mkdirSync(artifactDir, { recursive: true });
collect(extensionDir);

const zip = spawnSync('zip', ['-q', '-r', output, ...files], { cwd: extensionDir, stdio: 'inherit' });
if (zip.status !== 0) {
  throw new Error('zip command failed while creating the extension artifact');
}

console.log(`created ${relative(repoRoot, output)}`);
