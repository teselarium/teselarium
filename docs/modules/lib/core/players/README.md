# Players Module

## Introduction

A video or audio player from a site such as YouTube does not play inside a mod's sandboxed frame, whose origin is opaque. So the app shows players itself, in a dialog of its own page, after asking the reader (see the [engine module](../engine/README.md) for `players.open`). This module knows which addresses are players of known sites, and what each one plays from.

### Known sites

| Site | Recognized | Plays from | Shape |
|---|---|---|---|
| YouTube | `youtube.com`, `www.youtube.com`, `m.youtube.com`, `youtu.be`, `youtube-nocookie.com`, `www.youtube-nocookie.com`: `/watch?v=<id>`, `/<id>` on `youtu.be`, `/embed/<id>`; `<id>` is 11 characters of `A-Za-z0-9_-` | `https://www.youtube-nocookie.com/embed/<id>` | 16:9 |
| Vimeo | `vimeo.com/<digits>`, `www.vimeo.com/<digits>`, `player.vimeo.com/video/<digits>` | `https://player.vimeo.com/video/<digits>` | 16:9 |
| SoundCloud | `soundcloud.com/<user>/<track>`, `soundcloud.com/<user>/sets/<name>` (and `www.`); the widget `w.soundcloud.com/player/?url=<page>` | the widget `https://w.soundcloud.com/player/` with `url` set to the page | 166 px high for a track, 450 px for a playlist |

Examples:

| Address | Plays from |
|---|---|
| `https://www.youtube.com/watch?v=aqz-KE-bpKQ&t=30` | `https://www.youtube-nocookie.com/embed/aqz-KE-bpKQ` |
| `https://www.youtube.com/embed/aqz-KE-bpKQ` | `https://www.youtube-nocookie.com/embed/aqz-KE-bpKQ` |
| `https://youtu.be/aqz-KE-bpKQ?si=share` | `https://www.youtube-nocookie.com/embed/aqz-KE-bpKQ` |
| `https://vimeo.com/1084537` | `https://player.vimeo.com/video/1084537` |
| `https://soundcloud.com/artist/track` | `https://w.soundcloud.com/player/?url=https%3A%2F%2Fsoundcloud.com%2Fartist%2Ftrack` |

- Only `https:` addresses count.
- The query of a page link or player address is dropped: a link cannot turn on autoplay or other player options, so `https://www.youtube.com/embed/aqz-KE-bpKQ?autoplay=1` plays from `https://www.youtube-nocookie.com/embed/aqz-KE-bpKQ`. A SoundCloud widget keeps only its `url`.
- Any other page of a known site, such as a channel, is not a player.

### Why YouTube plays in its privacy-enhanced mode

`youtube-nocookie.com` is YouTube's own player that sets no tracking cookies until the reader plays the video. The app asks before it loads the player anyway, and the question says the site sees the play: the privacy mode only reduces what happens after it.

### Other sites

The table only adds. An `https:` iframe of any other site, pasted into a tile's body, still plays from its own `src`, with the ratio of its `width` and `height` (16:9 without them). A site missing from the table only means that its page links, in a tile's metadata or as `![](…)` in a body, stay links and do not become players.

## Module Details

Implemented in `src/lib/core/players/`. Other modules import only from the public entry point `src/lib/core/players/index.ts`. Pure, with no DOM.

- `readPlayer(address)`: the `Player` of a page link or player address of a known site, or `null` for any other address.
- `readIframePlayer(src, width, height)`: the `Player` of a body's iframe with the absolute `https:` address `src`: the known site's when the table recognizes it, otherwise one that plays from `src`, with `siteName` `null` and the ratio of `width` and `height` (the attributes as written, or `null`).
- Types:
  - `Player`: `frameUrl` (what the player frame loads), `host` (the host of `frameUrl`, which the reader is asked about), `siteName` (`YouTube`, `Vimeo`, `SoundCloud` or `null`) and `shape`.
  - `PlayerShape`: `{ ratio }` (width over height) or `{ height }` in CSS pixels.

Example:

```ts
const player = readPlayer("https://youtu.be/aqz-KE-bpKQ");
// {
//   frameUrl: "https://www.youtube-nocookie.com/embed/aqz-KE-bpKQ",
//   host: "www.youtube-nocookie.com",
//   siteName: "YouTube",
//   shape: { ratio: 16 / 9 },
// }
```
