# Proposal

## Why

As the window narrows, the stage bar folds its capsules into one before the sidebar makes room, and then unfolds them at 768px, when the sidebar leaves the layout. In Firefox, with the 240px sidebar expanded, the capsules fold from 870px to 768px, and a narrower window shows more of them. `add-mosaic-editing`'s edit button widens that range: the bar now folds at about 620px instead of 580px. The sidebar should make room first, so the capsules fold only when nothing else can give way.

## What Changes

- **The main area keeps at least 784px beside the expanded sidebar.** The expanded sidebar is at most 400px wide and at most the viewport's width minus 784px, and at least 200px. This replaces the cap of 40% of the viewport, which never binds once the main area keeps 784px.
- **Compact viewports, from 768px to 983px**, where even 200px would leave less than 784px: a sidebar stored as expanded shows its icon rail. A collapsed or hidden one stays as stored. The user can still expand it inline, at 200px. Nothing done on a compact viewport is stored, as on a narrow one, and a viewport at least 984px wide restores the stored layout.
- The sidebar's state depends only on the viewport's width and the stored layout, never on what the stage bar holds, so it never moves when the user opens another mosaic, and never goes back and forth while the window is resized.
- Viewports narrower than 768px are unchanged. The stage bar is unchanged: its capsules get the room because the main area keeps it.

**Phones and color schemes:** a phone viewport is narrower than 768px, where the sidebar is a drawer over the content and nothing changes. The change adds no colors. The rail looks as it does when the user collapses it.

**Mod API:** no bump. Mods see only their frame, which gets wider, as it does when the user collapses the sidebar.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `app-sidebar`: the expanded sidebar's width keeps the main area at least 784px wide, and on compact viewports, from 768px to 983px, the stored expanded sidebar shows its rail without storing it.

## Impact

- **Code**:
  - `src/main/sidebar/sidebar_layout.ts` gets the main area's cap and the compact mode, an unstored layout like the narrow one.
  - `src/main.tsx` passes the compact viewport's media query to the sidebar's layout.
- **Docs**: the sidebar section of `docs/modules/main/README.md`.
- **Depends on** `add-mosaic-editing`, whose edit button and fold widths it builds on.
- **Release**: a patch changeset.
- **Out of scope**: changing the stage bar's fold, hiding the sidebar entirely, and changing viewports narrower than 768px.
