# Design

## Context

See proposal.md (Why) for motivation. The repository root is not empty: it holds `docs/`, `samples/`, `openspec/`, `.devcontainer/`, `.claude/`, `README.md` and a placeholder `package-lock.json` with no packages. The devcontainer runs Node 26 and already has Prettier format-on-save. Its lint settings still point to ESLint, but `docs/stack.md` now lists Oxlint.

Constraints:

- **Static SPA**: OpenTesela is served as static files (for example GitHub Pages). Library code runs in the browser, so tile module dependencies must not need Node built-ins at runtime.
- **Stack**: [docs/stack.md](../../../docs/stack.md). This change installs only the subset needed to build, test and lint the tile module (see Non-Goals).
- **Conventions**: [docs/code_conventions.md](../../../docs/code_conventions.md) applies to all code, and as much of it as possible should be machine-checked.
- **Samples are fixtures**: later changes will assert exact metadata and body content of the files in `samples/`, so tooling must never rewrite them.

## Goals / Non-Goals

**Goals:**

- `npm install`, `npm run build`, `npm run test`, `npm run lint` and `npm run format:check` all succeed on a fresh clone. `npm run test:e2e` succeeds in the devcontainer, which ships the Chromium browser.
- Tests under `src/lib/` run without a DOM, so the tile module cannot depend on browser-only globals by accident. App and component tests run under `jsdom`.
- The tile module dependencies (`ajv`, `@11ty/gray-matter`, `js-yaml`) are installed, import cleanly in both the Node test environment and the Vite browser build, and work with the sample files.

**Non-Goals:**

- Any tile module API, types or error classes. Each of the next four changes defines what it needs.
- Path aliases (for example `@/lib`). These can be added when shadcn/ui is introduced, since it expects one.
- Coverage thresholds, git hooks and CI.

## Decisions

### D1. Scaffold from the official Vite `react-ts` template, copied into the root

Generate `npm create vite@latest <tmp> -- --template react-ts` in a temporary directory and copy its files into the repository root. Do not copy the template's `README.md` or anything that would overwrite existing folders. Then remove the template's ESLint packages and config (`eslint.config.js`, `eslint*`, `typescript-eslint`, `globals`), its demo assets and CSS, and replace `App.tsx` with a minimal shell that renders the app title. Package versions are the latest ones at install time and are recorded in `package-lock.json`.

- Why: the template is the reference setup for Vite, React and TypeScript, including the split `tsconfig.app.json` / `tsconfig.node.json`. Copying from a temporary directory avoids the template's refusal (or prompt) to write into a non-empty directory.
- Alternative considered: writing every config file by hand. More work, and more likely to drift from upstream defaults without any benefit.

### D2. Folder layout

```
index.html
vite.config.ts            # Vite + Vitest config (D3)
tsconfig.test.json        # type-checks tests, with Node types for node:fs
.oxlintrc.json            # D4
.prettierrc.json, .prettierignore   # D5
playwright.config.ts      # D8
e2e/
  app.spec.ts             # browser smoke test (D8)
src/
  main.tsx                # React entry
  App.tsx                 # minimal shell
  App.test.tsx            # jsdom smoke test
  test/setup.ts           # jest-dom matchers for jsdom tests
  lib/
    tile/
      dependencies.test.ts   # D6 dependency check (node environment)
```

`src/lib/` holds React-free modules that do not render anything, as described in [docs/modules/README.md](../../../docs/modules/README.md). The `tile` folder name matches `docs/modules/lib/tile`, and later folders such as `mod` and `mosaic` will follow the same pattern. Tests sit next to the code they test, as `*.test.ts` or `*.test.tsx`.

### D3. Vitest projects: `node` for `src/lib`, `jsdom` for the rest

Configure Vitest inside `vite.config.ts` with two `test.projects`:

- `lib`: includes `src/lib/**/*.test.ts` and uses the `node` environment.
- `app`: includes `src/**/*.test.{ts,tsx}`, excludes `src/lib/**`, uses the `jsdom` environment, and has `setupFiles: ["src/test/setup.ts"]`, which imports `@testing-library/jest-dom/vitest`.

Tests import `describe`/`it`/`expect` from `vitest` explicitly. Globals stay disabled.

- Why: putting the environment in the config, keyed by folder, guarantees that library tests never see `window` or `document`, with no per-file comment that someone could forget.
- Alternative considered: a single `jsdom` project with `// @vitest-environment node` in each library test file. Rejected because the guarantee would rest on discipline, not on config.

### D4. Oxlint enforces the conventions it can check

`.oxlintrc.json` enables the `typescript`, `unicorn`, `oxc`, `react` and `vitest` plugins. It keeps the default `correctness` category, the template's React rules (`react/rules-of-hooks`, `react/only-export-components`), and ignores `dist/`. These convention rules are errors for all linted files:

| Convention | Rule |
|---|---|
| Max three levels of indentation | `max-depth: ["error", 3]` |
| Functions as declarations, no arrow functions assigned to variables | `func-style: ["error", "declaration"]` |
| No anonymous function expressions | `func-names: ["error", "always"]` |
| Explicit return types | `typescript/explicit-function-return-type` |
| Explicit loops | `unicorn/no-array-for-each`, `unicorn/no-array-reduce` |

The script is `oxlint --deny-warnings`, so warnings also fail the run.

A local probe with Oxlint 1.87 confirmed that these rules exist and fire. Oxlint does not implement ESLint's `no-restricted-syntax`, so some conventions cannot be enforced: inline arrow callbacks, `.map`/`.filter` calls, returning an anonymous list or object literal, nested function definitions, naming and error-message context. These are checked during review.

- Why Oxlint: it is the linter listed in `docs/stack.md`, it is fast, and it needs no Prettier-compat preset because it has no stylistic rules enabled by default.
- Alternative considered: running ESLint alongside Oxlint only for `no-restricted-syntax`. Rejected because two linters for one rule goes against Keep It Simple. This can be revisited if Oxlint's JS plugin support becomes stable.

### D5. Prettier with defaults, never touching docs, specs or fixtures

`.prettierrc.json` is `{}` (Prettier defaults). `.prettierignore` lists `dist/`, `coverage/`, `package-lock.json`, `docs/`, `openspec/`, `samples/` and `.claude/`. The scripts are `format` (`prettier --write .`) and `format:check` (`prettier --check .`).

- Why ignore those folders: `samples/` holds fixtures whose exact bytes later tests rely on. `docs/` and `openspec/` are hand-written and kept by their authors. The devcontainer's format-on-save respects `.prettierignore`, so this also protects them while editing.

### D6. Tile module dependencies

- **`ajv`**: tile types are JTD schemas, imported later from `ajv/dist/jtd`.
- **`@11ty/gray-matter`** (3.x): parses tile frontmatter. Inspecting the 3.0.0 package showed it is browser-friendly. It uses `TextEncoder`/`TextDecoder` instead of `Buffer`, uses `fs` only in `matter.read()` (and its `browser` field maps `fs` to `false`), and its JavaScript frontmatter engine now throws instead of evaluating code. It is CommonJS, which Vite pre-bundles.
- **`js-yaml`** (5.x): parses collection YAML files. It is a direct dependency because the collection loader imports it. gray-matter already depends on `js-yaml ^5`, so npm installs a single copy. Version 5 ships its own types, so `@types/js-yaml` is not needed.
- **Check**: `src/lib/tile/dependencies.test.ts` (node environment) runs gray-matter on `samples/tiles/books/kallocain.md`, runs `js-yaml` on `samples/tiles/books_collection.yaml`, and compiles the `samples/types/book.md` schema with Ajv JTD and validates the Kallocain metadata against it. Separately, a temporary import of gray-matter in `App.tsx` is built with `npm run build` and loaded with `npm run preview` to confirm that it works in the browser. The temporary import is then removed.
- **Fallback**: if gray-matter fails in the browser build anyway, uninstall it and record in this section that the tile loader change will split frontmatter itself and parse it with `js-yaml`. The dependency check then drops the gray-matter case.

### D7. Devcontainer and docs

`.devcontainer/devcontainer.json` swaps `dbaeumer.vscode-eslint` for `oxc.oxc-vscode` and `source.fixAll.eslint` for `source.fixAll.oxc`. `docs/stack.md` adds `js-yaml` and Playwright. The Oxlint line is already in the user's uncommitted edit to that file.

The devcontainer also forwards the Vite ports 5173 (dev) and 4173 (preview) through `forwardPorts`, and `vite.config.ts` sets `server.host` and `preview.host` to `127.0.0.1`. Without these settings, VS Code did not forward the preview port, and Vite listened only on IPv6 `[::1]`.

The `Dockerfile` installs the OpenSpec CLI (`@fission-ai/openspec@latest`) globally, so the OpenSpec workflow keeps working after a container rebuild.

### D8. Browser smoke test with Playwright

`@playwright/test` runs `e2e/app.spec.ts` in headless Chromium against `npm run preview` (started by the `webServer` option in `playwright.config.ts`). The test asserts that the app title renders and that the page logs no console errors or uncaught exceptions. The script is `test:e2e`.

- Why: the manual browser check from 4.3 becomes repeatable. Once the app imports the tile module, the same test covers gray-matter in the browser build. Until then it only covers the app shell.
- Devcontainer: the firewall blocks the browser download at runtime, so the `Dockerfile` installs Chromium's system libraries (as root) and the browser itself (as `node`) at image build time, before the firewall is active. Both steps use a `PLAYWRIGHT_VERSION` build arg. `@playwright/test` is pinned to the same exact version in `package.json`. Upgrading Playwright means bumping both and rebuilding the container.
- Alternative considered: allowing `cdn.playwright.dev` in `init-firewall.sh`. Rejected because the domain is served by Azure Front Door, whose IPs rotate within minutes, so a startup-resolved allowlist fails. Allowing the whole Front Door range would loosen the sandbox.
- Alternative considered: Vitest browser mode for `src/lib` tests. It would cover the library in a real browser, but not the production build. It can be added later.

## Risks / Trade-offs

- [The latest Vite, Vitest and TypeScript majors may not line up yet (for example, the template pins a TypeScript version that Vitest's types do not support)] → keep the versions the template pins, and only adjust if `npm run build` or `npm run test` fails. Record any pin in `package.json` with a short reason in the commit.
- [Not every convention is lint-enforced (D4)] → listed explicitly so reviewers know what to check by hand.
- [gray-matter's default YAML engine uses js-yaml's default schema, which turns unquoted dates into `Date` objects] → not a problem for this change. The tile loader change must pass its own YAML engine (`js-yaml` with `CORE_SCHEMA`) to keep metadata JSON-compatible.
- [`dependencies.test.ts` partly tests third-party behavior] → kept on purpose and small: it pins the assumptions the next four changes build on, and an upgrade that breaks them fails here first. Later changes may delete it once their own tests cover the same ground.
