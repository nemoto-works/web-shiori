import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const extensionDir = new URL('.', import.meta.url).pathname;
const manifest = JSON.parse(readFileSync(join(extensionDir, 'manifest.json'), 'utf8'));

assert.equal(manifest.manifest_version, 3);
assert.equal(manifest.version, '0.1.4');
assert.equal(manifest.action.default_popup, 'popup.html');
assert.ok(manifest.permissions.includes('storage'));
assert.ok(manifest.permissions.includes('tabs'));
assert.equal(manifest.background.service_worker, 'background.js');
assert.equal(manifest.commands['quick-entry'].suggested_key.default, 'Alt+Shift+J');
assert.equal(manifest.commands['quick-entry'].description, 'Create a Web Shiori note on the active page');
assert.deepEqual(manifest.content_scripts[0].js, ['storage.js', 'contentScript.js']);

for (const file of ['popup.html', 'popup.js', 'storage.js', 'contentScript.js', 'background.js', 'package-extension.mjs']) {
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
assert.match(contentScriptJs, /isSlackWebPage/);
assert.match(contentScriptJs, /findSlackTargetUrlFromSelection/);
assert.match(contentScriptJs, /isSlackNavigableMessageUrl/);
assert.doesNotMatch(contentScriptJs, /getSlackCurrentWorkspaceMessageUrl/);
assert.doesNotMatch(contentScriptJs, /timestampId/);
assert.doesNotMatch(contentScriptJs, /data-channel-id.*return getSlack/s);
assert.match(contentScriptJs, /isWorkspaceArchivePermalink/);
assert.match(contentScriptJs, /isAppClientMessageLink/);
assert.match(contentScriptJs, /targetUrl/);
assert.match(contentScriptJs, /selectedText/);
assert.match(contentScriptJs, /selectionRect/);
assert.match(contentScriptJs, /anchor/);
assert.match(contentScriptJs, /getNoteSelectedText/);
assert.match(contentScriptJs, /findElementContainingText/);
assert.match(contentScriptJs, /scrollIntoView/);
assert.match(contentScriptJs, /getPositionNearElement/);
assert.match(contentScriptJs, /resolveRenderableNote/);
assert.match(contentScriptJs, /filter\(Boolean\)/);
assert.match(contentScriptJs, /noteMatchesCurrentPageContent/);
assert.match(contentScriptJs, /getCurrentPageMatchText/);
assert.match(contentScriptJs, /pageMatchText\.includes\(selectedText\)/);
assert.match(contentScriptJs, /MutationObserver/);
assert.match(contentScriptJs, /scheduleContentAwareRefresh/);
assert.match(contentScriptJs, /renderStickyNotes\(\{ restoreScroll: false \}\)/);
assert.match(contentScriptJs, /makeStickyNoteDraggable/);
assert.match(contentScriptJs, /pointerdown/);
assert.match(contentScriptJs, /updateNote\(note.id, \{ x, y, position \}\)/);
assert.match(contentScriptJs, /getClampedNotePosition/);
assert.match(contentScriptJs, /restoreScrollPosition/);
assert.match(contentScriptJs, /scrollTo/);
assert.match(contentScriptJs, /restoreScroll = true/);
assert.match(contentScriptJs, /renderStickyNotes\(\{ restoreScroll: false \}\)/);
assert.match(contentScriptJs, /WEB_SHIORI_QUICK_ENTRY/);
assert.match(contentScriptJs, /showQuickEntryDialog/);
assert.match(contentScriptJs, /saveQuickEntryNote/);
assert.match(contentScriptJs, /const initialPosition = getQuickEntryPosition\(\)/);
assert.match(contentScriptJs, /latestInteractionPosition/);
assert.match(contentScriptJs, /getQuickEntryFallbackPosition/);
assert.match(contentScriptJs, /dialog.style.left = `\$\{dialogPosition.x\}px`/);
assert.match(contentScriptJs, /dialog.style.top = `\$\{dialogPosition.y\}px`/);
assert.match(contentScriptJs, /saveQuickEntryNote\(noteText, initialPosition\)/);
assert.match(contentScriptJs, /openStickyNoteEditor/);
assert.match(contentScriptJs, /updateNote\(note.id, \{ text \}\)/);
assert.match(contentScriptJs, /textarea.select\(\)/);
assert.match(contentScriptJs, /const position = initialPosition \|\| getQuickEntryPosition\(\) \|\| getStickyPosition\(0\)/);
assert.match(contentScriptJs, /web-shiori-quick-entry/);
assert.match(contentScriptJs, /ctrlKey/);
assert.match(contentScriptJs, /Escape/);

const backgroundJs = readFileSync(join(extensionDir, 'background.js'), 'utf8');
assert.match(backgroundJs, /chrome\.commands\.onCommand\.addListener/);
assert.match(backgroundJs, /quick-entry/);
assert.match(backgroundJs, /chrome\.tabs\.query\(\{ active: true, currentWindow: true \}\)/);
assert.match(backgroundJs, /WEB_SHIORI_QUICK_ENTRY/);

const packageJson = JSON.parse(readFileSync(join(extensionDir, 'package.json'), 'utf8'));
assert.equal(packageJson.scripts.package, 'node package-extension.mjs');

const packageExtensionJs = readFileSync(join(extensionDir, 'package-extension.mjs'), 'utf8');
assert.match(packageExtensionJs, /web-shiori-extension\.zip/);

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
assert.match(popupJs, /getNoteNavigationUrl/);
assert.match(popupJs, /targetUrl \|\| note\?\.anchorUrl \|\| note\?\.url/);
assert.match(popupJs, /chrome\.tabs\.create/);
assert.match(popupJs, /chrome\.tabs\.update/);
assert.match(popupJs, /WEB_SHIORI_REFRESH_NOTES/);
assert.match(popupJs, /getManifest/);
assert.match(popupJs, /position/);
assert.match(popupJs, /getAnchorFromPosition/);
assert.match(popupJs, /selectedText/);
assert.match(popupJs, /anchor/);

console.log('extension smoke test passed');
