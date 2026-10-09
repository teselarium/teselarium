# Proposal

## Why

The repository holds only documentation, samples and OpenSpec artifacts. There is no buildable project yet. The tile module ([docs/modules/lib/tile/README.md](../../../docs/modules/lib/tile/README.md)) is the first component to implement, and it is split into five changes: project config and basic dependencies, tile loader, collection loader, tile validator, collection validator. This change is the first of the five. It gives the other four a project they can build, test, lint and format, and it installs and checks the libraries they rely on. It does not implement any tile logic.

## What Changes

- Scaffold the OpenTesela SPA at the repository root using Vite with React and TypeScript, following [docs/stack.md](../../../docs/stack.md). Existing folders (`docs/`, `samples/`, `openspec/`, `.devcontainer/`, `.claude/`) and `README.md` are kept. The placeholder `package-lock.json` is regenerated.
- Add Vitest with the `jsdom` environment and React Testing Library, plus an `App` smoke test.
- Add Oxlint, configured to enforce the parts of [docs/code_conventions.md](../../../docs/code_conventions.md) that Oxlint can check. Add Prettier for formatting.
- Add the npm scripts `dev`, `build`, `preview`, `test`, `lint`, `format` and `format:check`.
- Install the runtime dependencies the tile module needs: `ajv` (JTD validation), `@11ty/gray-matter` (frontmatter) and `js-yaml` (collection YAML; it is already gray-matter's YAML engine). Check that they work both in Node tests and in a browser build. If `@11ty/gray-matter` does not, drop it as described in design.md D6.
- Create the `src/lib/tile/` module folder with a dependency check test, which the following changes will build on.
- Add a Playwright smoke test that loads the production build in headless Chromium, so the browser check is automatic. Prepare the devcontainer for it by installing Chromium and its system libraries in the image.
- Switch the devcontainer's linter extension and save actions from ESLint to Oxlint, and forward the Vite dev and preview ports. Add `js-yaml` and Playwright to `docs/stack.md`.

## Capabilities

### New Capabilities

None. This change is project tooling and dependencies only, so it changes no system behavior and adds no spec. The change sets `skip_specs: true`. The capabilities for loading and validating tiles and collections come with the next four changes.

### Modified Capabilities

None. No specs exist yet.

## Impact

- **New project files**: `package.json`, `package-lock.json` (regenerated), `index.html`, `vite.config.ts`, `tsconfig*.json` (including `tsconfig.test.json` for test files), `.oxlintrc.json`, `.prettierrc.json`, `.prettierignore`, `.gitignore` entries, `src/main.tsx`, `src/App.tsx`, `src/App.test.tsx`, `src/test/setup.ts`, `src/lib/tile/dependencies.test.ts`, `playwright.config.ts`, `e2e/app.spec.ts`, `public/favicon.svg` (template favicon).
- **New runtime dependencies**: `react`, `react-dom`, `ajv`, `@11ty/gray-matter` (removed if the browser check fails), `js-yaml`.
- **New dev dependencies**: `vite`, `@vitejs/plugin-react`, `typescript`, `@types/node`, `@types/react`, `@types/react-dom`, `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/jest-dom`, `oxlint`, `prettier`, `@playwright/test`.
- **Edited files**: `.devcontainer/devcontainer.json` (Oxlint extension instead of ESLint, forwarded Vite ports), `.devcontainer/Dockerfile` (Chromium and its system libraries for Playwright, OpenSpec CLI), `docs/stack.md` (adds `js-yaml` and Playwright) and `README.md` (trailing newline added by Prettier).
- **Out of scope**: all tile module logic (fetcher, parsers, loaders, validators); the remaining UI stack (Tailwind CSS, shadcn/ui, lucide-react, TanStack Router, react-i18next), which comes with the first UI change; deployment settings for static hosting (Vite `base` path, GitHub Pages workflow); CI.
