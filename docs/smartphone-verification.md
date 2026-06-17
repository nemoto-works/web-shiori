# Smartphone verification guide

This project assumes smartphone-first development.

## What humans should verify

1. Open the pull request on GitHub mobile.
2. Confirm GitHub Actions passed.
3. Open the latest `Build extension artifact` run.
4. Confirm the `web-shiori` artifact exists.
5. Download or preview the artifact metadata if needed.

## What humans do not need to do

- Local clone
- Local build
- PC-based manual packaging
- Manual zip creation

## Current MVP limitation

The extension skeleton is prepared and packaged by CI. Actual Chrome extension side-loading may still require a desktop Chrome environment later, but this issue only covers skeleton, CI packaging, and artifact generation.
