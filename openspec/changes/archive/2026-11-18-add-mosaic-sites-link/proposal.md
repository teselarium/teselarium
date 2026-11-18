# Proposal

## Why

A mosaic's `show` hosts describe where its collection's media live, not what its mod needs. Today they are granted only to the sandbox opened from that mosaic, so running another mod on the same data breaks covers and portraits that redirect or are not linked literally by the tiles. The stage bar rework (`rework-stage-bar`) lets users swap the mod of a mosaic and needs a link that keeps those hosts. This change gives run links that ability on its own, so the permission change is reviewed apart from the UI.

## What Changes

- A run link with `mod` accepts **`sites`**, a mosaic reference. Before the mod starts, the app loads that mosaic file and grants its `show` lines to the sandbox, as for a mod opened from that mosaic. It uses nothing else of the mosaic: not its mod, collection, config or aliases, and the mount context's `mosaic` stays `null`.
  - **Consent:** a `sites` mosaic from another origin is asked about and remembered per mosaic file, exactly as when opening that mosaic. A decision already remembered for it applies.
  - **Refused lines and blocked requests:** they are reported and point to the mosaic file, as for a mosaic.
  - **Load failure:** a `sites` mosaic that cannot be loaded does not stop the mod. It runs without those lines, and a warning names the mosaic file.
  - **Conflict:** a link with both `mosaic` and `sites` shows the mosaic link conflict error.
- **BREAKING** (spec reversal): "Mosaic grants last only for its sandbox" gets one exception: a sandbox opened with that mosaic as `sites`.
- `sites` becomes a **reserved link name**: it never reaches a mod's `params`, and `mods.open` and `mosaics.open` refuse `params.sites`.
- Mod API version **0.1.15 → 0.1.16**.

Mod API version bump: **patch** (`0.1.15` → `0.1.16`). Reserving `sites` could break a mod that read or passed a `sites` parameter, which would call for a minor bump. No shipped, test or known mod does, and no mod exists outside this repository, so it is taken as a patch, as `tile` was in `0.1.12` and `mosaic` in `0.1.13`. The app gets a patch bump too.

This change builds on `add-app-catalog` (mod API `0.1.15`), which must be applied first.

## Capabilities

### New Capabilities

None.

### Modified Capabilities
- `mod-stage`: the `sites` run link parameter, its load failure, and `sites` in the mosaic link conflict rule.
- `mod-sandbox`: a sandbox opened with `sites` gets the named mosaic's `show` lines, an exception to "Mosaic grants last only for its sandbox".
- `site-consent`: a `sites` link asks and remembers as its mosaic does.
- `mod-engine-api`: `sites` joins the reserved names in `mods.open` and `mosaics.open` params.
- `mod-api-version`: the version becomes `0.1.16`.

## Impact

- **Engine** (`src/lib/core/engine/`): `RunLink.sites`, `RUN_LINK_RESERVED_NAMES`, a new `loadLaunchSites`, and `LaunchMosaicGrants` with a role (`mosaic` or `sites`). Also the consent lines, refused-line issues and blocked-request hints, the `0.1.16` surface guard entry and `MOD_API_VERSION`.
- **Stage** (`src/lib/core/stage/`): `run_links.ts` parses and builds `sites`. The launch passes it on, and the warning of a failed `sites` mosaic reaches the stage bar's messages.
- **Docs**: engine README (run link fields, reserved names, `0.1.16` note), stage README (run links), and the mosaic module README (where a mosaic's `show` lines apply).
- **Tests**: unit tests for run links, launch and grants. e2e tests for a `sites` link from the app's origin and from another origin (dialog group, remembered decision), and for a failed `sites` mosaic.
- No UI change, and no new dependency.
