# Tasks

## 1. Setup

- [x] 1.1 Record the current results of `npm run test:e2e -- e2e/default_mods.spec.ts`: the number of passing and failing tests in each browser, and the names of any failing ones, for the check in 3.1. A failure that exists before this change is not this change's to fix: note it apart

## 2. Relative collections in the mod viewer

- [x] 2.1 Write the failing tests first in `e2e/default_mods.spec.ts`, next to "Run with a typed collection" and in the "Check mod" tests, for the scenarios of the `default-mods` delta, as design.md describes them: "Run with a relative collection address" (`./test-mods/two_books.yaml`: the opened link's `collection` parameter is that text, the two books are listed, and the viewer shows no `role="alert"`), "Run with a bare relative path" (`test-mods/two_books.yaml`: the two books are listed) and "Check with a relative collection address" (`./test-mods/missing.yaml` served as HTTP 404: the report shows an error finding naming the app's address followed by `test-mods/missing.yaml` and `404`, and no request reaches the sample collection). Serve the files with `serveAppOriginMod`. Verify the three tests fail in Chromium for the reasons this change fixes: the "is not a full address" alert for the runs, and a report without that finding for the check
- [x] 2.2 In `public/default_mods/mod_viewer/main.js`, read the collection field with one function used by both `runWithTypedCollection` and `checkMod`: the value without surrounding spaces, or `null` when that is empty. Remove the `URL.canParse` checks, the "is not a full address" alert, `aria-invalid` and `clearInvalidField`. Make the field `type="text"` with `inputmode="url"` and the placeholder `./collection.yaml or https://example.org/collection.yaml`, keeping its label "Collection address". Remove `aria-invalid` from the examples in the file's header comment. Verify the tests of 2.1 and every existing test in `e2e/default_mods.spec.ts` pass in all three browsers, and that `grep -n "canParse\|aria-invalid\|full address" public/default_mods/mod_viewer/main.js` matches nothing
- [x] 2.3 Update `docs/modules/mods/viewer/README.md`: the collection field sends the typed address as typed, a full address or a relative path resolved against the app's address, as in a run link's `collection`, and is never marked invalid; "Check mod" sends the field's value whenever it is not empty, under the same rule; and remove the `aria-invalid` example from the list of semantic HTML. Verify each statement matches a scenario of the `default-mods` delta, and that `grep -n "full address\|full URL\|aria-invalid" docs/modules/mods/viewer/README.md` matches nothing

## 3. Integration check

- [x] 3.1 Run `npm run lint`, `npm run format:check`, `npm test`, `npm run build` and `npm run test:e2e`, and verify all pass, with the e2e counts of 1.1 plus only the three tests of 2.1 in each browser. Run `openspec validate allow-relative-viewer-collection --strict` and verify it reports the change as valid
- [x] 3.2 Add `.changeset/allow-relative-viewer-collection.md` with a `patch` bump, following the "Bump rule" section of `docs/releasing.md`: a fix, with no mod API bump. Summary: "The mod viewer runs and checks mods with a relative collection path such as `./samples/tiles/…/collection.yaml`, resolved against the app's address as in a run link." Verify `npx changeset status` lists the change as a patch

## Workflow follow-up

- Archive the change with `/opsx:archive` once it has been reviewed, syncing the `default-mods` delta into the main spec.
