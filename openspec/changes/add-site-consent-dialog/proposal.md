# Proposal

## Why

Two kinds of content still need a person to decide whether a site may be used:

- **Mods from other origins**: they get none of their declared permissions, because a link to a mod on another site can come from anyone. A mod that needs covers from `https://covers.example.net` cannot show them, even when the user would gladly allow it. The permissions module was written for a future permission prompt: its denial messages already say "for now", and its verbs ("show content from", "embed pages from") were chosen for it.
- **Pages embedded from tiles**: a tile that links a YouTube video should be easy to show. Media linked by tiles (`allow-tile-linked-media`) covers files, but an embedded page runs the site's own scripts and cookies. That is a trust decision the reader can make ("do I trust youtube.com?") and the app should not make silently.

Asking in one clear dialog, rarely, and remembering the answer keeps the default smooth: mod authors declare what they know, tile authors link freely, and the user decides only what needs judgment.

## What Changes

- **Step one, a spike on embeds in the sandbox**: mod frames are `sandbox="allow-scripts"`, and a frame inside them inherits that sandbox, so an embedded player runs with an opaque origin, without cookies, storage or popups. Before any embed design, a spike checks in Chromium, Firefox and WebKit whether YouTube, Vimeo and one audio player play inside a mod frame with `frame-src` allowing them. Its result decides the embed part of this change:
  - **They play**: the dialog can offer "embed pages from youtube.com" for embeds found in tiles.
  - **They do not**: embeds from tiles leave this change. The options are a click-to-open card with `links.open` (works today), embeds the app renders over a box the mod reserves, or mod frames on a separate origin. Each is a change of its own. The dialog still covers mods from other origins.
- **The dialog**:
  - It is shown by the app, outside every frame, before a mod's frame starts, as the question for a mod written for another API is today, and only when something needs consent.
  - It lists one line per site and category, with the verb of the category, where the line comes from (the mod and its `reason`, or the number of tiles), and one sentence on the cost: these sites see that you viewed this content.
  - **Allow** grants the checked lines. **Show without them** runs the mod as it runs today. A **Remember** choice keeps the decision per site and category.
- **What it asks about**:
  - the permissions declared by a mod from another origin;
  - if the spike allows it, embedded pages found in tiles.

  It never asks about what is allowed without asking (content hosts, permissions of mods from the app's origin, media linked by tiles), and never offers what tiles cannot grant (code, data exchange, private network addresses from public tiles).
- **Remembered sites in Settings**: a new group lists the remembered decisions and lets the user remove each one.
- **Checks and inspection never ask**: a mod check and `mods.inspect` use the remembered decisions and treat everything else as not granted, so they never show the dialog.

## Capabilities

### New Capabilities

- `site-consent`: when the app asks the user about sites, what the dialog lists and says, how answers are applied to a mod's start, and how remembered decisions are kept and removed.

### Modified Capabilities

- `mod-sandbox`: a mod from another origin gets the permissions the user allowed, instead of none; with the spike's positive result, `frame-src` gets the embed sites the user allowed for tiles.
- `app-settings`: a new group lists remembered site decisions and removes them.
- `mod-engine-api`: only if the design adds sites allowed for tiles to the mount context's `permissions`; otherwise unchanged.

## Impact

- **Code**:
  - `src/lib/core/permissions/`, the one place for trust decisions: the grants of foreign mods follow the user's answers and the remembered decisions;
  - the launch sequence in `src/lib/core/engine/mod_launch.ts` and `src/lib/core/stage/`: the dialog before the frame;
  - the dialog component in `src/main/stage/`;
  - `src/main/settings/SettingsPage.tsx` and the app's settings storage.
- **Tests**:
  - unit tests of the grants with remembered decisions and of what the dialog lists;
  - e2e tests that a foreign mod's allowed host loads, that "Show without them" runs it as today, that a remembered decision skips the dialog, that removing it in Settings asks again, and that a check never shows the dialog;
  - with the spike's positive result, an e2e test of an allowed embed.
- **Docs**: `docs/modules/lib/core/permissions/README.md` (the site-owner rule, the denial messages, which lose their "for now"), the sandbox README's grants and policy, and the settings docs.
- **Mod API version**: none or patch, decided in the design. Allowing a foreign mod's permissions fills lists that already exist in the mount context's `permissions`, so existing mods keep working. Adding the sites allowed for tiles to the mount context would be an addition to `mod-engine-api`, and a patch bump.
- **App version**: patch bump while the app is `0.x`, at least as much as the mod API.
- **Depends on**: the spike, before the design; `allow-tile-linked-media`, whose URL collection and private network guard the embed part reuses.
- **Open questions for the design**:
  - how embeds are found in tiles: a table of known providers that maps page links (`youtube.com/watch?v=…`) to embed addresses, or tile authors linking embed addresses;
  - which categories a foreign mod may be granted, `code` and `connect` included;
  - whether a remembered decision applies to every mod or only to the mod that asked.
- **Out of scope**:
  - a proxy for embedded pages;
  - mod frames on a separate origin;
  - asking about media linked by tiles, which loads without asking and is governed by the "Load media linked by tiles" setting.
