# Design

## Context

See proposal.md for why. The relevant current state:

- The instantiation's settings are TypeScript constants in `src/main/`: `DEFAULT_MODS` (`default_mods.ts`) and the section registry (`sections/vanilla_sections.ts`). `src/main.tsx` checks the registry before anything starts and shows `RegistryErrorScreen` when it breaks a rule. Then it passes the settings to `createStage`, which resolves them (`resolveDefaultModSettings`) and hands them down: `Stage` → `SandboxServices` / `CheckServices` → `ModSessionOptions` → `ModMethodContext`.
- Engine requests are tables of handlers per namespace (`*_methods.ts`) merged into `ENGINE_METHODS`. Events pushed from the app, like `theme.changed`, follow a stage-level change (`changeStage…`) that walks the running sessions.
- "Load media linked by tiles" is the model for a remembered app switch: `src/main/settings/tile_media_setting.ts` stores it under an `opentesela.*` key, gives the stage its start value, and calls `changeStageTileLinkedMedia` on change.
- In a check's case frames, `answer(method, value)` is checked in `sandbox_test_runner.js` (`ANSWER_KINDS`). It reaches the stage as `sandbox.answerQueued` (`AnswerMethod`, value `boolean | null`) and is queued in `stage_check_cases.ts`.
- Each default mod is standalone: its build forbids imports outside its folder, so the three explorers cannot share code.

## Goals / Non-Goals

**Goals:**
- One catalog value, resolved and checked once at start, that the engine answers from and the next change (`rework-stage-bar`) can read app-side without a mod.
- The explorers keep their look and their viewer config. Only where their entries come from changes.

**Non-Goals:**
- No catalog file fetched at runtime and no user-edited catalog: the catalog is an instantiation constant, like the registry.
- No caching of inspections or of the default-mosaic lookups across requests.
- No app-side UI reads the catalog in this change. The stage bar dropdowns, "recently used" and compatibility counts belong to `rework-stage-bar`.

## Decisions

### The catalog is an instantiation constant, checked like the registry

`src/main/app_catalog.ts` exports `APP_CATALOG: AppCatalog`, `{ mods: string[]; collections: string[]; mosaics: string[] }`. The type and the resolver live in the engine (`src/lib/core/engine/app_catalog.ts`), next to `default_mod_settings.ts`. `resolveAppCatalog(catalog, baseUrl, defaults)` returns `{ catalog: ResolvedAppCatalog; errors: string[] }`:

- each kind is resolved with its own resolver: `resolveModReference`, `resolveCollectionReference`, `resolveMosaicReference`;
- `findSwitchedOffMod` drops switched-off default mods;
- the result's sources are compared per list to find repeats.

`main.tsx` runs it next to `validateRegistry`. Any error stops the start. `RegistryErrorScreen` becomes `StartErrorScreen`, which lists the registry's and the catalog's errors, each under its own title. `createStage` then takes the resolved catalog.

*Alternatives:* a YAML catalog file fetched at start makes the start async and adds a file format to spec. Dropping repeats silently, instead of stopping the start, hides an instantiation mistake, and the registry already sets the loud precedent.

### One listing builder, used by the request, the push and later the stage bar

`buildCatalogListing(catalog, includesDefaultMosaics, fetchOptions): Promise<CatalogListing>` lives in the engine and returns the `catalog.list` shape. With the switch off it is synchronous data wrapped in a promise and fetches nothing. With it on, it loads each catalog mod's file with the mod loader, without the entrypoint (as `mods.inspect` does), in parallel. It keeps the results in catalog order, skips mods that fail or declare no `default_mosaic`, and dedupes by source against the catalog's mosaics and earlier defaults.

`ModMethodContext` gets `readCatalog: () => Promise<CatalogListing>`, provided by the stage through the services. `catalog_methods.ts` (`CATALOG_METHODS`, `"catalog.list"`) just returns it. A check's sessions get the same reader, so an unanswered `catalog.list` in a case or the mount check gives the app's catalog.

*Alternatives:* putting the listing in `ModMethodContext` as plain data would freeze it at session start, so the switch would not reach running mods. Caching the default-mosaic lookups would serve stale mod files to a mod author editing `default_mosaic`, the exact user of the switch.

### No permission for `catalog.list`

The addresses come from the instantiation, not from the mod, and are public, since the explorers show them anyway. The only fetches are the catalog's own mod files, so a mod cannot make the engine request a URL of its choosing. The explorers keep `open: "*"` for their inspections.

*Alternative:* requiring `open` would add nothing a mod could not already learn by inspecting, and it would make the stage bar's later use depend on a mod permission it never needs.

### The switch pushes `catalog.changed`, latest change wins

`changeStageCatalogDefaultMosaics(stage, isOn)` stores the flag on the stage. It builds the listing once and pushes `catalog.changed` with it to every running session, like `theme.changed` (`changeStageColorScheme` → `pushSandboxTheme` → `pushThemeChanged`), through a new `pushSandboxCatalog` and `pushCatalogChanged(session, listing)`. A generation counter on the stage drops a push whose listing finished after a newer change, so two quick toggles cannot leave mods on the older catalog. `src/main/settings/catalog_setting.ts` mirrors `tile_media_setting.ts`: key `opentesela.catalog-default-mosaics`, on only when the stored value is `true`.

*Alternative:* telling users to reopen the explorer fails because a section keeps one root sandbox (`app-sidebar`), so Mosaics would keep showing the old list.

### Scripted catalog answers carry plain data, not a boolean

`ANSWER_KINDS` gains a `"catalog"` kind. The runner's check normalizes the value (missing lists become `[]`, a missing `defaultOf` becomes `null`) and throws `the answer to catalog.list must be a catalog: …` naming the first bad key. `AnswerMethod` adds `"catalog.list"`, and the queued value's type widens from `boolean | null` to plain data (`YamlValue`). The stage's case queue then answers `catalog.list` with it before reaching `readCatalog`. Sources in a scripted catalog are kept as given, so fixture addresses like `./default_mods/…` work: the explorers pass them to `*.inspect`, which resolves them against the app's address.

### Explorers: same shape in each mod, duplicated on purpose

Each explorer replaces `read…Locations(config)` with a `read…Catalog(engine)` that sends `catalog.list` and takes its own list. It also registers `engine.on("catalog.changed", …)` to re-list with the event's params. The render takes entries `{ source, … }`. A failed inspection shows the source, now the resolved address. A list counter drops a re-list that a newer one overtook. The mosaic explorer draws the default-mosaic mark as a `<small>` under the `<h2>`, not a `<p>`, so the card's first `<p>` stays the description. The three copies are small, and the build rule that keeps mods standalone outweighs DRY here.

### e2e tests that list test-owned entries use a test-catalog build

Some e2e tests made an explorer list a test-owned mod or mosaic by rewriting the explorer's `config.mods` or `config.mosaics` in its served mod file. Those keys are now ignored, and the tests outside the sample specs must not need the shipped samples (`isolate-tests-from-samples`). They run against an instantiation built in the e2e mode `e2e-test-catalog`, which imports `src/test/registries/test_catalog.ts` in place of `src/main/app_catalog.ts`, as `e2e-home-mod` and `e2e-explorer-off` swap their modules. Its catalog lists the test-owned tiles mod and labels mosaic under `/test-mods/`, which each test serves as before. Tests that need another build too, such as a switched-off viewer, route the catalog's sample address to a test-owned file instead, as the collection explorer's tests already do.

*Alternatives:* moving the tests to the vanilla catalog and `@sample` breaks the sample isolation. Routing the vanilla catalog's sample addresses everywhere ties the tests to which entries the vanilla catalog holds. The cost of the chosen way is one more e2e build at the start of every run.

### Mod API surface

`MOD_API_VERSION` becomes `0.1.15`. The surface guard gets a `0.1.15` entry with the method `catalog.list` and the event `catalog.changed`. `default_mods/mod_api.d.ts` types the request, the event and `CatalogListing`, and `mod_api_types.test.ts` checks the engine's type against it. The engine README gets a `0.1.15` version note. Default mods keep `api: "^0.1.0"` (required by `mod-api-version`). They ship with the app, so they always run against a version that has the method.

## Risks / Trade-offs

- [Explorers now show resolved sources where they showed the reference as written] → Expected. The e2e and case expectations move to the resolved address, and the specs' scenarios say so.
- [With the switch on, each `catalog.list` fetches every catalog mod file] → Explorers ask once per mount and once per change, and the catalogs are small. Building the push's listing once serves all running mods.
- [An instantiation that customized the explorers' `mods`, `collections` or `mosaics` loses those lists silently, since the keys are ignored] → No instantiation API exists yet. The changeset states the move to `src/main/app_catalog.ts`.
- [A slow mod file delays the whole listing when the switch is on] → The fetches run in parallel and failures are skipped. A per-mod timeout is not added, the same as for `mods.inspect`.
- [The widened answer value type touches a boundary between the case frame and the stage] → The runner normalizes and checks the value before sending, and the stage checks the method again before queueing, as today.

## Migration Plan

None beyond the code. The vanilla explorers' config lists move into `APP_CATALOG` in the same change, so the vanilla app lists the same things. Rollback is a revert.
