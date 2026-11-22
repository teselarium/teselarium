# Proposal

## Why

As the window narrows, the stage bar folds its capsules into one before the sidebar makes room, and then unfolds them at 768px, when the sidebar leaves the layout. In Firefox, with the 240px sidebar expanded, the capsules fold from 870px to 768px, and a narrower window shows more of them. `add-mosaic-editing`'s edit button widens that range: the bar now folds at about 620px instead of 580px. The sidebar should make room first, so the capsules fold only when nothing else can give way.

## What Changes

- **The sidebar steps aside for the stage bar.** On a viewport at least 768px wide, when the stage bar's capsules no longer fit beside its other items and the sidebar is expanded, the sidebar shows its icon rail instead. The capsules fold only if they still don't fit beside the rail.
- **Only while the window narrows, or when the app opens.** Opening another mosaic, a sidebar action by the user, or a drag of the resize handle never makes it step aside, so the sidebar never moves under the user, and the user's choice always wins.
- **Temporary.** The stored layout stays expanded, and a reload starts from it. The sidebar is expanded again once the window has widened by the room the rail gave, so it never goes back and forth while the window is resized. Expanding it with its button, `Ctrl+B` or a drag ends the step aside at once, and the bar then folds as before.
- A collapsed or hidden sidebar, and every viewport narrower than 768px, are unchanged.

**Phones and color schemes:** a phone viewport is narrower than 768px, where the sidebar is a drawer over the content and nothing changes. The change adds no colors. The rail looks as it does when the user collapses it.

**Mod API:** no bump. Mods see only their frame, which gets wider, as it does when the user collapses the sidebar.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `app-sidebar`: the expanded sidebar steps aside to its rail for the stage bar, without storing it, and comes back when the window is wide enough or when the user expands it.
- `stage-bar`: before its capsules fold because they don't fit, the bar asks the sidebar for room.

## Impact

- **Code**:
  - `src/main/sidebar/sidebar_layout.ts` gets the step-aside state, which is not stored, and its rules.
  - `src/main/stage/use_narrow_stage_bar.ts` and `StageBar.tsx` report a fold because the capsules don't fit.
  - `src/App.tsx` passes that report from `StageView` to the sidebar's layout.
- **Docs**: the sidebar and stage bar sections of `docs/modules/main/README.md`.
- **Depends on** `add-mosaic-editing`, whose edit button and fold widths it builds on.
- **Release**: a patch changeset.
- **Out of scope**: hiding the sidebar entirely, and stepping aside on viewports narrower than 768px.
