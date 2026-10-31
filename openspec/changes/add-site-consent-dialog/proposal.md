# Proposal

## Why

Mods from other origins get none of their declared permissions, because a link to a mod on another site can come from anyone. A mod that needs covers from `https://covers.example.net` cannot show them, even when the user would gladly allow it. The permissions module was written for a future permission prompt: its denial messages already say "for now", and its verbs ("show content from", "embed pages from") were chosen for it.

Asking in one clear dialog, rarely, and remembering the answer keeps the default smooth: mod authors declare what they need, and the user decides only what needs judgment.

## What Changes

- **The spike on embeds in the sandbox is done, and embeds from tiles leave this change.** In Chromium, Firefox and WebKit, YouTube, youtube-nocookie and the SoundCloud widget play in a normal page, but none plays inside a frame like a mod's (`sandbox="allow-scripts"`, the app's policy with the player's site granted as `embed`). The cause is the sandbox's opaque origin, not the policy: the same frame without the sandbox, or with `allow-same-origin`, plays. Vimeo did not play even in a normal page, so its result is unknown. Repeated on 2026-10-31 with the same result. Showing players for tiles becomes a change of its own, in which the app shows the player outside the mod's frame.
- **The dialog**:
  - It is shown by the app, outside every frame, before a mod's frame starts, as the question for a mod written for another API is today, and only when something needs consent.
  - It lists one line per site and category, with the verb of the category, the mod's `reason` for it, and one sentence on the cost: these sites see that you viewed this content.
  - **Allow** grants the checked lines. **Show without them** runs the mod as it runs today. A **Remember** choice keeps the decision per site and category.
- **What it asks about**: the permissions declared by a mod from another origin. It never asks about what is allowed without asking (content hosts, permissions of mods from the app's origin, media linked by tiles).
- **Remembered sites in Settings**: a new group lists the remembered decisions and lets the user remove each one.
- **Checks and inspection never ask**: a mod check and `mods.inspect` use the remembered decisions and treat everything else as not granted, so they never show the dialog.

## Capabilities

### New Capabilities

- `site-consent`: when the app asks the user about sites, what the dialog lists and says, how answers are applied to a mod's start, and how remembered decisions are kept and removed.

### Modified Capabilities

- `mod-sandbox`: a mod from another origin gets the permissions the user allowed, instead of none.
- `app-settings`: a new group lists remembered site decisions and removes them.

## Impact

- **Code**:
  - `src/lib/core/permissions/`, the one place for trust decisions: the grants of foreign mods follow the user's answers and the remembered decisions;
  - the launch sequence in `src/lib/core/engine/mod_launch.ts` and `src/lib/core/stage/`: the dialog before the frame;
  - the dialog component in `src/main/stage/`;
  - `src/main/settings/SettingsPage.tsx` and the app's settings storage.
- **Tests**:
  - unit tests of the grants with remembered decisions and of what the dialog lists;
  - e2e tests that a foreign mod's allowed host loads, that "Show without them" runs it as today, that a remembered decision skips the dialog, that removing it in Settings asks again, and that a check never shows the dialog.
- **Docs**: `docs/modules/lib/core/permissions/README.md` (the site-owner rule, the denial messages, which lose their "for now"), the sandbox README's grants, and the settings docs.
- **Mod API version**: none expected. Allowing a foreign mod's permissions fills the `granted` list of the mount context's `permissions`, which already exists, and adds no method, event, context key or mod file key; existing mods keep working. The design confirms it.
- **App version**: patch bump while the app is `0.x`, at least as much as the mod API.
- **Open questions for the design**:
  - which categories a foreign mod may be granted, `code` and `connect` included;
  - whether a remembered decision applies to every mod or only to the mod that asked.
- **Out of scope**:
  - embedded pages found in tiles: moved to a change of its own, with tile bodies rendered by the engine and players shown by the app in a dialog, outside the mod's frame. That change may reuse the remembered decisions of this one;
  - `frame-src` grants for tiles, a proxy for embedded pages, and mod frames on a separate origin;
  - asking about media linked by tiles, which loads without asking and is governed by the "Load media linked by tiles" setting.
