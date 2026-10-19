# Tasks

Each group writes its tests first (TDD) and names each test after the spec scenario it covers, so every scenario in `specs/mod-loading`, `specs/mod-sandbox`, `specs/mod-engine-api`, `specs/mod-stage` and `specs/default-mods` can be traced to a test. Unit tests run in Node (Vitest project `lib`), component tests in jsdom (project `app`), and frame behavior in Playwright on the built app (design D21).

## 1. Groundwork (design D18, D19)

- [ ] 1.1 Move `samples/` to `public/samples/` with `git mv`. Point `SAMPLES_DIRECTORY_URL` in `src/test/sample_files.ts` and `readSample` in `src/lib/tile/dependencies.test.ts` to `public/samples/`. In `.prettierignore`, replace `samples/` with `public/samples/tiles/` and `public/samples/types/`. Verify that `npm test` passes with the same number of tests as before and that `npm run format:check` succeeds.
- [ ] 1.2 Set `appType: "mpa"` in `vite.config.ts`. Verify with `npm run build && npm run preview` that `/` serves the app, `/samples/tiles/books_collection.yaml` answers 200 with the YAML, and `/samples/missing.yaml` answers 404. Then verify that `npm run test:e2e` still passes.
- [ ] 1.3 Add `public/samples/mods/book_list/mod_conf.yaml` and `main.js` as in D19, following the code conventions: named functions, explicit loops, no returned literals, and the engine API from D9. Verify that `npm run lint` and `npm run format:check` are clean. Its behavior is checked by the Playwright tests in group 8.

## 2. Mod loading (design D2, D3, D4)

- [ ] 2.1 Write `src/lib/mod/mod_errors.test.ts` with the checks the tile errors have: `instanceof Error`, `name`, `source`, the message `Invalid mod "<source>": <reason>`, and `cause` kept. Then add `ModFormatError` to `src/lib/mod/mod_errors.ts`. Verify that the test passes and that `npm run lint` is clean.
- [ ] 2.2 Write `src/lib/mod/mod_format.test.ts` and `src/lib/mod/mod_permissions.test.ts`, calling `readModFormat` and `readModPermissions` with inline `ParsedYaml` values. Cover:
  - every D3 reason (no `mod` mapping, each required field missing or not a string, `version: 1`, `config` as a list, `sample_collection: ""`, `schema` present);
  - the defaults of the "Minimal mod file" scenario, and unknown keys ignored;
  - the permission categories: unknown `shows` (the message lists the five categories), an entry that is not a mapping, a missing `reason`, the category order when `open` and `code` come before `show`, and each host case from the "Permission hosts are origins" requirement (port kept; path, wildcard, `wss:`, trailing slash and user info rejected; `"*"` accepted in `open` and rejected in `show`).

  Verify that the tests fail before 2.3.
- [ ] 2.3 Export `isYamlMapping` and `describeYamlValue` from `src/lib/tile/index.ts` and add them to the export list pinned in `tile_loader.test.ts`. Then implement `src/lib/mod/mod_permissions.ts` and `src/lib/mod/mod_format.ts` following D3: one named function per field, the two helpers imported from `src/lib/tile/index.ts`, and the `url.origin === host` check. Verify that both test files and `tile_loader.test.ts` pass and that `npm run lint` is clean, depth limit included.
- [ ] 2.4 Write `src/lib/mod/mod_reference.test.ts` with every scenario of the "Default mod names", "Mod files and folders" and "One mod, one source" requirements: a default mod name, a folder with and without a trailing `/`, a `.yaml` and a `.yml` file, `Book-List` read as a folder, a folder with a query, a name without a default mods folder (fails with a fetch error), and the three references to the sample mod giving one source. Then implement `src/lib/mod/mod_reference.ts` following D4. Verify that the test passes and that `npm run lint` is clean.
- [ ] 2.5 Write `src/lib/mod/mod_loader.test.ts`, importing only from `./index.ts`, with `fetchSample` for the sample mod and `fetchTestFile` (wrapped in `vi.fn`) for inline mod files. Cover every remaining scenario of `specs/mod-loading/spec.md`: the sample mod (fields, `sampleCollection`, and `code` equal to the text of `public/samples/mods/book_list/main.js`), the relative path with a base URL, entrypoint, type path and sample collection resolved against the mod file (and the collection not requested), no `type_path`, `loadModFile` not requesting the entrypoint, invalid YAML, HTTP 404 for the mod file and for the entrypoint, the three failure kinds told apart, structured clone, and independent loads. Verify that the tests fail before 2.6.
- [ ] 2.6 Implement `src/lib/mod/mod_loader.ts` (`ModFile`, `LoadedMod`, `ModLoadOptions`, `loadModFile`, `loadMod`) following D4, and `src/lib/mod/index.ts` exporting `loadModFile`, `loadMod`, `resolveModReference`, `ModFormatError` and the types `ModFile`, `LoadedMod`, `ModLoadOptions`, `ModPermission` and `PermissionCategory`. Add an "exports the public API" test, like the tile module's, that pins the runtime exports. Verify that every `src/lib/mod` test passes and that `npm run lint` and `npm run build` succeed.
- [ ] 2.7 Write the first part of `docs/modules/lib/mod/README.md` (D22): the mod file format with a full `mod_conf.yaml` example (the sample's), the permission categories and host rules, mod references with the D4 table, and a "Mod loader" entry under *Module Details* with `loadModFile` and `loadMod` examples. Verify that every name the entry uses is exported from `src/lib/mod/index.ts` and that the examples match the signatures.

## 3. Grants, content policy, reports and the sandbox document (design D5 to D9)

- [ ] 3.1 Write `src/lib/mod/mod_grants.test.ts`, `src/lib/core/sandbox/sandbox_policy.test.ts` and `src/lib/core/sandbox/sandbox_reports.test.ts`:
  - Grants: same origin grants every declared permission and denies none, another origin denies all, no permissions gives two empty lists, and the `describeDeniedPermission` text names the category verb (including "open mods from" and "any site" for `"*"`), host and reason.
  - `checkOpenGrant`: `null` for a granted `"*"` and for a granted target origin; the "not declared" message naming the origin and `permissions.open`; the "declared but not granted" message for a foreign mod.
  - Content hosts: the "Sample content hosts" and "Tile from another host" scenarios, `file:` and `data:` sources dropped, duplicates removed and the output sorted.
  - Policy: the exact policy string for no grants, then with one host per category. Hosts appear only in their directives, `open` hosts appear in none, every directive's hosts are sorted and without duplicates, and the directive order follows the D6 table.
  - Reports: each directive in the D7 table maps to its category. An undeclared host says to add it to `permissions.<category>`. A declared but denied host says it was not granted. `object-src` and an `inline` blocked URL give the "Blocked by the sandbox policy" text. A full URL is reduced to its origin.

  Verify that the tests fail before 3.2.
- [ ] 3.2 Implement `src/lib/mod/mod_issues.ts` and `src/lib/mod/mod_grants.ts` following D5, and export `grantModPermissions`, `describeDeniedPermission`, `checkOpenGrant` and the types `ModGrants` and `ModIssue` from `src/lib/mod/index.ts`, updating the pinned export list. Then implement `src/lib/core/sandbox/sandbox_policy.ts` and `src/lib/core/sandbox/sandbox_reports.ts` following D6 and D7, using only the public entry point of `src/lib/mod`, and create `src/lib/core/sandbox/index.ts` exporting `collectContentHosts`, `buildSandboxPolicy`, `describeBlockedRequest` and the type `BlockedRequest`, with an "exports the public API" test that pins the runtime exports. Verify that the three test files pass and that `npm run lint` is clean.
- [ ] 3.3 Write `src/lib/core/sandbox/sandbox_document.test.ts`: the policy `<meta>` comes before the bootstrap `<script>`, the policy text is inserted as given, and the bootstrap text (imported with `?raw`) has no `</script`. Then write `src/lib/core/sandbox/sandbox_bootstrap.js` following D9 and `src/lib/core/sandbox/sandbox_document.ts` following D8, and export `buildSandboxDocument` from `src/lib/core/sandbox/index.ts`, updating the pinned export list. Verify that the test passes, that `npm run lint` is clean for the bootstrap too, and that `npm run build` succeeds. The bootstrap runs only in a browser, so its behavior is checked by the Playwright tests in group 8.
- [ ] 3.4 Add the site-owner rule and the `open` checks to `docs/modules/lib/mod/README.md`. Start `docs/modules/lib/core/sandbox/README.md` (D22) with the content hosts, the D6 policy table with the reason for `'unsafe-eval'`, and the D7 directive-to-category table with the report messages. Verify that the tables match `buildSandboxPolicy` and `describeBlockedRequest` by comparing them with the policy and report strings the 3.1 tests expect.

## 4. Storage slots, messages and run links (design D10, D12, D14)

- [ ] 4.1 Write `src/lib/core/storage/mod_storage.test.ts` with a `Map`-backed `ModStorage`: store and read, missing key gives `null`, storing `null` removes the key, same key under two mod sources kept apart (the "Same name, different sources" scenario), and keys made of `:` parts do not collide. Then implement `src/lib/core/storage/mod_storage.ts` and `index.ts` following D12. Verify that the test passes and that `npm run lint` is clean.
- [ ] 4.2 Write `src/lib/core/engine/mod_messages.test.ts` for `readModMessage` and the builders: a request, a notification, a request with `params` that are not a mapping, `{ "id": 4, "method": 12 }` read as an invalid request with id 4, data without an `id` ignored, `toString` and `__proto__` not found in a handler table, the seven error code values, and the exact response and notification shapes from the "Messages follow JSON-RPC 2.0" scenarios. Then implement `src/lib/core/engine/mod_messages.ts` following D10. Verify that the test passes and that `npm run lint` is clean.
- [ ] 4.3 Write `src/lib/core/engine/run_links.test.ts` for `readAppRoute` and `buildRunLink`: a run link with `mod` and `collection`, with `mod` only, with extra params (link order, first value of a repeated key), with encoded values, with an empty `mod` or `collection`; `""`, `#/`, `#/mods/view` and `#/run` without `mod` giving home; and `readAppRoute(buildRunLink(link))` giving the link back. Then implement `src/lib/core/engine/run_links.ts` following D14. Verify that the test passes and that `npm run lint` is clean.
- [ ] 4.4 Start `docs/modules/lib/core/engine/README.md` (D22) with the protocol: message shapes, methods, the `tiles.changed` event, error codes and the reserved `sandbox.*` messages, a "Storage slots" entry and a "Run links" entry. Verify that every method, event, code and link form it lists has a test in 4.1 to 4.3.

## 5. Default mod settings, inspection, launch and session (design D11, D13)

- [ ] 5.1 Write `src/lib/core/engine/default_mod_settings.test.ts`: the folder resolved against the app's address with a trailing `/`, switched-off names resolved to sources, and `findSwitchedOffMod` finding `mod_viewer` from its name, its folder and its file URL, and `null` for another mod. Then implement `src/lib/core/engine/engine_errors.ts` (`ModSwitchedOffError`, with the error checks of 2.1) and `src/lib/core/engine/default_mod_settings.ts` following D13. Verify that the tests pass and that `npm run lint` is clean.
- [ ] 5.2 Write `src/lib/core/engine/mod_inspection.test.ts` and `src/lib/core/engine/mod_launch.test.ts` with the samples served by `fetchSample` at `https://example.org/samples/`:
  - "Inspect the sample mod": source, title, `sampleCollection` and the granted `show`, without requesting `main.js`; "Inspect a missing mod" propagating the fetch error; a structured clone of the inspection deep-equals it.
  - The "Sample mount context" scenario with `appOrigin` `https://example.org`: three tiles with `types` `["book"]`, no issues, the `show` permission granted, and one content host.
  - The "Foreign mod sees its denied permissions" scenario with `appOrigin` `https://other.example`, plus one launch permission issue.
  - "Link parameters": `params` copied from the link.
  - "Mod opened without a collection": no tiles, no issues, no collection request, and no `collectionSource`.
  - "Tile of another type is left out", using an inline collection with a fourth tile without `country`.
  - "Mod without a tile type".
  - A switched-off mod raises `ModSwitchedOffError` before any request.
  - The policy inside `sandboxDocument` names `https://upload.wikimedia.org` only when granted.
  - A structured clone of the context deep-equals it.
  - `loadModTiles` called again gives the same tiles.
  - Load errors from the mod file, the type file and the collection propagate with their classes.

  Verify that the tests fail before 5.3.
- [ ] 5.3 Implement `src/lib/core/engine/mod_inspection.ts` (`ModInspection`, `inspectMod`) and `src/lib/core/engine/mod_launch.ts` (`ModContext`, `ModLaunch`, `ModLaunchRequest`, `ModTiles`, `prepareModLaunch`, `loadModTiles`) following D13, using only the public entry points of `src/lib/mod`, `src/lib/core/sandbox` and `src/lib/tile`. Verify that both test files pass and that `npm run lint` is clean.
- [ ] 5.4 Write `src/lib/core/engine/mod_session.test.ts` with a fake frame target that keeps the transferred `port2` and plays the mod over Node's `MessageChannel`:
  - the `sandbox.connect` message, carrying the code and the context;
  - `storage.get` and `storage.set` round trips, and storing `null`;
  - each error from the "Request errors" requirement, the `Date` value, and a storage that throws (answered with `-32000`);
  - `mods.inspect`: the sample result for a mod with `open` on the app's origin, `-32001` for a missing mod, `-32002` without the grant and with a foreign mod's denied grant (with no request made), `-32003` for a switched-off mod (with no request made), and `-32602` for a missing `mod`;
  - `mods.open`: a run link passed to the `onOpenLink` spy and answered with `null`, `-32602` for a link that is not a run link, `-32002` when `onOpenLink` returns `false` or the grant is missing, and `-32003` for a switched-off mod;
  - one response per request with the same id;
  - `pushTilesChanged` sending a notification without id;
  - `sandbox.blocked` turned into one `onIssue` call through `describeBlockedRequest`, with a repeat not reported again;
  - `sandbox.mountFailed` turned into an error issue;
  - after `stopModSession`, no response (also for a pending `mods.inspect`) and no push.

  Verify that the tests fail before 5.5.
- [ ] 5.5 Implement `src/lib/core/engine/mod_session.ts` (`ModSession`, `ModSessionOptions`, `connectModSession`, `pushTilesChanged`, `stopModSession`) following D11, with the port handler bound to the session, async handlers, the checks before any fetch, and `isPlainData` split into named functions. Export the engine API from `src/lib/core/engine/index.ts` with a pinned export list test. Verify that every `src/lib/core` test passes and that `npm run lint` and `npm run build` succeed.
- [ ] 5.6 Add to `docs/modules/lib/core/engine/README.md`: the mount context, how tiles are validated and filtered, default mod settings, inspecting and opening mods with the `open` rules, the launch, and the session lifecycle. Each entry gets an example that matches the exported signatures. Verify the examples against `src/lib/core/engine/index.ts`.

## 6. Stage (design D15, D16)

- [ ] 6.1 Write `src/lib/core/stage/stage_state.test.ts` with plain data:
  - `openStageEntry`: ids counting from `sandbox-1`, the new sandbox visible, the opener recorded;
  - "New link after going back": forward entries dropped and their sandboxes in `closedIds`, but not a sandbox that an earlier entry still points to;
  - `restoreStageEntry`: an open sandbox shown again; a closed or unknown entry getting a new sandbox, with forward entries kept;
  - `closeStageSandbox`: "Close the viewer" (the opener shown), "Close a mod opened from a link" (a new home sandbox), and closing a hidden sandbox.

  Then implement `src/lib/core/stage/stage_state.ts` following D15. Verify that the test passes and that `npm run lint` is clean.
- [ ] 6.2 Write `src/lib/core/stage/stage_controller.test.ts` with a fake history and fake frame targets, the samples served by `fetchSample`, and an in-memory `ModStorage`:
  - first load with no hash: the home mod launched for `#/` at position `0`, written with `replaceState`;
  - a run link followed (no state): a new sandbox, `replaceState` with the next position;
  - `mods.open` from the visible sandbox: `pushState` with the built link and the opener recorded; from a hidden sandbox: refused and no history change;
  - back and forward with `popstate` states: the open sandbox shown, the same session kept;
  - an entry whose sandbox was closed, and a state from before a reload: a new sandbox;
  - close: the session stopped, `replaceState` with the shown sandbox's hash;
  - a launch failure, and a switched-off mod: `failed` with the error message and no frame;
  - `frameLoadedAgain`: `stopped`, frame removed, issue reported;
  - `reloadTiles`: `tiles.changed` pushed and the collection issues replaced;
  - a launch settling after its sandbox was closed: ignored;
  - every change notifying subscribers with a new frozen snapshot.

  Verify that the tests fail before 6.3.
- [ ] 6.3 Implement `src/lib/core/stage/stage_controller.ts` following D16, with the session callbacks bound to the stage and the sandbox id, and `src/lib/core/stage/index.ts` with a pinned export list test. Verify that every `src/lib/core/stage` test passes and that `npm run lint` and `npm run build` succeed.
- [ ] 6.4 Write `docs/modules/lib/core/stage/README.md` (D22): sandboxes and their ids, the visible sandbox, history entries and positions, opening after going back, closing, and how `main.tsx` wires the stage to the page. Verify that the examples match `src/lib/core/stage/index.ts`.

## 7. Rendering the stage (design D17, D20)

- [ ] 7.1 Add `src/main/default_mods.ts` (D20). Write `src/main/stage/StageView.test.tsx` and extend `src/App.test.tsx` (jsdom) with a stage on a fake history and fake fetches: the `OpenTesela` heading kept; one wrapper per sandbox in creation order, only the visible one without `hidden`; × absent for the home mod at `#/` and present otherwise; "Reload tiles" only with a collection; a `failed` sandbox showing its error and no frame; the issue list order and "no issues" text. Verify that the tests fail before 7.2.
- [ ] 7.2 Implement `src/main/stage/IssueList.tsx`, `SandboxFrame.tsx`, `StageBar.tsx` and `StageView.tsx` following D17, render `StageView` from `src/App.tsx`, and build the stage in `src/main.tsx` with the `popstate` listener. Verify that the 7.1 tests and `npm test` pass and that `npm run lint` and `npm run build` succeed.

## 8. Default mods and the browser (design D9, D17, D19, D20, D21)

- [ ] 8.1 Add `public/default_mods/mod_explorer/` and `public/default_mods/mod_viewer/` (`mod_conf.yaml`, `main.js`) as in D20, following the code conventions. Verify that `npm run lint` and `npm run format:check` are clean, and that `loadMod` reads both from `public/` in a unit test with `fetchSample`-style reading.
- [ ] 8.2 Add the Playwright helper `e2e/mod_routes.ts`, following D21:
  - `routeCovers(page)` answers `https://upload.wikimedia.org/**` with a 1×1 PNG and records the URLs it saw.
  - `serveForeignMod(page, files)` serves inline files under `https://mods.example.net/` with `Access-Control-Allow-Origin: *`.
  - `serveAppOriginMod(page, files)` serves inline files under `/test-mods/` on the preview origin.
  - A probe mod source sets `globalThis.probe = { engine, context }`.
  - `markFrame(frame)` and `isFrameMarked(frame)` for "the frame was not reloaded".

  Then write the failing tests:
  - `e2e/mod_stage.spec.ts`: every scenario of `specs/mod-stage/spec.md` except "Link to a switched-off viewer" (unit tested in 5.4 and 6.2). "Reload after the collection changed" re-routes the collection to two books. Back, forward and reload use `page.goBack`, `page.goForward` and `page.reload`.
  - `e2e/mod_sandbox.spec.ts`: every scenario of `specs/mod-sandbox/spec.md`. Blocks are checked as "the route never saw the URL" plus the issue in the list, "Entrypoint requested by the app" through `request.frame()`, and "Mod opened by another mod" through the frame tree.
  - `e2e/mod_engine_api.spec.ts`: the frame-side scenarios of `specs/mod-engine-api/spec.md` through `frame.evaluate` on the probe: window messages ignored, request resolve and reject, several handlers, value kept after a reload, link parameters, "Explorer opens the viewer", "Hidden mod tries to open a mod", and "Mod without the open permission" with no request to `https://mods.example.net`.
  - `e2e/default_mods.spec.ts`: every scenario of `specs/default-mods/spec.md` except "Replaced viewer" and the switched-off case, which are covered by unit tests (2.4, 5.1). "Mod that cannot be inspected" serves an explorer copy with a broken entry under `/test-mods/`.

  Verify that the tests fail where the behavior is not built yet, and pass for what groups 1 to 7 built.
- [ ] 8.3 Fix what the 8.2 tests show, in the default mods, the stage or the bootstrap, and verify that `npm test`, `npm run lint`, `npm run build` and `npm run test:e2e` succeed. Also open `npm run dev` with no hash and check that the flow works in dev mode (StrictMode): explorer, viewer, run with sample tiles (three books, no duplicate issues), back to the viewer with its state, ×, and selection kept after a reload.
- [ ] 8.4 Finish the docs (D22): in `docs/modules/lib/core/sandbox/README.md`, the sandbox frame, the bootstrap steps and messages. In `docs/modules/lib/core/engine/README.md`, the `mount(engine, context)` entry point with the sample mod as a short example, and "Open a mod" with run link examples. Write `docs/modules/mods/explorer/README.md` and `docs/modules/mods/viewer/README.md`, and add the default mods paragraph to `docs/modules/README.md`. Add the embedding hosting note to the sandbox and engine READMEs. Verify that the documented links open in `npm run preview` and that the example code matches `public/samples/mods/book_list/main.js`.

## 9. Integration check

- [ ] 9.1 On a clean install (`npm ci`), run `npm run build`, `npm test`, `npm run lint`, `npm run format:check` and `npm run test:e2e`. Verify that all five succeed and that each scenario in the five spec files has a test named after it. Verify that the tile module's test cases are unchanged apart from the sample path in 1.1 and the export list in 2.3. Verify that `git status` shows only the files listed in the proposal's Impact section and this change's folder.
- [ ] 9.2 Manually open `npm run preview` in Firefox and, if available, in Safari or Playwright WebKit (design, Risks). Check that the explorer, the viewer and the sample mod work with their covers, that back, forward and reload behave as in `specs/mod-stage`, and that reading `localStorage` in a frame's console throws. If the `blob:` module import fails there, record the result in design.md and apply the `data:` fallback described in Risks before archiving.

## Workflow follow-up

- Archive this change once reviewed, so that `mod-loading`, `mod-sandbox`, `mod-engine-api`, `mod-stage` and `default-mods` become main specs.
- Next changes, in the order the exploration suggested:
  - the permission prompt (Allow / Run without / Cancel) with remembered choices;
  - init options: the default mods folder, the home mod, switched-off default mods, a site-owner allow list, and granting permissions to a default mods folder on another origin;
  - the other default mods: `mod_maker`, `tile_explorer`, `tile_viewer`, `tile_maker`, `mosaic_explorer`, `mosaic_viewer`, `mosaic_maker`;
  - running a mod with an already loaded collection, and tiles or mods from a local folder, with an `assetUrl` helper;
  - a list and a limit of open sandboxes;
  - mosaic files (config overrides and aliases);
  - inline `schema` in `mod_conf.yaml`;
  - routing links in mods to new tabs.
