# Issue 2: Chrome Extension Skeleton checklist

## Scope

Manifest V3 skeleton for web-shiori.

## Completion checklist

- [x] Popup UI exists
- [x] Content script exists
- [x] Storage wrapper uses `chrome.storage.local`
- [x] Content script can read notes for the current URL
- [x] GitHub Actions packages the extension
- [x] GitHub Actions uploads an artifact
- [x] Smoke test guards against manifest/script regressions

## Smartphone-only development note

Development is expected to continue through GitHub PRs and Actions. Human work should be limited to smartphone review, merge, artifact confirmation, and eventual browser/device verification.
