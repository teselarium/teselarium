# Design

## Context

A mod's policy is built once, in `buildModLaunch` (`src/lib/core/engine/mod_launch.ts`): `collectContentHosts` takes the origins of the files the engine read, `grantModPermissions` gives the granted permissions, and `buildSandboxPolicy(contentHosts, granted)` writes the policy that `buildSandboxDocument` puts in the frame's `srcdoc`. Changing `srcdoc` reloads the frame and stops the mod, so the policy cannot change while the mod runs. `buildModLaunch` is called on two paths: `prepareModLaunch`, used by `launchSandbox` in `src/lib/core/stage/stage_sandboxes.ts`, and the mount check in `src/lib/core/stage/stage_checks.ts`.

The tiles `buildModLaunch` gets are already filtered by tile type and have their `./` and `../` strings resolved against the tile's `source` (`selectModTiles`). A tile's `source` is an absolute `http(s):` URL, or a `file:///` URL for a picked file. Metadata is a `YamlMapping` of plain `YamlValue`s.

"Reload tiles" (`reloadSandboxTiles`) loads the collection again, pushes `tiles.changed` and replaces `runtime.collectionIssues`, the collection's `TileIssue`s, which the mod also receives. `readSandboxIssues` lists the file issues, the collection issues, then the others.

Blocked requests reach `describeBlockedRequest(blocked, mod, grants)` from `reportBlockedRequest` in `mod_session.ts`. Browsers may reduce `blockedURI` to an origin, and after a redirect some report the original address rather than the target.

App settings live in `src/main/`: each is a small store over `localStorage` (`section_switches.ts`, `app_theme.ts`) created once in `src/main.tsx`. `createAppTheme` tells the stage about changes with `changeStageColorScheme`, and the stage starts from `readStartColorScheme`. The Settings page reads the stores with `useStoreSnapshot`, and gets them through `App` and `PageView` props.

## Goals / Non-Goals

**Goals:**

- One pure function finds a mod's tile links and sorts them into policy sources and issues. Opening, reloading and checking all use it.
- The policy stays the same for the same input: sources are sorted and without duplicates.
- The stage learns about the setting the way it learns about the color scheme, so `src/lib/core/` never reads `localStorage`.

**Non-Goals:**

- Telling the mod which links were allowed. The mount context does not change, so the mod API version does not change.
- Adding tile link issues to a mod check's findings. The check's frames get the same policy as the running mod, and nothing more.
- Detecting public host names that resolve to private addresses (see Risks).

## Decisions

### Collect the links in the sandbox module

A new `src/lib/core/sandbox/tile_links.ts` exports:

```ts
/** What a mod's tiles link: the exact sources the policy adds, and the links left out. */
export interface TileLinks {
  /** `origin + pathname` of each allowed link, sorted and without duplicates. */
  sources: string[];
  /** One warning per left-out URL and tile, whose source is the tile. */
  issues: ModIssue[];
}

export function collectTileLinks(
  tiles: Tile[],
  contentHosts: string[],
  granted: ModPermission[],
): TileLinks;
```

It walks each tile's metadata values, not keys, through lists and mappings with explicit loops, as `tile_paths.ts` does. Each string goes through these steps in order, and the first step that applies decides:

1. Not an absolute URL (`URL.canParse(value)` without a base) or not `http:`/`https:`: skipped silently. Plain text, `data:` and `file:` strings are never links.
2. Path ends with `/`: skipped silently. Such a source would allow every file under it, and a page or homepage link is not media.
3. Its origin is covered by a content host or a granted `show` host (`permissionHostCovers`, so wildcard hosts count): skipped silently. The policy already allows it, and the reload check does not count it as new.
4. The policy cannot express it: an issue. See the next decision.
5. Private host, and the tile's own host is not private: an issue (see "Private network guard").
6. Otherwise `url.origin + url.pathname` is added to `sources`. The query and fragment are dropped, since the browser does not match them.

Issues are deduplicated by tile source and URL, so the same URL twice in one tile reports once, and in two tiles reports twice, with each tile as the source. The URL in the message is the string as written in the tile.

It lives in the sandbox module because it decides what the policy allows, next to `collectContentHosts`. The sandbox module gains a type-only import of `Tile` from the tile module, and `isYamlMapping` from the files module.

*Alternatives:*
- In the engine, next to `tile_paths.ts`: the walk is similar, but this function's output is policy sources, which only the sandbox module should decide.
- Collecting every URL and dropping covered ones inside `buildSandboxPolicy`: the reload check would then need the same filtering a second time.

### What the policy cannot express

A CSP host source has the shape `scheme://host[:port]/path`. Its host is letters, digits, `-` and `.`, and its path is RFC 3986 `pchar`s without `;` and `,`, which separate directives and policies. Step 4 checks the parsed URL:

- `url.username` or `url.password` is not empty. Browsers also block subresource requests with credentials in the URL.
- `url.hostname` starts with `[` (IPv6). The source grammar has no IPv6 form. Private IPv6 addresses end up here too, so the guard needs no IPv6 ranges.
- `url.hostname` holds a character outside `[a-z0-9.-]`. After the URL parser, internationalized names are already `xn--` ASCII, so this mainly catches `_`.
- `url.pathname` holds a character outside `[A-Za-z0-9\-._~!$&'()*+=:@%/]`. The parser already percent-encodes spaces, quotes, `<>`, non-ASCII and the like. What this leaves out in practice is `;`, `,`, `|`, `[` and `]`, which the parser keeps as written.

Leaving these out is simpler and safer than percent-encoding them, which would depend on each browser decoding the source's path before matching.

### Private network guard

A new `src/lib/core/sandbox/private_hosts.ts` exports `isPrivateHost(hostname: string): boolean`, using the spec's list ("Hosts on the user's computer or network"). It drops one trailing `.`, then:

- checks names: `localhost`, no dot, or ending with `.localhost`, `.local`, `.internal`, `.lan` or `.home.arpa`;
- checks a dotted-quad IPv4 address, after splitting it into four numbers, against the ranges as `[first, prefix length]` pairs in a table.

The input is always `URL.hostname`, so the parser has already turned `2130706433`, `0x7f.1` and `0177.0.0.1` into `127.0.0.1`. The guard never parses addresses itself.

A tile's own host counts as private when its `source` is `http:` or `https:` and `isPrivateHost` says so. A `file:` tile is not private, because a picked file may have been downloaded from the web. Someone working on tiles locally serves them from `localhost`, which counts.

The guard comes after the coverage check (step 3). A private URL that a content host or a granted `show` host already covers is allowed by that host's source anyway, and reporting it as left out would be false.

### The policy takes the sources as a third argument

`buildSandboxPolicy(contentHosts, granted, tileLinkSources)` adds `tileLinkSources` after the sorted hosts in `img-src` and `media-src` only. They come sorted from `collectTileLinks`. The argument is required, so each caller states it: `buildModLaunch` passes `tileLinks.sources`, or `[]` with the setting off. The order of `style-src`, `font-src` and the other directives does not change, so the default policy of the README is the same text for a mod whose tiles link nothing.

### The setting reaches the launch as a boolean

- `buildModLaunch(mod, link, modTiles, appOrigin, loadsTileLinkedMedia)` and `ModLaunchRequest.loadsTileLinkedMedia`.
- `ModLaunch.tileLinks: TileLinks | null`: `null` when the setting was off. Then nothing is collected, nothing is reported and there is no redirect hint. With the setting on and without a collection it is `{ sources: [], issues: [] }`.
- `StageOptions.loadsTileLinkedMedia` (the start value), `Stage.loadsTileLinkedMedia`, and `changeStageTileLinkedMedia(stage, isOn)`, which only sets the field. Running sandboxes are not touched and nothing is published, since the snapshot does not change.
- `SandboxServices.loadsTileLinkedMedia` and `CheckServices.loadsTileLinkedMedia`, copied from the stage by `buildSandboxServices` and `buildCheckServices`. Those are built at the moment of each launch, so a plain boolean is read at the right time. `readTheme` is a function because sessions connect later.

*Alternative:* a reader function in the services, as for the theme. Not needed: the value matters only when a launch is built.

### The setting store

A new `src/main/settings/tile_media_setting.ts`, shaped like `section_switches.ts` and `app_theme.ts`:

- `TILE_MEDIA_SETTING_KEY = "opentesela.tile-linked-media"`, outside the `opentesela.mod-storage:` keys. It stores `true` or `false` as JSON. A missing, unreadable or other value is on.
- `readStartTileLinkedMedia(storage): boolean`, for `createStage` in `main.tsx`, before the store exists, like `readStartColorScheme`.
- `createTileMediaSetting({ storage, stage })`, `switchTileLinkedMedia(setting, isOn)` (writes in a `try`, then calls `changeStageTileLinkedMedia` and the listeners), `readTileMediaSnapshot` and `subscribeTileMediaSetting` for `useStoreSnapshot`.

`main.tsx` creates it next to the switches. `App` and `PageView` pass it to `SettingsPage` as `tileMedia`. The page adds a Privacy card between Sidebar and Version, with a shadcn `Switch` and `Label` "Load media linked by tiles". Its `CardDescription` says: "Mods can show the images, audio and video their tiles link to. The linked sites can see that you viewed the tile. Applies to mods opened after the change."

### Left-out link issues have their own list in the runtime

`SandboxRuntime.tileLinkIssues: ModIssue[]` is set from `launch.tileLinks?.issues ?? []` in `startRuntime`. `readSandboxIssues` lists the file, collection, tile link, then the other issues. The issues are kept out of `launch.issues`, whose copy `runtime.issues` collects run-time issues and is never replaced. They are kept out of `collectionIssues` too, because those are `TileIssue`s that the mod receives in its context and in `tiles.changed`: the mount context stays as it is.

### Reload compares against the launch

When the collection loads and `launch.tileLinks` is not `null`, `readReloadedIssues` (or a sibling it calls) runs `collectTileLinks(modTiles.tiles, launch.contentHosts, launch.context.permissions.granted)`. It counts the reloaded sources that are not in `launch.tileLinks.sources` and replaces `runtime.tileLinkIssues` with:

1. when the count is above zero, the warning from a new `describeNewTileLinks(count, collectionSource)` in `sandbox_reports.ts`: `The reloaded tiles link 1 file that this mod does not allow yet. Open the mod again to show it.`, or `… link 3 files … to show them.`;
2. the reloaded left-out issues.

When the collection cannot be loaded, `tileLinkIssues` stays as it was, and the load error is the collection issue, as it is today. The launch's `tileLinks` is never changed, so a second reload still compares against what the frame allows.

### Redirect hint in the blocked request report

`describeBlockedRequest(blocked, mod, grants, hintsTileLinks)` adds ` If a tile links this file, link its final address: links that redirect to another site are blocked.` to the "Add it to permissions.<category>" message when the directive is `img-src` or `media-src`. The hint does not try to tell which tile link redirected, since browsers report either the original or the target, sometimes only its origin. `ModSession` gets `hintsTileLinks: boolean`, set from `launch.tileLinks !== null` when the session connects, and `reportBlockedRequest` passes it. Deduplication is by message, so it is unchanged.

### Tests

- `private_hosts.test.ts`: each name suffix, a trailing dot, each IPv4 range at its edges (`172.15.255.255` and `172.32.0.0` public, `172.16.0.0` and `172.31.255.255` private), and `localhost.example.net` public.
- `tile_links.test.ts`: one case per step above, named after the spec scenarios. Also nested lists and mappings, keys ignored, the query and fragment dropped, sorting and deduplication, a covered wildcard host, a tile from `http://localhost:8080` allowed, a `file:` tile guarded, and a check that the input tiles are unchanged.
- `sandbox_policy.test.ts`: sources in `img-src` and `media-src` only, and the default policy text unchanged with `[]`.
- `sandbox_reports.test.ts`: the hint for `img-src` and `media-src` only, never for a denied permission, never with `hintsTileLinks` `false`. `describeNewTileLinks` in the singular and plural.
- `mod_launch.test.ts`, `stage_sandboxes.test.ts`, `stage_checks.test.ts`: `tileLinks` with the setting on and off, `tileLinkIssues` at start, the reload notice and the replacement of issues, and the check's policy.
- `tile_media_setting.test.ts` and `SettingsPage.test.tsx`: defaults, stored values, a failing storage, and the stage being told.
- e2e in `e2e/mod_sandbox.spec.ts` and `e2e/app_settings.spec.ts`: probe mods with collections served by `page.route` on `https://tiles.example.net` and media on `https://media.example.net`, as "Tile from another host" does today. A linked image loads and a linked `<audio>` request is sent. Another file of the same host is blocked. A linked `http://192.168.1.1/logo.png` is left out, reported and never requested (a `page.route` on it records nothing). A `302` to `https://cdn.example.org/` gets the hint. The reload notice appears. The Settings switch off blocks the image in a newly opened mod, but not in one already running.

## Risks / Trade-offs

- [A public host name can resolve to a private address (DNS rebinding, or names like `router.example.com` that point at `192.168.1.1`)] → The guard checks names and addresses, not DNS. The query a tile author controls still reaches such a host. Browsers' own local network protections (Chrome's Local Network Access prompt) are a second line. The sandbox README says what the guard does and does not cover.
- [Collections with thousands of distinct media files make long policies] → Each source is about 100 bytes, written twice, so 10,000 tiles add about 2 MB to the `srcdoc`. Sorting and deduplication keep it stable. A shared host as a granted `show` permission makes the links redundant (step 3), and the README suggests that to mod authors with large collections.
- [Links that redirect to another site are blocked] → The browser checks only the target's host. The hint tells tile authors to link the final address. Wildcard `show` hosts stay the answer for mods whose hosts redirect.
- [A tile link reveals to the linked site that the reader viewed the tile] → The setting can switch it off. The Settings text says it, and the README's "Media linked by tiles" section repeats it.
- [Path characters left out by step 4 hit a real image URL] → Such URLs are rare after the parser's percent-encoding, and each one is reported with the tile as source, so the author can rename or re-link the file.
- [The page's existing e2e tests assume a fixed policy text] → With `[]` the text is unchanged. The sample collection's covers are on `show` hosts the sample mod declares, so step 3 leaves them out of the sample's policy.

## Migration Plan

Nothing to migrate. There is no stored value until the user changes the setting, and no stored value means on. Rolling back removes the key's reader. A stored `opentesela.tile-linked-media` left in `localStorage` is then ignored.
