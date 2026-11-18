# Design

## Context

See proposal.md for why. A mosaic launch (`engine/mod_launch.ts`) works in four steps:
1. It loads the mosaic file (`loadLaunchMosaic`, which also raises `MosaicLinkConflictError`).
2. It expands the mosaic into a mod link (`expandMosaicRequest`).
3. It grants the mosaic's `show` lines apart from the mod's (`grantLaunchMosaic` → `LaunchMosaicGrants { mosaic, grants }`), so each refused line names what declared it.
4. Before the frame starts, the stage asks for consent, and the site consent dialog shows mosaic lines in their own group, named by the mosaic's title and address. Remembered mosaic decisions are keyed by the mosaic file's address, "whatever mod it names".

`RUN_LINK_RESERVED_NAMES` drives both link parsing (names kept out of `params`) and the `mods.open` / `mosaics.open` param checks.

## Goals / Non-Goals

**Goals:**
- One grant path for "a mosaic's `show` lines", whether the sandbox was opened from the mosaic or with it as `sites`.
- A `sites` link behaves the same when it's typed, copied or reopened from history.

**Non-Goals:**
- Any UI to build or drop `sites`. That belongs to `rework-stage-bar` (its mod swap and sites chip).
- Letting mods send `sites` in `mods.open`. It stays reserved and refused, and only the app builds such links.
- Collections declaring their own hosts. That's a later change.

## Decisions

### `sites` names a mosaic file, not hosts

The link carries a mosaic reference, resolved against the app's address like `mosaic`.

*Alternative:* inline hosts (`sites=host1,host2`) would let a crafted link ask for arbitrary hosts with no file to review, and would need a new consent key. Naming a mosaic adds no power: anyone can already host a mosaic with those lines and link to it. It also reuses the consent decisions already keyed by that file.

### One grants structure with a role

`LaunchMosaicGrants` gains `role: "mosaic" | "sites"`. A new `loadLaunchSites(request, options)` loads the file named by `sites` with `loadMosaicFile`. The launch then calls `grantLaunchMosaic` on whichever of the two it has. A link can't have both, because the conflict rule forbids it.

Every consumer reads the same structure: grants, `permissions.granted` and `denied`, refused-line issues, consent lines and blocked-request hints. `context.mosaic` and the mosaic's config, aliases and storage slot are filled only for `role: "mosaic"`, so a `sites` sandbox's storage slot stays the one of its mod and collection.

*Alternative:* a separate `LaunchSites` type would duplicate the four consumers for identical behavior.

### A failed `sites` mosaic is a warning, not a load failure

`loadLaunchSites` catches the fetch, parse and format errors of the mosaic file. It returns `null` and a warning `ModIssue` (source: the mosaic file's address, text: the reason plus "its sites were not granted"), and the launch goes on.

*Alternative:* treating it like a failed collection (no frame) would block the mod for an optional extra, while its tiles and its own permissions are fine.

### Reserved name, conflict and parsing

- **Reserved name:** adding `"sites"` to `RUN_LINK_RESERVED_NAMES` keeps it out of `params` and makes `mods.open` and `mosaics.open` refuse it, with the existing `params.<name> is reserved` message.
- **Conflict check:** `loadLaunchMosaic`'s conflict check adds `sites`, and the error text becomes "cannot also have a mod, a collection, a tile or sites".
- **Parsing and building:** `run_links.ts` parses `sites` like `tile`, where an empty value means none, and builds it after `collection` and `tile`, so a copied link reads `mod`, `collection`, `sites`.

### Mod API surface

`MOD_API_VERSION` becomes `0.1.16`. The surface guard's `0.1.16` entry repeats `0.1.15`'s, because the guard records names and no method, event or context key is added, as the `0.1.12` entry did. The engine README's version note records the reserved name and why it's a patch.

## Risks / Trade-offs

- [The reversal widens where a mosaic's hosts apply] → Only through a link that names the mosaic. A foreign mosaic is still asked about and remembered per file, and `show` is the lowest-risk category: no data leaves the frame through it.
- [A `sites` link opened on an older app passes `sites` to the mod as a param and grants nothing] → That's harmless, and acceptable while the project is not shared.
- [A remembered allow for a foreign mosaic now also applies to other mods opened with it as `sites`] → This is the consent model the spec already states ("whatever mod it names"). The dialog's text about sites seeing the use of the mod stays true for the `show` category.

## Migration Plan

No data migration. Existing links have no `sites` and keep working. Rollback is a revert.
