# Design

## Context

Grants are decided in one function, `grantModPermissions(mod, appOrigin)` in `src/lib/core/permissions/mod_grants.ts`: every declared permission for a mod from the app's origin, none for any other. Three places call it:

- `buildModLaunch` in `src/lib/core/engine/mod_launch.ts`, which also builds the policy and the frame document from the grants. It runs on two paths: `prepareModLaunch` (used by `launchSandbox` in `src/lib/core/stage/stage_sandboxes.ts`) and the mount check in `src/lib/core/stage/stage_checks.ts`.
- `inspectMod` in `src/lib/core/engine/mod_inspection.ts`, for `mods.inspect`.

The policy is fixed once the frame's `srcdoc` is set, so grants must be final before the frame exists.

The stage already asks one question before a frame starts. `settleLaunch` puts a runtime whose mod was written for another mod API in the `asking` status, the snapshot carries `apiMismatch`, `StageView` renders `ApiMismatchDialog` (a `StageDialog`) for the visible sandbox, and `answerApiMismatch` starts or fails it. Today the launch, with its policy, is already built when the runtime asks.

App settings live in `src/main/settings/` as small stores over `localStorage` with keys outside `opentesela.mod-storage:` (`tile_media_setting.ts`). The stage learns them through `createStage` options and `changeStage…` functions, so `src/lib/core/` never reads `localStorage`.

## Goals / Non-Goals

**Goals:**

- Trust decisions stay in the permissions module: one pure function turns a mod, the app's origin and a list of decisions into grants, for launches, checks and inspection alike.
- The stage asks before the frame exists, with the same mechanics as the mod API question.
- No change to the mod API: the mount context and the inspection keep their shape (see the proposal's Impact).

**Non-Goals:**

- Asking from inside a running mod (a runtime permission request). Grants stay fixed for the frame's life.
- Changing what mods from the app's origin get.
- Any decision about tiles (media linked by tiles stays as it is, players are another change).

## Decisions

### D1. Decisions are data, and grants are computed from them

```ts
/** The user's answer about one declared permission of one mod. */
export interface SiteDecision {
  /** The mod file's address, as resolved by the mod loader. */
  mod: string;
  /** The mod's title when the user answered, for Settings. */
  title: string;
  category: PermissionCategory;
  /** As declared: an origin, a wildcard host or `"*"`. */
  host: string;
  allowed: boolean;
}

export function grantModPermissions(
  mod: Pick<ModFile, "source" | "permissions">,
  appOrigin: string,
  decisions: SiteDecision[],
): ModGrants;

/** The declared permissions the dialog must ask about: foreign mod, no decision for this mod. */
export function listConsentLines(
  mod: Pick<ModFile, "source" | "permissions">,
  appOrigin: string,
  decisions: SiteDecision[],
): ModPermission[];
```

A decision matches a declared permission when `mod`, `category` and `host` are equal, compared as written: no host covering, so a decision for `https://*.archive.org` never covers `https://archive.org`. For a foreign mod, a declared permission is granted when a matching decision has `allowed: true`. Duplicated declarations (the mod format does not reject them) give one line, with the first reason.

The stage passes remembered decisions plus the answers of the current dialog, which are decisions too but are not stored. Checks and inspection pass remembered decisions only, so "never ask" needs no special case.

*Alternative*: a `consent` object with sets per category. Rejected: a flat list is what Settings shows and what storage keeps, and lookups over a few dozen entries do not need an index.

### D2. The launch is built after the answers

`buildModLaunch` takes `grants` instead of computing them. `prepareModLaunch` is split:

1. `loadModLaunchInputs(request, options)`: refuses a switched-off default mod, loads the mod and its tiles. Returns `{ mod, link, modTiles }`. Every error propagates, as today.
2. The stage decides: API question, then site question, then `grantModPermissions` with the decisions, then `buildModLaunch(mod, link, modTiles, appOrigin, grants, loadsTileLinkedMedia)`.

The runtime keeps the inputs while it asks (`runtime.pending`), and `runtime.launch` is set only when the mod starts. `ApiMismatchDialog` reads the mod from the pending inputs. The mount check calls `buildModLaunch` with `grantModPermissions(mod, appOrigin, remembered)`.

*Alternative*: build the launch with remembered decisions, then rebuild it after the answer. Rejected: two policies for one mod, and the first is never used.

### D3. One `asking` status, with the question in the snapshot

The runtime keeps the `asking` status and gains `question: "api" | "sites" | null`. The snapshot keeps `apiMismatch` and gains `siteConsent: { lines } | null`, non-null only while the question is `"sites"`. Order: API question first (an answer of Cancel fails the runtime as today), then `listConsentLines`; with no lines the mod starts at once.

`answerSiteConsent(stage, sandboxId, answer)` with `answer = { allowed: string[] keyed "category host", remember: boolean } | null` (`null` for Escape) builds the decisions of the lines, asks the services to remember them when `remember` is true, and starts the mod.

*Alternative*: a separate `consenting` status. Rejected: everything that treats `asking` as "waiting for the user" (the "Waiting for your answer…" text, hidden sandboxes, closing) applies unchanged.

### D4. The stage reads and writes decisions through its services

`SandboxServices` gains `readSiteDecisions(): SiteDecision[]` and `rememberSiteDecisions(decisions)`. `createStage` takes both as options; `src/main.tsx` wires them to the new store. The session's context gets `readSiteDecisions` for `mods.inspect`, and the check reads it when it builds its launch. The stage never touches `localStorage`.

### D5. The store in `src/main/settings/site_decisions.ts`

Same shape as `tile_media_setting.ts`: `createSiteDecisions({ storage })`, `rememberSiteDecisions`, `removeSiteDecision`, `readSiteDecisionsSnapshot`, `subscribeSiteDecisions`.

- Key `opentesela.site-decisions`, outside the mod storage slots. Value: a JSON array of `SiteDecision`.
- Reading drops entries that are not valid decisions: `mod` an absolute `http:` or `https:` URL, a known category, a non-empty `host`, a string `title`, a boolean `allowed`. A later entry with the same `mod`, `category` and `host` replaces an earlier one. The cleaned list is written back on the next write.
- A failed write is ignored: the in-memory list still applies until the page is closed.

Removing an entry only changes what later launches read (D4), so running mods keep their policy without any extra code.

### D6. The dialog: `SiteConsentDialog` in `src/main/stage/`

A `StageDialog` like `ApiMismatchDialog`: the mod's title, then its source in `code` under it, so a mod that borrows a title still shows where it comes from. One row per line: a checkbox (checked), the verb and host drawn by the app, and the reason as React text, labeled as the mod's own words. Then the cost sentence, plus the data sentence when a `connect` or `code` line is listed. Then the Remember checkbox (unchecked), and the buttons **Show without them** (focused, the dialog's cancel action, so Escape uses it) and **Allow**.

The verbs come from the permissions module's `CATEGORY_VERBS`, exported as `describePermissionLine(permission)`, so the dialog, the denial message and Settings use the same words.

### D7. Denial message

`describeDeniedPermission` loses "for now": `Permission not granted: show content from https://upload.wikimedia.org ("Shows the book covers"). Mods from other sites get only the permissions you allow.` One message for every reason a permission was not granted (refused now, refused and remembered, a check without decisions), since the fix is the same: open the mod and allow it, or remove the remembered refusal in Settings.

### D8. Settings group

A Mod permissions group after Privacy and before Version. Each row: title, source in `code`, `describePermissionLine`, `Allowed` or `Refused`, and a Remove button whose accessible name includes the mod's title and the line. Empty state: `No remembered decisions.` Rows sorted by title, then source, then category and host, so the list is stable.

## Risks / Trade-offs

- [A mod's reason can mislead, such as "Required by OpenTesela"] → The app draws the verb and the host, the reason is plain text labeled as the mod's words, and the source is always shown under the title.
- [A mod updated at the same address keeps its decisions while its code changes] → Accepted: the decision is about the site, which the update cannot change without a new line being asked. Settings lets the user remove it.
- [Wildcard and `"*"` hosts are hard to judge] → `"*"` exists only for `open`, read as "any site". Wildcard hosts are shown as written; their meaning is the same as in the mod file, which the docs explain.
- [Dialog fatigue for mods with many permissions] → One dialog per start at most, lines only for undecided permissions, and Remember.
- [`connect` or `code` granted to a foreign mod sends the mod's data to that host] → The extra cost sentence, and the sandbox stays the boundary: a granted host never reaches the app's page or storage.
- [Splitting `prepareModLaunch` touches tested code on the launch path] → The split keeps the inputs and errors as they are. The existing launch tests move to the two functions, and e2e tests cover the order of the two questions.

## Migration Plan

No stored data exists before this change, and the mod API does not change. A mod from another origin that used to start at once now shows the dialog once if it declares permissions; choosing Show without them gives exactly the previous behavior. Rolling back leaves the `opentesela.site-decisions` key unused.
