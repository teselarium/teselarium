# Design

## Context

`collectTileLinks` (`src/lib/core/sandbox/tile_links.ts`) turns each linked URL into one exact policy source, `url.origin + url.pathname`, after `canExpressLink` checked that the path only has the characters of `SOURCE_PATH_PATTERN`: RFC 3986 `pchar`s and `/`, without `;` and `,`. The same `judgeTileLink` also judges the media addresses of each tile's rendered body (images, video, audio, `<source>` elements, posters and `srcset` candidates), which `collectTileLinks` receives as `bodyMedia` from `scanTileBody`'s `mediaUrls`, so a source built here applies to them too. The launch and "Reload tiles" get the sources through `collectModTileLinks` (`src/lib/core/engine/mod_tile_bodies.ts`); they go into `img-src` and `media-src` as written (`buildSandboxPolicy`), and "Reload tiles" compares the reloaded sources with the launch's as strings (`readReloadedTileLinkIssues` in `src/lib/core/stage/stage_sandboxes.ts`).

The URL parser percent-encodes most characters a source cannot hold (spaces, quotes, `^`, `{`, `}`, non-ASCII), but leaves `,`, `;`, `[` and `]` in a path as they are in every engine (`new URL("https://media.example.net/a;b.jpg").pathname` is `/a;b.jpg`), and `|` in Firefox, WebKit and Node, while Chromium writes it as `%7C`. The browser requests the address the mod uses as it parses it.

The CSP path matching of the three engines compares percent-decoded paths: see proposal.md, Why, for the checks made in Chromium, Firefox and WebKit.

## Goals / Non-Goals

**Goals:**

- The source of a link with `,`, `;`, `[`, `]` or `|` is built in the one place that builds tile link sources, so the policy, the reload comparison and the tests see the same string.
- The same links are allowed in Chromium, Firefox and WebKit.

**Non-Goals:**

- Changing the tile's metadata or the address the mod receives: the mount context keeps the URL as the tile wrote it.
- Encoding any other character: the URL parser already percent-encodes the rest, `^` included, in the three engines.

## Decisions

### D1. Encode `,`, `;`, `[`, `]` and `|` when building the source, then check it

The source becomes `url.origin + encodeSourcePath(url.pathname)`, where `encodeSourcePath` replaces every `,` with `%2C`, `;` with `%3B`, `[` with `%5B`, `]` with `%5D` and `|` with `%7C`, and nothing else. A `%7C` already in Chromium's `pathname` stays as it is, since `%` is not touched, so every engine builds the same source. `canExpressLink` checks the encoded path against the existing pattern, which already allows `%`, so the pattern itself does not change and stays the single list of what a source path may hold.

*Alternative*: add the five characters to the pattern and encode afterwards. Rejected: the pattern would then describe the tile's path rather than the source's, and a later edit could drop the encoding while the check still passed.

*Alternative*: rewrite the link in the tile's metadata to the encoded address. Rejected: tiles reach the mod as written (see Non-Goals), and a server may not treat `%2C` like `,`, so the mod's request must stay the tile's address.

### D2. A link written both ways is one source

`https://media.example.net/a,b.jpg` and `https://media.example.net/a%2Cb.jpg` give the same source, and so do `https://media.example.net/a|b.jpg` and `https://media.example.net/a%7Cb.jpg`; `sortSources` keeps one. The browser matches both requests against it, which is what both links ask for.

## Risks / Trade-offs

- [An engine stops decoding policy paths, or decodes them differently] → The e2e tests of the comma, the semicolon and the brackets with the vertical bar run in Chromium, Firefox and WebKit, so a regression fails the suite.
- [A source could allow more than the linked file] → Decoding `%2C`, `%3B`, `%5B`, `%5D` and `%7C` gives back only `,`, `;`, `[`, `]` and `|`, never `/` or a wildcard, so the source still names one path; the scenario "Other file next to a link with a comma" checks it in the browser.
- [The source no longer equals `origin + pathname`] → `TileLinks.sources` and the sandbox README say that these five characters are written percent-encoded.

## Migration Plan

None: the policy is built when a mod starts. Mods started after the update allow these links; rolling back leaves them out again.
