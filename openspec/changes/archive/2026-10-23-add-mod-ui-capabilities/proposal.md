# Proposal

## Why

The sandbox keeps mods safe by taking things away: a mod cannot open windows, start downloads, show browser dialogs or go fullscreen. Some of that is what makes a good interface: a link to a book's page, an "Export as CSV" button, "Delete this list?" before a destructive action, or a map or reader in fullscreen. Today a mod author has no way to do any of these, and the blocked calls fail silently (`confirm()` just returns `false`), so a mod looks broken without saying why.

Each capability has to come back without giving up what the sandbox protects. A mod must not open tabs that carry its data away, start downloads the user did not ask for, or show dialogs that look like they come from the app. The answer is to let the app do these things for the mod, in a dialog the app draws and that names the mod, and to explain clearly what stays blocked.

## What Changes

- **Fullscreen**: every mod frame allows fullscreen, so `element.requestFullscreen()` works after a click inside the mod, with the browser's own exit notice. The app leaves fullscreen when the visible mod changes.
- **App action dialog**: a dialog the app draws over the stage, outside every frame, that names the mod (its title and source) and asks the user to accept or cancel what the mod asked for. One dialog at a time: later requests wait their turn. When the asking mod stops being visible, is closed or stops, its requests are answered "no".
- **Open a link** (`links.open { url }`): asks the user to open an `http:` or `https:` address in a new tab, shown in full. Opening happens from the dialog's button, since a browser only opens a tab after a click in the app itself (a click inside a mod's frame does not count). The new tab gets no access to the app. Answers `true` or `false`.
- **Save a file** (`files.save { name, content, encoding, type }`): asks the user to save a file, showing its name and size. Text, or binary data as base64, up to 20 MB. Answers `true` or `false`.
- **Ask for a confirmation** (`ui.confirm { message, confirmLabel, cancelLabel }`): the app shows the message as plain text with the two buttons, and answers `true` or `false`.
- **Only the visible mod asks**: hidden mods get error `-32002`, like `mods.open`.
- **Blocked browser dialogs explain themselves**: `alert`, `confirm`, `prompt` and `print` keep returning what the browser returns when they are blocked, and each one used reports a warning issue once, pointing to `<dialog>` or `ui.confirm`.
- **Assets next to the mod**: images, media, fonts and stylesheets in the mod's own folder load by resolving their paths against `context.mod.source`, with no permission. This already works through the content hosts. This change makes it a documented contract.
- Update the sandbox, engine and stage module docs, with a short guide to modals in mods: `<dialog>` for anything inside the mod, `ui.confirm` for a confirmation the app vouches for.

## Capabilities

### New Capabilities

- `mod-app-actions`: actions a mod asks the app to perform for the user, outside its frame: opening a link, saving a file and asking for a confirmation. It covers the app action dialog and how it names the mod, the visible-mod rule, one dialog at a time, and answering "no" when the mod leaves.

### Modified Capabilities

- `mod-sandbox`: adds requirements for fullscreen, the reports of blocked browser dialogs, and assets next to the mod. Existing requirements are unchanged: the frame's sandbox still allows scripts only, since fullscreen is a frame permission (`allow="fullscreen *"`), not a sandbox flag.

## Impact

- **Order**: builds on `add-mod-theme`, which should be implemented first. The action dialog takes its look from the theme tokens, and both changes edit the frame loader, the session options, the stage and `src/main/stage/`. The two changes edit no requirement in common.
- **Changed code**:
  - `src/lib/core/sandbox/`: the frame loader replaces the blocked dialog functions and reports them, with a new `sandbox.dialogBlocked` notification and its reader.
  - `src/lib/core/engine/`: the action types and their param readers, handlers for `links.*`, `files.*` and `ui.*`, a session callback that hands an action to the stage, and the issue for a blocked dialog.
  - `src/lib/core/stage/`: the queue of actions per stage, the current action in the snapshot, answering an action, and answering "no" for a sandbox that is hidden, closed or stopped.
  - `src/main/stage/`: `SandboxFrame` allows fullscreen, the app leaves fullscreen when the visible sandbox changes, and a new `ActionDialog` component performs the accepted action (opening the tab, starting the download) inside its button's click.
- **Unchanged**: the content policy, the sandbox flags, the permission categories and the engine error codes. Every new request answers `true` or `false`, or uses the existing codes `-32602` and `-32002`.
- **Dependencies**: none.
- **Out of scope**:
  - opening links without a dialog, remembered choices, and a permission category for links. A browser only opens a tab after a click in the app, and a frame allowed to open its own tabs could send data to any site through the address;
  - `alert`, `confirm` and `prompt` drawn by the app, and `allow-modals`;
  - picking or reading the user's files, the clipboard, notifications and sharing;
  - loading code from the mod's folder (scripts still need `code`, and mods are bundled into one entrypoint);
  - code splitting.
