# CI design

The `Build extension artifact` workflow is intentionally small.

## Steps

1. Checkout repository
2. Run extension smoke test
3. Zip the `extension` directory as `web-shiori.zip`
4. Upload the `web-shiori` artifact

## Why

This keeps development possible from a smartphone because GitHub Actions performs packaging and exposes the result as an artifact.
