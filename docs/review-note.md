# Review note

Main things to review:

1. `extension/contentScript.js` is no longer corrupted.
2. `extension/storage.js` now exposes `getNotesForUrl()`.
3. `extension/manifest.json` loads `storage.js` before `contentScript.js`.
4. CI runs `node extension/smoke-test.mjs` before creating the artifact.
5. The artifact is named `web-shiori` and contains `web-shiori.zip`.
