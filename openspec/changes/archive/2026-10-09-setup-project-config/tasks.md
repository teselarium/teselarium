# Tasks

## 1. Vite + React + TypeScript scaffold (design D1, D2)

- [x] 1.1 Generate the Vite `react-ts` template in a temporary directory and copy it into the repository root. Keep `docs/`, `samples/`, `openspec/`, `.devcontainer/`, `.claude/` and `README.md`, do not copy the template's `README.md`, and replace the placeholder `package-lock.json`. Set `"name": "opentesela"` in `package.json`. Verify that `npm install && npm run build` succeeds.
- [x] 1.2 Remove the template's ESLint packages, `eslint.config.js`, demo assets and demo CSS. Replace `App.tsx` with a minimal shell (a named function declaration with an explicit return type, rendering the "OpenTesela" title) and keep `main.tsx` mounting it. Verify that `npm run build` succeeds and that `package.json` has no `eslint` dependency.

## 2. Testing with Vitest (design D3)

- [x] 2.1 Install `vitest`, `jsdom`, `@testing-library/react` and `@testing-library/jest-dom`. Configure the `lib` (node, `src/lib/**/*.test.ts`) and `app` (jsdom, rest of `src/`, `setupFiles: ["src/test/setup.ts"]`) projects in `vite.config.ts`, create `src/test/setup.ts`, and add a `test` script (`vitest run`). Verify that `npm run test` runs with no test files and does not fail on configuration errors.
- [x] 2.2 Add `src/App.test.tsx`, which renders `App` with React Testing Library and asserts that the "OpenTesela" title is in the document. Verify that it passes with `npm run test` under the `app` project.

## 3. Linting and formatting (design D4, D5)

- [x] 3.1 Install `oxlint`, add `.oxlintrc.json` with the plugins, ignore patterns and convention rules from D4, and add a `lint` script (`oxlint --deny-warnings`). Verify that `npm run lint` passes on the scaffold, and that a temporary file under `src/` with an arrow function assigned to a `const`, a missing return type, a `.forEach` call and four nested `if` blocks reports all four rules. Delete the temporary file afterwards.
- [x] 3.2 Install `prettier`, add `.prettierrc.json` (`{}`) and `.prettierignore` (D5), and add the `format` and `format:check` scripts. Run `npm run format`. Verify that `npm run format:check` passes and that `git status` shows no changes under `docs/`, `openspec/` or `samples/`.

## 4. Tile module dependencies (design D6)

- [x] 4.1 Install `ajv`, `@11ty/gray-matter` and `js-yaml` as runtime dependencies. Verify with `npm ls js-yaml` that there is a single deduped `js-yaml` 5.x shared with gray-matter.
- [x] 4.2 Add `src/lib/tile/dependencies.test.ts`, which reads the samples with `node:fs`. It checks that gray-matter parses `kallocain.md` into metadata with title `"Kallocain"` and a body starting with `Kallocain is a 1940`, that `js-yaml` parses `books_collection.yaml` with collection name `"Science fiction books"` and 3 tile entries, and that Ajv JTD compiles the `book.md` schema and accepts the Kallocain metadata. Verify that it passes with `npm run test` under the `lib` (node) project, and that `npm run lint` is clean.
- [x] 4.3 Browser check: temporarily make `App.tsx` call gray-matter on an inline tile string and render its title. Run `npm run build`, then `npm run preview`. Verify that the build prints no Node built-in or externalization warnings for gray-matter and that the title renders with no console errors. Revert the temporary code. If the check fails, apply the D6 fallback (uninstall gray-matter, update D6 and the 4.2 test).

## 5. Devcontainer and documentation (design D7)

- [x] 5.1 In `.devcontainer/devcontainer.json`, replace the `dbaeumer.vscode-eslint` extension with `oxc.oxc-vscode` and `source.fixAll.eslint` with `source.fixAll.oxc`, and add `forwardPorts: [5173, 4173]` with `portsAttributes` labels (D7). Verify that the file is valid JSON (`jq . .devcontainer/devcontainer.json`).
- [x] 5.2 Add `js-yaml` and Playwright to `docs/stack.md`, keeping the existing Oxlint line. Verify by reading the file that the list matches the dependencies installed in `package.json`, apart from the UI libraries left for later changes.
- [x] 5.3 In `vite.config.ts`, set `server.host` and `preview.host` to `"127.0.0.1"` (D7). Verify that `npm run preview` listens on `127.0.0.1:4173` (`ss -ltn`).

## 6. Browser smoke test (design D8)

- [x] 6.1 In `.devcontainer/Dockerfile`, add a `PLAYWRIGHT_VERSION` build arg. Install Chromium's system libraries with `npx -y playwright@${PLAYWRIGHT_VERSION} install-deps chromium` as root, and the browser with `npx -y playwright@${PLAYWRIGHT_VERSION} install chromium` as `node`. Leave `init-firewall.sh` unchanged. Verify that the arg matches the exact `@playwright/test` version in `package.json` and that `git diff .devcontainer/init-firewall.sh` is empty.
- [x] 6.2 Install `@playwright/test` with an exact version (D8). Add `playwright.config.ts` (`testDir: "e2e"`, Chromium project, `webServer` running `npm run build && npm run preview` on `http://127.0.0.1:4173`), `e2e/app.spec.ts` (title renders, no console errors or page errors) and a `test:e2e` script (`playwright test`). Add Playwright's output folders to `.gitignore` and the new files to `tsconfig.node.json`. Verify that `npm run build`, `npm run lint` and `npm run format:check` pass, that `npm run test` does not pick up `e2e/`, and that `npx playwright test --list` lists the test.
- [x] 6.3 After rebuilding the devcontainer, run `npm run test:e2e`. Verify that the test passes, and that it fails when `App.tsx` temporarily logs a `console.error`. Revert the temporary code.

## 7. Integration check

- [x] 7.1 On a clean install (`rm -rf node_modules && npm ci`), run `npm run build`, `npm run test`, `npm run lint`, `npm run format:check` and `npm run test:e2e`. Verify that all five succeed and that `git status` shows only the files listed in the proposal's Impact section.

## Workflow follow-up

- Archive the change once reviewed. With `skip_specs: true`, archiving adds no main spec.
- Next changes in the tile module series: tile loader, collection loader, tile validator, collection validator.
