# Design

## Context

See proposal.md - Why. The current state that shapes the approach:

- `public/default_mods/mod_viewer/main.js` reads the collection field in two places. `runWithTypedCollection` ("Run with this collection" and Enter) rejects text that `URL.canParse` refuses, sets `aria-invalid="true"` on the field and shows `"…" is not a full address.`. `readCheckCollection` ("Check mod") returns `null` for the same text, so the check falls back to the sample collection without saying so. An `input` listener (`clearInvalidField`) removes `aria-invalid` again.
- The field is `<input type="url">` with the placeholder `https://example.org/collection.yaml`. A relative path is a type mismatch for a URL input, so the browser counts the field as `:invalid`, and Firefox can mark it as invalid by itself.
- The engine already takes relative collections. `mods.open` validates `collection` only as a non-empty string and puts it in the run link unchanged (`readOpenParams` in `src/lib/core/engine/mods_methods.ts`). Launching the link loads it with `fetchFile`, which resolves a location against `document.baseURI`, the app's address. `mods.check` resolves it the same way, as `mod-check` specifies.
- The theme styles every text-like `input` alike (`input:not([type="checkbox"], [type="radio"], [type="range"])` in `base_stylesheet.css`), so the field's `type` does not change its look.

## Goals / Non-Goals

**Goals:**
- The viewer sends what the user typed, and only the engine resolves it, so the viewer and a run link can never disagree on what a relative path means.

**Non-Goals:**
- Any change to the engine, the stage, the run link format or the loaders.
- Checking in the viewer that the collection exists before sending it. A missing collection keeps its current report: the opened sandbox's load error, or the check report's finding.

## Decisions

### Send the typed text unchanged, trimmed

Both buttons read the field the same way: the value without surrounding spaces, or nothing when that is empty. One function, used by "Run with this collection" and by "Check mod", replaces `URL.canParse` in both, so the two buttons cannot drift apart again, as they did when the check silently used the sample collection.

*Alternative:* resolve the text in the viewer with `new URL(text, …)` and send a full address. Rejected: the viewer has no reliable base of its own (its document is built in memory, in an opaque-origin frame), and the run link would then hold the full address instead of what the user typed, unlike a link the user writes by hand.

### Relative to the app's address, not the viewed mod

A relative path means what it means in a run link: resolved against the app's address. `./book_collection.yaml` does not find a collection next to the viewed mod. The sample collection, the only collection a mod declares, is already offered by "Run with sample tiles".

*Alternative:* resolve against the viewed mod's source. Rejected: the same text would open another collection in the viewer than in the address bar, and the engine would need a second base for `collection`.

### A text field that is never invalid

The field becomes `<input type="text" inputmode="url">`: `inputmode` keeps the URL keyboard on touch devices, and `type="text"` stops the browser from treating a relative path as invalid. `aria-invalid`, its `input` listener and the "is not a full address" alert are removed, since no non-empty text is rejected any more. The placeholder names both forms: `./collection.yaml or https://example.org/collection.yaml`. The field keeps its label "Collection address", so its accessible role and name stay those the e2e tests use.

The viewer's header comment lists `aria-invalid` among the semantic HTML it shows; that example goes, and the theme docs keep their own `aria-invalid` example.

*Alternative:* keep `type="url"` and ignore its validity. Rejected: the field would still look invalid in some browsers for a value the viewer accepts.

### E2E coverage

In `e2e/default_mods.spec.ts`, next to "Run with a typed collection", which keeps typing a full address:
- "Run with a relative collection address" types `./test-mods/two_books.yaml`, checks the opened link's `collection` parameter and the two books, and that the viewer shows no alert;
- "Run with a bare relative path" types `test-mods/two_books.yaml` and checks the two books;
- "Check with a relative collection address" types `./test-mods/missing.yaml`, served as 404, and checks the report's error finding names the resolved address and `404`, and that the sample collection was not requested.

The collection is served with `serveAppOriginMod`, as the existing test does, so the app's address is the e2e server's, and the scenarios' `https://example.org/` stands for it.

## Risks / Trade-offs

- [A typo is no longer caught before running] → Before, only text that could not parse as a URL was caught, not a wrong address. Now every wrong address is reported the same way, by the opened sandbox's load error naming the resolved address.
- [A path starting with `/` resolves against the origin's root, not the app's folder, when the app is served from a subfolder] → This is how a run link's `collection` resolves today. The README says that relative paths are resolved against the app's address, and `./` keeps a path inside the app's folder.
