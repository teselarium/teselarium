# Proposal

## Why

A run link takes a relative collection: `#/run?mod=…&collection=./samples/tiles/literature_nobel_laureates_books/collection.yaml` resolves the collection against the app's address and runs. The mod viewer's collection field, which builds the same run link through `mods.open`, does not: "Run with this collection" with `./samples/tiles/literature_nobel_laureates_books/collection.yaml` or `samples/tiles/literature_nobel_laureates_books/collection.yaml` marks the field invalid and shows `"…" is not a full address.`, and "Check mod" with the same text silently checks the mod with its sample collection instead. The collections a user is most likely to type are the app's own, and typing the app's address in front of each one is the only way to run them from the viewer today.

## What Changes

- **Relative addresses in the collection field**: "Run with this collection" sends `mods.open` with the typed text as `collection`, trimmed, whatever its form: a full address, a path starting with `./`, `../` or `/`, or a bare path such as `samples/tiles/…/collection.yaml`. The engine resolves it against the app's address, as it does for a run link's `collection` today, so the opened run link and the mod's tiles are the same as when the user types that link.
- **"Check mod" follows the same rule**: it sends the typed text as `collection` whenever the field is not empty, so a relative collection is checked instead of being dropped for the sample collection.
- **No invalid field**: with every non-empty text accepted, the field is never marked invalid and the "is not a full address" alert is removed. A collection that cannot be loaded is reported where it is today: by the opened mod's sandbox, or as a finding of the check report. An empty field still runs nothing, and the check still uses the sample collection.
- **Relative to the app, not the mod**: a relative path is resolved against the app's address, never against the viewed mod's file, so the same text means the same collection in the viewer and in a run link.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `default-mods`: the requirements "Mod viewer runs the mod" and "Mod viewer checks the mod" say that the typed collection is sent as typed and resolved against the app's address, with scenarios for a relative collection address. The engine side needs no spec change: `mod-engine-api` already opens `mods.open` "as if the user had followed its run link", and `mod-check` already resolves `mods.check` locations against the app's address.

## Impact

- **Code**: `public/default_mods/mod_viewer/main.js` only (`runWithTypedCollection`, `readCheckCollection`, the collection field). No engine, stage or loader code changes.
- **Tests**: e2e tests in `e2e/default_mods.spec.ts` for running and checking with a relative collection address. The existing "Run with a typed collection" test, which types a full address, stays as it is.
- **Docs**: `docs/modules/mods/viewer/README.md` (the collection field, "Check mod" and the invalid field example), and the viewer's header comment, which names `aria-invalid` as one of its examples of semantic HTML.
- **Mod API version**: no bump. The change is in a default mod's behavior; the engine methods, events, mount context, mod file format and test API do not change.
- **App version**: patch bump, a fix.
- **Out of scope**: resolving relative paths against the viewed mod's file; relative paths in tile metadata (`resolve-relative-tile-paths`); the mod explorer, which has no collection field.
