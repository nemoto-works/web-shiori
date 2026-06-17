# web-shiori extension

Chrome Extension MVP skeleton.

## Included

- Manifest V3 configuration
- Popup UI
- Content script note rendering
- `chrome.storage.local` wrapper
- Smoke test for basic manifest/script integrity

## Smartphone-first verification

1. Open the latest GitHub Actions run for `Build extension artifact`.
2. Download the `web-shiori` artifact.
3. Confirm the zip includes:
   - `manifest.json`
   - `popup.html`
   - `popup.js`
   - `storage.js`
   - `contentScript.js`
   - `smoke-test.mjs`

Human work should stay limited to smartphone review, PR merge, and artifact confirmation.
