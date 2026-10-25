# Design

## Context

See proposal.md - Why. The current state that shapes the approach, as `add-mod-check` left it:

- `runStageCheck` in `src/lib/core/stage/stage_checks.ts` runs the bundle check (`checkModBundle`), builds the launch with `buildModLaunch`, and adds a `StageCheck` to `stage.checks`. The page renders one hidden `CheckFrame` per entry of `snapshot.checks`. The frame's first `load` calls `attachCheckFrame`, which connects a session with a `createMemoryStorage()` slot and the check's own `onIssue`, `onOpenLink`, `onRequestAction`, `onCheckMod`, `onMounted` and `onErrorResponse`, and starts the 10-second limit. `sandbox.mounted` starts the 1-second settle time, after which `endStageCheck` stops the session, removes the entry and resolves the report.
- The frame loader (`sandbox_loader.js`) is inlined as a module script in the frame document by `buildSandboxDocument(policy, theme)`. On `sandbox.connect` it imports `params.code` from a blob URL and mounts it at once. Its state is module-scoped, so the mod's code cannot reach it, but the mod can patch `MessagePort.prototype.postMessage` and send loader notifications of its own.
- The session ignores notifications it does not know. It calls `onRequestAction` and `onOpenLink` only after the handler has read and checked the params: `links.open` its URL, `mods.open` its reference and the `open` grant.
- `buildModLaunch` builds the policy, but `ModLaunch` keeps only the finished `sandboxDocument`.
- `buildModCheckReport(source, findings, mountChecked)` builds the report. `ModCheckStep` is `"bundle" | "mount"`.
- `loadModFile` reads the mod file without fetching anything else, and `loadModCode` fetches the entrypoint. `MOD_FILE_KEYS` lists the mod file keys the surface guard records.

## Goals / Non-Goals

**Goals:**
- A case runs the mod exactly as the mount check does: the same frame document, policy, permissions, mount context and engine handlers. Only the requests that need the user are answered differently.
- Running mods' frames do not carry the test API.
- The parts of the test API that are pure logic (the matchers, deep equality, `waitFor`) are tested by Vitest. e2e tests cover what needs a browser: the test file running in a frame, the case context and the sample's tests.

**Non-Goals:**
- Running cases in parallel. Cases run one after another (see Decisions).
- `theme.changed` and `tiles.changed` in case frames, as in the mount check's frame.
- Protecting the report from the mod. A mod can always make its own tests pass, so a case frame's notifications are trusted as the mount check's are.
- Recording the test API in the surface guard (see proposal.md - Impact).

## Decisions

### The test file is fetched after the mount check

`src/lib/mod/` reads `test_path` like the other optional keys (`readModFormat`, with the message `test_path must be a non-empty string`), adds `"test_path"` to `MOD_FILE_KEYS`, and resolves it into `ModFile.testSource`, so `LoadedMod` and the inspection have it. A sibling of `loadModCode`, `loadModTestCode(mod, options)`, fetches it and raises `FileFetchError` with the test file as its source.

When the mount check ends, `stage_checks.ts` no longer resolves the report right away. When the mod has a `testSource`, the mount check found no error, and the requester still runs, the check fetches the test code and moves on to the tests. A load error becomes a `test` error with the error's source and message, and the report resolves with `testsChecked` `false`. The bundle check does not change.

*Alternative:* fetching the test file in the bundle check. Rejected by the user: a missing test file would then skip the mount check.

### One check, one frame at a time

A `StageCheck` gets a `phase` (`"mount"`, `"list"` or `"case"`) and a `frame`: the frame running now, or `null` while the test file is fetched. A frame has a `key` that changes for each new frame, and its own document, session and limit timer. `CheckSnapshot` gets the frame's `key`. `StageView` keys `CheckFrame` by it, so React drops the old iframe and makes a new one for each case. That gives every case a fresh page without a new kind of frame in the page. `attachCheckFrame` and `checkFrameLoadedAgain` also take the key, so the late `load` of a frame that was already replaced is ignored. A check with no frame is left out of `snapshot.checks`.

The flow is:

1. **Mount**: the mount check, unchanged.
2. **List**: one frame imports the test file, calls its default export with `t`, and reports the case names, or why there are none. It does not import the entrypoint. A listing error is a `test` error, and no case runs.
3. **Case**: one frame per name, in order. Each imports the test file again, registers the cases, and runs the case with its name.

Cases run one after another. So the findings stay in a fixed order (each case's findings, then its failure), only one hidden frame runs at a time, and every case gets its whole 10 seconds.

*Alternatives:* (a) all cases in parallel. Rejected: findings would interleave, and a mod with many cases would start many frames at once. (b) listing in the first case's frame. Rejected: a listing error would come from a frame that also runs a case, and the first case would need a different flow from the others.

The case logic lives in a new `src/lib/core/stage/stage_check_cases.ts`: the session options of list and case frames, the answer queues, the case results and the `test` findings. `stage_checks.ts` keeps the check's lifecycle and calls it for each phase. The case limit, `CHECK_CASE_LIMIT_MS = 10000`, is a separate constant from the mount limit, since the two can change apart. The list frame gets the same limit, so a test file whose default export never settles is a `test` error and not a hung check.

### The test runner is a second script in case frames

`src/lib/core/sandbox/sandbox_test_runner.js` holds `t`, the case context and the request record. `src/lib/core/sandbox/sandbox_assertions.js` holds `expect`, deep equality of plain data, the value descriptions in failure messages, and `waitFor`. `buildSandboxDocument(policy, theme, { testRunner })` inlines the loader, then, for list and case frames, the assertions and the runner, all in the same module script, so they share its scope. The runner adds its two modes to a table in the loader (`frameModes`), next to the loader's own `mount` mode. `connectToEngine` picks the mode from the connect params, so the loader does not depend on the runner. `sandbox_assertions.js` exports its functions, so Vitest imports them directly. An inline module script may have exports, and nothing imports them.

`ModLaunch` gets `policy`, so the engine's new `buildModTestDocument(launch)` builds the runner's document from the same policy and theme as the mount check's.

*Alternative:* the whole test API in `sandbox_loader.js`. Rejected: every running mod's frame would carry code it never uses, and the loader would mix two jobs.

### The connect params say what the frame does

`SandboxConnectParams` gets an optional `test: { code, caseName }`. Without `test`, the loader mounts the mod, as today. With `caseName` `null`, the runner lists the cases. With a name, it runs that case. A name the test file no longer registers fails the case with a message that says so. The engine sends `test` through a new session option, `test`, which only checks pass.

### The runner reports through loader notifications

New loader notifications in `sandbox_messages.ts`, each with a reader that returns `null` for the wrong shape:

- `sandbox.testsListed { names }` and `sandbox.testsFailed { message }` from the list frame;
- `sandbox.answerQueued { method, value }` from `answer`;
- `sandbox.caseFinished { status, message }` when the case's function settles.

The session hands them to one new option, `onTestReport(report)`, with the report read as a union. Running sandboxes pass none, so a mod that sends them outside a check changes nothing. Like `sandbox.mounted`, they are the loader's protocol, not the mod API.

### Scripted answers are queued in the engine

`answer(method, value)` checks the method and the value's type in the frame, so a wrong answer throws in the case at once, and then sends `sandbox.answerQueued`. The case keeps one queue per method. The case's `onRequestAction` resolves with the next queued value of the action's method, or with `false`. Its `onOpenLink` returns `true` for a queued `mods.open` answer, so the handler answers `null` and nothing opens, and `false` otherwise (`-32002`). Its `onCheckMod` returns `null` (`-32002`). None of them adds a finding.

The notification and the mod's later request travel on the same port, so the queue is filled before the request is read. The handlers reach `onRequestAction` and `onOpenLink` without awaiting anything first, so the answers are used in the order the requests arrive.

*Alternative:* answering in the frame, without sending the request. Rejected: a queued answer would skip the engine's checks, so a `links.open` with a bad URL or a `mods.open` without the `open` grant would pass in the test and fail in the app.

### The case context in the frame

- `mount(options)` copies the mount context, replaces `tiles`, merges `config` and sets `params`, then imports the entrypoint and calls its default export with the engine object and that context, as the loader does. The engine object's `request` is wrapped so each request is recorded. A failing mount rejects `mount` and is not sent as `sandbox.mountFailed`, so it is not a finding. A second call rejects with `the mod is already mounted`. Options of the wrong shape reject with a message that names the option.
- `requests` is an array the runner fills: an entry `{ method, params }` when the mod sends a request, which gets its `result` or `error` (`{ code, message }`) when the request settles.
- `storage.get` and `storage.set` send `storage.get` and `storage.set` to the engine on the frame's port, without recording them, so the engine's rules apply.
- `waitFor(fn, timeout = 2000)` calls `fn` every 50 milliseconds.
- `root` is `document.body`, and `tiles` is the context's tiles.

### What the case session records

The case's `onIssue` and `onErrorResponse` add `test` findings like the mount check's `mount` findings, with the same level, source and message text, prefixed with `In the test "<name>": `. The session sends no mount failure for a case, so none needs to be filtered out. A case that fails, does not finish within 10 seconds (`The test did not finish within 10 seconds.`), or whose frame loads again (the stage's message for a mod that left its page) gets its `{ name, status, message }` result. A failed case also gets a `test` error, `The test "<name>" failed: <message>`, with the test file as its source.

### The report

`ModCheckStep` gets `"test"`. `mod_check_report.ts` gets `ModTestResult` (`name`, `status`, `message`), and `buildModCheckReport` takes the results as a fourth argument, `ModTestResult[] | null`. `null` gives `testsChecked` `false` and an empty `tests`. The status is still read from the findings alone, which already hold every failed case.

### The mod viewer

The report section gets a "Tests" list after the status badge, before the findings, with one item per case: a `success` or `destructive` badge, the name and, for a failed case, the message. It is built with the viewer's existing `buildBadge` and list builders, with no new styles. Without tests, the list is left out.

### The sample's tests

`public/samples/mods/book_list/test.js` follows the code conventions, since mod authors will copy it: named functions, explicit loops, no anonymous callbacks.

```js
async function listsTheSampleBooks(context) {
  await context.mount();
  context.expect(context.root.querySelectorAll("li").length).toBe(3);
}

async function highlightsTheRememberedBook(context) {
  await context.storage.set("selected", context.tiles[1].source);
  await context.mount();
  const pressed = context.root.querySelector('button[aria-pressed="true"]');
  context.expect(pressed.textContent).toContain("Kallocain");
}

export default function registerBookListTests(t) {
  t.test("lists the sample books", listsTheSampleBooks);
  t.test("highlights the remembered book", highlightsTheRememberedBook);
}
```

### Tests mirror the specs

Unit tests:
- `mod_format.test.ts`, `mod_loader.test.ts` and `mod_inspection.test.ts` for `test_path` and `testSource`;
- `mod_check_report.test.ts` for `tests` and `testsChecked`;
- `sandbox_messages.test.ts` for the new readers, and `mod_session.test.ts` for `onTestReport` and the `test` connect params;
- `sandbox_assertions.test.ts` for the matchers, `not`, deep equality, the failure messages and `waitFor` with fake timers;
- `stage_checks.test.ts` and `stage_check_cases.test.ts` for the flow, with a fake frame that plays the runner: listing, case results, queued answers, findings, limits, a frame that loads again, and a requester that closes.

e2e tests in `e2e/mod_tests.spec.ts`, with one `describe` per requirement of `mod-tests`, run real test files served by `e2e/mod_routes.ts`. One of them pins the test API's names: a probe test file reports the keys of `t`, of the case context and of `expect(value)`. The viewer's case list goes into `e2e/default_mods.spec.ts`, under "Mod viewer shows the check report".

## Risks / Trade-offs

- [A mod with many cases makes a long check: up to 10 seconds per case, one after another] → The viewer says that the check runs, and closing the requester ends it. A cap on the number of cases can come later without changing the specs.
- [A test file that registers other cases in a later frame, for example from `Math.random`] → The case whose name is missing fails with a message that says the test file did not register it again.
- [A case's own misuse of `storage` is a `test` finding as well as a failure] → The finding names the case, so the report still points at the test, not at the mod.
- [The mod can fake runner notifications] → It can only change its own report, which it could already do through its tests. The notifications grant nothing, and running sandboxes ignore them.
- [`waitFor` polls] → 50 milliseconds keeps a case responsive without a busy loop, and the 2-second default is far below the case limit.
- [The test file has the mod's permissions and policy] → It is the author's code, trusted like the entrypoint, and it runs only during a check, in a throwaway slot.

## Migration Plan

None. Mods without `test_path` are checked as before. `MOD_API_VERSION` becomes `0.1.2`. That is a patch bump, so the `^0.1.0` ranges still match.
