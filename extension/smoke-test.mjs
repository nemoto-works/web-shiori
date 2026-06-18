import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const extensionDir = new URL('.', import.meta.url).pathname;
const manifest = JSON.parse(readFileSync(join(extensionDir, 'manifest.json'), 'utf8'));

assert.equal(manifest.manifest_version, 3);
assert.equal(manifest.version, '0.1.3');
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
assert.match(contentScriptJs, /WEB_SHIORI_REFRESH_NOTES/);
assert.match(contentScriptJs, /querySelectorAll\('\.web-shiori-note'\)/);
assert.match(contentScriptJs, /!note.completed/);
assert.match(contentScriptJs, /getSelectionPosition/);
assert.match(contentScriptJs, /selectedText/);
assert.match(contentScriptJs, /selectionRect/);
assert.match(contentScriptJs, /getSelectionRectMetadata/);
assert.match(contentScriptJs, /makeStickyNoteDraggable/);
assert.match(contentScriptJs, /pointerdown/);
assert.match(contentScriptJs, /updateNote\(note.id, \{ x, y, position \}\)/);
assert.match(contentScriptJs, /getClampedNotePosition/);
assert.match(contentScriptJs, /restoreScrollPosition/);
assert.match(contentScriptJs, /scrollTo/);
assert.match(contentScriptJs, /restoreScroll = true/);
assert.match(contentScriptJs, /renderStickyNotes\(\{ restoreScroll: false \}\)/);

const popupHtml = readFileSync(join(extensionDir, 'popup.html'), 'utf8');
assert.match(popupHtml, /id="notes"/);
assert.match(popupHtml, /id="version"/);
assert.match(popupHtml, /width:380px/);
assert.match(popupHtml, /note-card-button/);
assert.match(popupHtml, /note-title/);
assert.match(popupHtml, /note-url/);

const popupJs = readFileSync(join(extensionDir, 'popup.js'), 'utf8');
assert.match(popupJs, /getAllNotes/);
assert.match(popupJs, /completed: true/);
assert.match(popupJs, /refreshTabsForUrl/);
assert.match(popupJs, /getMatchingTabs/);
assert.match(popupJs, /openOrFocusNoteUrl/);
assert.match(popupJs, /chrome\.tabs\.create/);
assert.match(popupJs, /chrome\.tabs\.update/);
assert.match(popupJs, /WEB_SHIORI_REFRESH_NOTES/);
assert.match(popupJs, /getManifest/);
assert.match(popupJs, /position/);
assert.match(popupJs, /getAnchorMetadata/);
assert.match(popupJs, /anchor: getAnchorMetadata/);

console.log('extension smoke test passed');
