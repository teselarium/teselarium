# Permissions Module

## Introduction

A mod declares the permissions it needs in its `mod_conf.yaml` (see the [mod module](../../mod/README.md)), and a mosaic declares the `show` lines its collection needs in its mosaic file (see the [mosaic module](../../mosaic/README.md#permissions)). This module decides what each gets. It is the one place for trust decisions about mods and mosaics: the user's answers in the site consent dialog reach the grants only through this module.

### The site-owner rule

- A mod whose mod file is served from the **same origin as the app** gets every permission it declares. The site owner chose to publish those files, as a website chooses its own scripts. Default mods (`./default_mods/`) are on the app's origin, so they get their `open` permissions.
- A mod from **any other origin** gets the declared permissions **the user allowed**, and none of the others. A link to a mod on another origin can come from anyone, so the app asks in its site consent dialog before the mod starts (see the [stage module](../stage/README.md)). With nothing allowed, the mod runs with the default content policy.
- Nothing is allowed without asking: not even `show`, because `show` hosts can carry data in URLs.
- A **mosaic**'s `show` lines follow the same rule, by the origin of the mosaic file: every line of a mosaic from the app's origin, and the lines the user allowed for that mosaic file otherwise. The mosaic's grants are the sandbox's only: the mod's own grants are decided by the mod's file, whatever mosaic opened it (see [Permissions of a mosaic](../sandbox/README.md#permissions-of-a-mosaic)).

### Decisions

The user's answers are `SiteDecision` values with exactly one of `mod` (the mod file's address) or `mosaic` (the mosaic file's address), then `title` (the mod's or the mosaic's title when the user answered, for Settings), `category`, `host` (as declared) and `allowed`. `ModSiteDecision` and `MosaicSiteDecision` are the two kinds. The stage passes the remembered decisions plus the answers of the current dialog, which are not stored. Checks and `mods.inspect` pass the remembered decisions only, so they never need to ask.

A decision matches a declared permission when its `mod`, `category` and `host` equal the mod's `source` and the permission's, compared as written: a decision for `https://*.archive.org` never covers `https://archive.org`. A foreign mod's permission is granted when a matching decision is allowed. Decisions are ignored for a mod from the app's origin. A mosaic's line matches the decisions whose `mosaic` is the mosaic file's address, in the same way: a mod's decision never applies to a mosaic, and a mosaic's never to a mod, even for the same address and host.

The dialog asks about the declared permissions of a foreign mod that have no decision for that mod, then about the `show` lines of a foreign mosaic that have no decision for that mosaic, in one dialog. Duplicated declarations give one line, with the first reason.

### Denial messages

Each permission a foreign mod declares and does not get is reported as a warning when it starts. Each refused line of a foreign mosaic is reported the same way, with the mosaic file as source and named in the text: `Permission of the mosaic "https://mosaics.example.net/maps/mosaic.yaml" not granted: show content from https://covers.openlibrary.org ("Shows the book covers"). Mosaics from other sites get only the permissions you allow.` The message is the same whatever the reason (refused now, refused and remembered, a check without decisions), since the fix is the same: open the mod and allow it, or remove the remembered refusal in Settings.

```
Permission not granted: show content from https://upload.wikimedia.org ("Shows the book covers"). Mods from other sites get only the permissions you allow.
```

The site consent dialog, the denial messages and Settings use the same verbs:

| Category | Verb |
|---|---|
| `show` | show content from |
| `connect` | exchange data with |
| `embed` | embed pages from |
| `code` | load code from |
| `open` | open mods from |

The `open` verb names mods, but `open` also covers the collections a mod may inspect (see [The `open` check](#the-open-check)).

The host `"*"` reads as "any site".

### The `open` check

`open` is not part of the content policy: it covers the mods, collections and mosaics a mod may reach through the engine. The engine checks it before `mods.inspect`, `mods.open`, `mods.check`, `collections.inspect`, `mosaics.inspect` and `mosaics.open` request any file. A mod may inspect or open a mod, inspect a collection, or inspect or open a mosaic, when it has a **granted** `open` permission whose host is `"*"` or the origin of the target mod file, collection file or mosaic file. For a mosaic, only the mosaic file's origin is checked, not that of the mod it names (see [Inspecting and opening mosaics](../engine/README.md#inspecting-and-opening-mosaics)). Otherwise the request is refused with code `-32002` and one of these messages, worded for the request's subject:

- Not declared: `Opening mods from https://mods.example.net is not allowed. Add it to permissions.open in mod_conf.yaml.`, `Inspecting collections from https://tiles.example.net is not allowed. Add it to permissions.open in mod_conf.yaml.`, or `Opening mosaics from https://mosaics.example.net is not allowed. Add it to permissions.open in mod_conf.yaml.`
- Declared but not granted: `Opening mods from https://mods.example.net: the mod declares it in permissions.open, but the permission was not granted.`, or `Inspecting collections from https://tiles.example.net: the mod declares it in permissions.open, but the permission was not granted.`

`collections.inspect` and `mosaics.inspect` never show the site consent dialog: a foreign mod gets it only when the user allowed its `open` permission before it started.

## Module Details

Implemented in `src/lib/core/permissions/`. Other modules import only from the public entry point `src/lib/core/permissions/index.ts`.

- `grantModPermissions(mod, appOrigin, decisions)`: applies the site-owner rule to a mod's `source` and `permissions`, with the user's `SiteDecision` list. Returns `ModGrants` (`granted`, `denied`), which together hold every declared permission. The stage passes `window.location.origin`.
- `grantMosaicPermissions(mosaic, appOrigin, decisions)`: the same rule for a mosaic's `source` and `show` lines, with the mosaic decisions. `null`, a mod not opened from a mosaic, gets two empty lists. The mosaic's grants are kept apart from the mod's until the launch joins them, so each refused line is reported with what declared it (the engine's `grantLaunchMosaic`, see the [engine module](../engine/README.md#launch)).
- `joinGrants(first, second)`: the lines of `first`, then those of `second`, in each list: the sandbox's grants from the mod's and the mosaic's.
- `listConsentLines(mod, appOrigin, decisions, mosaic?)`: the lines the site consent dialog asks about, the mod's then the mosaic's, one per category and host for each, in the order declared, each a `ConsentLine` with its `subject`, `"mod"` or `"mosaic"`. Empty for a mod and a mosaic from the app's origin.
- `readDecisionDeclarer(decision)` and `isDecisionOf(decision, declarer)`: the `DecisionDeclarer` (`subject` and `source`) of a decision, and whether a decision answers about a given declarer. Settings groups and removes decisions with them.
- `describePermissionLine(permission)`: the category's verb and the host, such as `show content from https://upload.wikimedia.org`.
- `describeDeniedPermission(permission)`: the warning text for a declared permission that was not granted.
- `describeDeniedMosaicPermission(permission, mosaicSource)`: the warning text for a mosaic's line that was not granted.
- `checkOpenGrant(grants, targetSource, subject?)`: `null` when the mod may reach the mod or collection file at `targetSource`, otherwise the denial message. `subject` (`OpenSubject`) is `"mods"` (the default), `"collections"` or `"mosaics"`, and words the message.
- Types: `ModGrants`, `OpenSubject`, `SiteDecision`.

Example:

```ts
import { checkOpenGrant, grantModPermissions } from "./lib/core/permissions/index.ts";

const grants = grantModPermissions(explorer, "https://example.org", []);
// explorer.source is https://example.org/default_mods/mod_explorer/mod_conf.yaml
// grants.granted holds { category: "open", host: "*", reason: "Opens the mods you pick" }

checkOpenGrant(grants, "https://mods.example.net/clock/mod_conf.yaml");
// null: "*" covers any site
```
