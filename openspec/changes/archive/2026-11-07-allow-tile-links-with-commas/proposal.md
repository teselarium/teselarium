# Proposal

## Why

A tile can link an image, video or audio file whose address has a comma or a semicolon in its path, such as `https://upload.wikimedia.org/wikipedia/en/a/ae/Bob_Dylan_Chronicles,_Volume_1.jpg`. Today such a link is left out with the warning "the sandbox cannot allow this address", because `,` separates policies and `;` separates directives in a Content-Security-Policy, so the address cannot be written into the frame's policy as it is. Commas are common in file names: two covers of the shipped sample collection `public/samples/tiles/literature_nobel_laureates_books/` (`Bob_Dylan_Chronicles,_Volume_1.jpg` and `Human_Acts,_cover.png`) do not load for a mod without a `show` permission for their host, while the other covers of the same host do.

After the URL parser, a path can also hold `[`, `]` and `|`, which a policy source cannot hold either, so such links are left out the same way, as in `photo[1].jpg`. `|` also differs between engines: Chromium's URL parser writes it as `%7C`, so a link with `|` loads in Chromium and is left out in Firefox and WebKit.

Browsers compare the path of a policy source percent-decoded, so the address can be written with `,` as `%2C`, `;` as `%3B`, `[` as `%5B`, `]` as `%5D` and `|` as `%7C`. On 2026-10-31, with Playwright in Chromium, Firefox and WebKit, a page whose policy has `img-src https://img.example.net/a/b%2Cc.png` loaded `https://img.example.net/a/b,c.png`, `%3B` likewise loaded a path with `;`, and another file of the same host stayed blocked. On 2026-11-07 the same check with `%5B`, `%5D` and `%7C` loaded the file in the three browsers, and another file of the same host stayed blocked.

## What Changes

- A tile link whose path has `,`, `;`, `[`, `]` or `|` allows its file, whether it is a metadata string or a media address of the tile's body: the policy source holds the path with these written as `%2C`, `%3B`, `%5B`, `%5D` and `%7C`. The mod still requests the address as the tile wrote it, and the source still allows only that file.
- Such links are no longer reported as addresses the sandbox cannot allow. The other links the policy cannot express stay left out and reported as today: a user name or password, an IPv6 host and a host name with other characters. No path the URL parser gives is left out any more.
- A link with `|` is allowed the same way in Chromium, Firefox and WebKit.
- The two sample covers with commas load for a mod without `show` permissions while "Load media linked by tiles" is on.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `mod-sandbox`: "A tile link allows only the linked file" allows paths with `,`, `;`, `[`, `]` and `|`, written percent-encoded in the policy, and gains the scenarios of a comma, brackets and a vertical bar, and another file next to a link with a comma. "Tile links the sandbox cannot express" adds `,`, `;`, `[`, `]` and `|` to the path characters a policy can express, and its "Semicolon in the path" scenario now loads the file.

## Impact

- **Code**: `collectTileLinks` in `src/lib/core/sandbox/tile_links.ts`, which judges metadata strings and body media addresses alike (`judgeTileLink`). Nothing else builds tile link sources: the launch and "Reload tiles" get them through `collectModTileLinks` in `src/lib/core/engine/mod_tile_bodies.ts`, and the policy (`buildSandboxPolicy`) and the reload comparison in `src/lib/core/stage/stage_sandboxes.ts` take them as they are.
- **Tests**: unit tests in `src/lib/core/sandbox/tile_links.test.ts`, and e2e tests in `e2e/mod_sandbox.spec.ts` run in the three browsers.
- **Docs**: "Media linked by tiles" and "What the policy cannot express" in `docs/modules/lib/core/sandbox/README.md`.
- **Mod API version**: none. Tile links are a sandbox policy matter: the mount context, the tiles a mod receives, methods, events and the mod file format do not change.
- **App version**: patch bump while the app is `0.x`: links that were refused now load, and nothing breaks.
- **Out of scope**: the other links the policy cannot express (credentials, IPv6 hosts, other host characters). Links that redirect to another site stay blocked.
