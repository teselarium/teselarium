# Permissions Module

## Introduction

A mod declares the permissions it needs in its `mod_conf.yaml` (see the [mod module](../../mod/README.md)). This module decides what it gets. It is the one place for trust decisions about mods: the user's answers in the site consent dialog reach the grants only through this module.

### The site-owner rule

- A mod whose mod file is served from the **same origin as the app** gets every permission it declares. The site owner chose to publish those files, as a website chooses its own scripts. Default mods (`./default_mods/`) are on the app's origin, so they get their `open` permissions.
- A mod from **any other origin** gets the declared permissions **the user allowed**, and none of the others. A link to a mod on another origin can come from anyone, so the app asks in its site consent dialog before the mod starts (see the [stage module](../stage/README.md)). With nothing allowed, the mod runs with the default content policy.
- Nothing is allowed without asking: not even `show`, because `show` hosts can carry data in URLs.

### Decisions

The user's answers are `SiteDecision` values: `mod` (the mod file's address), `title` (the mod's title when the user answered, for Settings), `category`, `host` (as declared) and `allowed`. The stage passes the remembered decisions plus the answers of the current dialog, which are not stored. Checks and `mods.inspect` pass the remembered decisions only, so they never need to ask.

A decision matches a declared permission when its `mod`, `category` and `host` equal the mod's `source` and the permission's, compared as written: a decision for `https://*.archive.org` never covers `https://archive.org`. A foreign mod's permission is granted when a matching decision is allowed. Decisions are ignored for a mod from the app's origin.

The dialog asks about the declared permissions of a foreign mod that have no decision for that mod. Duplicated declarations give one line, with the first reason.

### Denial messages

Each permission a foreign mod declares and does not get is reported as a warning when it starts. The message is the same whatever the reason (refused now, refused and remembered, a check without decisions), since the fix is the same: open the mod and allow it, or remove the remembered refusal in Settings.

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

The host `"*"` reads as "any site".

### The `open` check

`open` is not part of the content policy: the engine checks it before `mods.inspect` and `mods.open` request any file. A mod may inspect or open a mod when it has a **granted** `open` permission whose host is `"*"` or the origin of the target mod file. Otherwise the request is refused with code `-32002` and one of these messages:

- Not declared: `Opening mods from https://mods.example.net is not allowed. Add it to permissions.open in mod_conf.yaml.`
- Declared but not granted: `Opening mods from https://mods.example.net: the mod declares it in permissions.open, but the permission was not granted.`

## Module Details

Implemented in `src/lib/core/permissions/`. Other modules import only from the public entry point `src/lib/core/permissions/index.ts`.

- `grantModPermissions(mod, appOrigin, decisions)`: applies the site-owner rule to a mod's `source` and `permissions`, with the user's `SiteDecision` list. Returns `ModGrants` (`granted`, `denied`), which together hold every declared permission. The stage passes `window.location.origin`.
- `listConsentLines(mod, appOrigin, decisions)`: the declared permissions the site consent dialog asks about, one per category and host, in the order declared. Empty for a mod from the app's origin.
- `describePermissionLine(permission)`: the category's verb and the host, such as `show content from https://upload.wikimedia.org`.
- `describeDeniedPermission(permission)`: the warning text for a declared permission that was not granted.
- `checkOpenGrant(grants, targetSource)`: `null` when the mod may inspect or open the mod at `targetSource`, otherwise the denial message.
- Types: `ModGrants`, `SiteDecision`.

Example:

```ts
import { checkOpenGrant, grantModPermissions } from "./lib/core/permissions/index.ts";

const grants = grantModPermissions(explorer, "https://example.org", []);
// explorer.source is https://example.org/default_mods/mod_explorer/mod_conf.yaml
// grants.granted holds { category: "open", host: "*", reason: "Opens the mods you pick" }

checkOpenGrant(grants, "https://mods.example.net/clock/mod_conf.yaml");
// null: "*" covers any site
```
