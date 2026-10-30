# Proposal

## Why

Tile authors choose the images, audio and video their tiles link to, but only mod authors can allow a host, in `mod_conf.yaml`. A tile that links a picture on a new site shows nothing until some mod declares that site, and a mod from another origin gets none of its permissions anyway. OpenTesela is meant to be composable: anyone should be able to write and share tiles for existing mods without touching permissions. The address a tile links is chosen by the tile author, not by the mod, so allowing exactly that address lets the media load without giving the mod a way to send data to a host of its choice.

## What Changes

- **Tile-linked URLs**: when the engine builds a mod's content policy, it collects each `http:` or `https:` URL found as a metadata string of the tiles the mod receives, at any depth, after the tile type filter. Each one is added to `img-src` and `media-src` as an exact source, with its path, so it allows that file and no other file of its host. They are not added to `style-src`, `font-src`, `connect-src`, `frame-src` or `script-src`: tiles never let a mod load stylesheets, fonts, data, pages or code.
- **Exact sources**: a URL goes into the policy without its query and fragment, which the browser does not match anyway. A URL whose path ends with `/` names a folder or a page, not a file, and would allow everything under it: it is not collected. A URL whose origin a content host or a granted `show` host already allows needs no source of its own. A URL that cannot be written as a valid source (a user name or password, an IPv6 address, a host name with characters a policy cannot hold, `;` or `,` in its path) is left out and reported.
- **Private network guard**: a tile-linked URL whose host is on the user's own computer or network is left out, unless the tile itself was loaded from such a host. That covers `localhost` and `.localhost` names, loopback, private, link-local and shared IPv4 addresses, names without a dot, and `.local`, `.internal`, `.lan` and `.home.arpa` names. A tile picked from the user's computer (`file:`) gets the guard too, since the file may have been downloaded from the web. A tile from the web cannot make the reader's browser send requests to their router or other devices. Each left-out URL is reported as a warning issue whose source is the tile.
- **Load media linked by tiles**: a new setting, on by default, in a new Privacy group of Settings. Switched off, no tile-linked URL is collected or reported, and mods show only media from content hosts and granted `show` hosts. The setting applies to mods started after it changes.
- **Fixed at start**: the policy cannot change while a mod runs. When "Reload tiles" brings URLs that the policy does not have, the stage bar reports that the mod must be opened again to show them.
- **Redirect hint**: the browser checks only the host of a redirect's target, never its path, so a tile link that redirects to another host is blocked. The report of a blocked image or media request whose host is not declared gets a sentence for tile authors: link the final address of the file.
- **Every mod**: tile-linked URLs are allowed for mods from the app's origin and from other origins alike, as content hosts are today. The mod cannot choose these addresses, only whether to load them.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `mod-sandbox`: what a mod can load without granted permissions now includes tile-linked URLs in `img-src` and `media-src`. New requirements cover:
  - which URLs are collected;
  - the private network guard;
  - the reports for left-out URLs and for URLs new after "Reload tiles";
  - the redirect hint in blocked request reports.
- `app-settings`: a new Privacy group with the setting "Load media linked by tiles", kept with the other settings and on by default. The Version group moves after it.

## Impact

- **Code**:
  - `src/lib/core/sandbox/sandbox_policy.ts`: the exact sources and their directives;
  - a new collecting function in the sandbox module, with the private network guard;
  - `src/lib/core/sandbox/sandbox_reports.ts` and its caller in `src/lib/core/engine/mod_session.ts`: the redirect hint;
  - `src/lib/core/engine/mod_launch.ts`: passing the tiles and the setting to the policy;
  - `src/lib/core/stage/stage_sandboxes.ts`, `stage_checks.ts` and `stage_controller.ts`: the setting for each launch, the left-out URL issues and the notice for new URLs after "Reload tiles";
  - `src/main/settings/SettingsPage.tsx`, a new setting store in `src/main/settings/`, and `src/main.tsx` and `src/App.tsx`, which create it and hand it to the stage and the page.
- **Tests**:
  - unit tests of the collecting function (nested values, queries, values that are not URLs, invalid sources) and the private network guard (each kind of address, and a tile from a private host);
  - a policy test with tile-linked URLs;
  - e2e tests, with `page.route`, that a linked image and a linked audio file load, that another file of the same host is blocked, that a private address from a public tile is left out and reported, and that the setting switched off blocks them.
- **Docs**: the policy table, a "Media linked by tiles" section and the reports in `docs/modules/lib/core/sandbox/README.md`; the settings docs; a note for tile authors on linking files and avoiding redirects.
- **Mod API version**: none. The change touches `mod-sandbox` and `app-settings`, which are not part of the mod API: no method, event, mount context key or mod file key changes, and every mod keeps working, now with more media allowed.
- **App version**: patch bump. While the app is `0.x`, anything that is not breaking is a patch: tiles can show media from any public site, Settings has a new switch, and nothing that worked stops working.
- **Related changes**: independent of `allow-wildcard-permission-hosts` and `resolve-relative-tile-paths`. Wildcard hosts remain the answer for mods whose hosts redirect, such as Open Library covers. `add-site-consent-dialog` builds on the URL collection and the private network guard of this change.
- **Out of scope**:
  - streams (HLS and DASH), whose segment addresses are not in the tile;
  - pages embedded in frames, such as YouTube videos (see `add-site-consent-dialog`);
  - URLs in the markdown body;
  - a proxy that hides the reader's address from linked sites.
