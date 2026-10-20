# Permissions Module

## Introduction

A mod declares the permissions it needs in its `mod_conf.yaml` (see the [mod module](../../mod/README.md)). This module decides what it gets. It is the one place for trust decisions about mods: the future permission prompt and init options will change only this module.

### The site-owner rule

- A mod whose mod file is served from the **same origin as the app** gets every permission it declares. The site owner chose to publish those files, as a website chooses its own scripts. Default mods (`./default_mods/`) are on the app's origin, so they get their `open` permissions.
- A mod from **any other origin** gets none of its permissions and runs with the default content policy, as if the user had chosen "Run without". A link to a mod on another origin can come from anyone.
- There are no exceptions: not even `show` is granted to foreign mods, because `show` hosts can carry data in URLs.

### Denial messages

Each permission a foreign mod declares is reported as a warning when it starts:

```
Permission not granted: show content from https://upload.wikimedia.org ("Shows the book covers"). Mods from other sites run without extra permissions for now.
```

The verbs match the future permission prompt:

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

- `grantModPermissions(mod, appOrigin)`: applies the site-owner rule to a mod's `source` and `permissions`. Returns `ModGrants` (`granted`, `denied`), which together hold every declared permission. The stage passes `window.location.origin`.
- `describeDeniedPermission(permission)`: the warning text for a declared permission that was not granted.
- `checkOpenGrant(grants, targetSource)`: `null` when the mod may inspect or open the mod at `targetSource`, otherwise the denial message.
- Types: `ModGrants`.

Example:

```ts
import { checkOpenGrant, grantModPermissions } from "./lib/core/permissions/index.ts";

const grants = grantModPermissions(explorer, "https://example.org");
// explorer.source is https://example.org/default_mods/mod_explorer/mod_conf.yaml
// grants.granted holds { category: "open", host: "*", reason: "Opens the mods you pick" }

checkOpenGrant(grants, "https://mods.example.net/clock/mod_conf.yaml");
// null: "*" covers any site
```
