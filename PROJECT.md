# OpenCode Model Bridge — step 1

Antigravity Desktop Settings → Models & Usage → OpenCode Models.

Enter an OpenCode Console API key, choose Go or Console (Zen), fetch the live catalog, search and add selected models. Saved models use the existing encrypted credential store and Cloud Code adapter. Catalog discovery makes no generation request. Actual access, quota and tool compatibility require a separate generation test.

This is a local derivative of vahapogut/antigravity-add-model at e77954b9a58e5b9408e8d3bc1cedbb5a6c456125, Apache-2.0. The original license is retained. Anygate code has not been incorporated. Original Downloads checkouts are preserved and their launchers are stopped.

Configuration is isolated under `~/.gemini/antigravity/opencode-model-bridge/`. Existing addon models and API keys are not imported or modified. New installations start with an empty catalog, without upstream example models.

Build: `npm ci --ignore-scripts`, `npm run build`.
Install with Antigravity closed: `node scripts/deploy.mjs --check`, then `node scripts/deploy.mjs`.
Restore with Antigravity closed: `node scripts/deploy.mjs --restore`.

The imported upstream tree is retained as the compatibility foundation. New vertical features live in `src/features/` and expose `index.ts`. `src/core/`, `src/shared/`, `src/pipelines/`, `src/plugins/` are reserved for code as it becomes necessary; no empty runtime abstractions are introduced. The picker is compiled into the sandbox preload with the build script.
