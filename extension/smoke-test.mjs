import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const extensionDir = new URL('.', import.meta.url).pathname;
const manifest = JSON.parse(readFileSync(join(extensionDir, 'manifest.json'), 'utf8'));

assert.equal(manifest.manifest_version, 3);
assert.equal(manifest.action.default_popup, 'popup.html');
assert.ok(manifest.permissions.includes('storage'));
assert.ok(manifest.permissions.includes('tabs'));
assert.deepEqual(manifest.content_scripts[0].js, ['storage.js', 'contentScript.js']);

for (const file of ['popup.html', 'popup.js', 'storage.js', 'contentScript.js']) {
  readFileSync(join(extensionDir, file), 'utf8');
}

const storageJs = readFileSync(join(extensionDir, 'storage.js'), 'utf8');
assert.match(storageJs, /getNotesForUrl/);
assert.match(storageJs, /updateNote/);

const contentScriptJs = readFileSync(join(extensionDir, 'contentScript.js'), 'utf8');
assert.doesNotMatch(contentScriptJs, /rgb\(async/);
assert.match(contentScriptJs, /webShioriStorage/);
assert.match(contentScriptJs, /WEB_SHIORI_GET_PAGE_CONTEXT/);
assert.match(contentScriptJs, /!note.completed/);

const popupHtml = readFileSync(join(extensionDir, 'popup.html'), 'utf8');
assert.match(popupHtml, /id="notes"/);

const popupJs = readFileSync(join(extensionDir, 'popup.js'), 'utf8');
assert.match(popupJs, /getAllNotes/);
assert.match(popupJs, /completed: true/);
assert.match(popupJs, /position/);

console.log('extension smoke test passed');
