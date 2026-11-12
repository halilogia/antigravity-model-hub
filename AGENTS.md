# OpenCode Model Bridge

Current scope: step 1, OpenCode API model selection inside Antigravity Desktop settings. No anygate integrations have been merged yet.

Read PROJECT.md for upstream provenance and installation. Preserve Apache-2.0 notices. Do not import or change the old addon configuration.

Run `npm run build` before deploying. It includes the feature directly in the Electron sandbox preload; never add a runtime local require to that preload.

New features use `src/features/<feature>/index.ts`. Keep pure rules in core, shared helpers in shared, cross-feature middleware in pipelines and integrations in plugins as needed. The imported upstream layout remains the compatibility foundation.

Validate with `npm test -- --run src/__tests__/opencode-picker.test.ts src/__tests__/opencode-free.test.ts src/__tests__/runtime-patch.test.ts src/__tests__/preload-compatibility.test.ts src/__tests__/model-management.test.ts`.

UI artifacts belong in root screenshots/. Do not send real API requests or copy existing credentials unless explicitly authorized. Do not claim API generation success from catalog listing or mocked tests.
