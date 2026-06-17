# Issue 2 fix summary

This branch fixes the Chrome Extension Skeleton after the first merge.

## Fixed

- Replaced corrupted `contentScript.js` contents
- Added `getNotesForUrl()` to the storage wrapper
- Loaded `storage.js` before `contentScript.js` in Manifest V3
- Added `tabs` permission for popup active tab lookup
- Added a smoke test to catch manifest/script regressions
- Updated the GitHub Actions workflow to run the smoke test before packaging
- Renamed the artifact output to `web-shiori.zip` and artifact name to `web-shiori`

## Expected verification

GitHub Actions should pass and upload the `web-shiori` artifact.
