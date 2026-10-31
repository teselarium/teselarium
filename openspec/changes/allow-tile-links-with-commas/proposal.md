# Proposal

## Why

A tile can link an image, video or audio file whose address has a comma or a semicolon in its path, such as `https://upload.wikimedia.org/wikipedia/en/a/ae/Bob_Dylan_Chronicles,_Volume_1.jpg`. Today such a link is left out with the warning "the sandbox cannot allow this address", because `,` separates policies and `;` separates directives in a Content-Security-Policy, so the address cannot be written into the frame's policy as it is. Commas are common in file names: two covers of the shipped sample collection `public/samples/tiles/literature_nobel_laureates_books/` (`Bob_Dylan_Chronicles,_Volume_1.jpg` and `Human_Acts,_cover.png`) do not load for a mod without a `show` permission for their host, while the other covers of the same host do.

Browsers compare the path of a policy source percent-decoded, so the address can be written with `,` as `%2C` and `;` as `%3B`. On 2026-10-31, with Playwright in Chromium, Firefox and WebKit, a page whose policy has `img-src https://img.example.net/a/b%2Cc.png` loaded `https://img.example.net/a/b,c.png`, `%3B` likewise loaded a path with `;`, and another file of the same host stayed blocked.

## What Changes

- A tile link whose path has `,` or `;` allows its file: the policy source holds the path with `,` written as `%2C` and `;` as `%3B`. The mod still requests the address as the tile wrote it, and the source still allows only that file.
- Such links are no longer reported as addresses the sandbox cannot allow. The other links the policy cannot express stay left out and reported as today: a user name or password, an IPv6 host, a host name with other characters, and a path with `|`, `[` or `]`, which were not tested.
- The two sample covers with commas load for a mod without `show` permissions while "Load media linked by tiles" is on.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `mod-sandbox`: "A tile link allows only the linked file" allows paths with `,` and `;`, written percent-encoded in the policy, and gains the scenarios of a comma and of another file next to such a link. "Tile links the sandbox cannot express" no longer counts `,` and `;` among the path characters a policy cannot express: its "Semicolon in the path" scenario now loads the file, and a new "Vertical bar in the path" scenario shows a character still left out.

## Impact

- **Code**: `collectTileLinks` in `src/lib/core/sandbox/tile_links.ts`. Nothing else builds tile link sources: the policy (`buildSandboxPolicy`) and the reload comparison in `src/lib/core/stage/stage_sandboxes.ts` take them as they are.
- **Tests**: unit tests in `src/lib/core/sandbox/tile_links.test.ts`, and an e2e test in `e2e/mod_sandbox.spec.ts` run in the three browsers.
- **Docs**: "What the policy cannot express" in `docs/modules/lib/core/sandbox/README.md`.
- **Mod API version**: none. Tile links are a sandbox policy matter: the mount context, the tiles a mod receives, methods, events and the mod file format do not change.
- **App version**: patch bump while the app is `0.x`: links that were refused now load, and nothing breaks.
- **Out of scope**: `|`, `[` and `]` in paths, and the other links the policy cannot express. Links that redirect to another site stay blocked.
