# Design

## Context

See proposal.md (Why). The required behavior is in specs/app-sidebar, specs/app-settings, specs/app-pages, specs/mod-stage, specs/default-mods and specs/theme. This change is applied after `adopt-ui-stack` is archived: it uses its Tailwind entry, its vendored shadcn zone, the renamed `--ot-*` tokens, the semantic base stylesheet and `THEME_FRAME_STYLES`. The `theme` delta's "The app follows the color scheme" is written against the version `adopt-ui-stack` leaves.

Current state:

- **Stage state** (`src/lib/core/stage/stage_state.ts`): `StageState` holds `sandboxes` (creation order) and `entries` (`{ position, sandboxId }`) and `position`. `openStageEntry` drops forward entries and closes unreachable sandboxes (`keepReachedSandboxes`). `restoreStageEntry` shows the entry's sandbox, or opens a new one from the hash after a reload. `closeStageSandbox` points the current entry to the opener, or opens a new home sandbox. Several entries may already point to one sandbox, since `closeStageSandbox` re-points the current entry.
- **Routes** (`stage_history.ts`, `run_links.ts`): `readStageRoute(hash, homeMod)` returns a run route, or the home mod at `#/` for every other hash. The history state is `{ opentesela: { position } }`.
- **Controller** (`stage_controller.ts`): `followHistory` (start and `popstate`), `openStageLink` (`mods.open`), `closeSandbox`. A typed address or a link followed in the page has no stage state, so it opens at the next position and the entry is replaced with its position. `SandboxSnapshot.canClose` is `!isHome`. `Stage.defaults.home` comes from `DefaultModSettings.home`.
- **App** (`App.tsx`): `AppHeader` (heading and Theme control) above `StageView`. `StageView` must never unmount, because unmounting or moving an iframe reloads it.
- **Default mod settings**: `findSwitchedOffMod(source, resolvedDefaults)` and `resolveModReference` are exported, so the app can tell whether a section's mod is switched off.
- **Files**: `fetchFile` and `parseMarkdown` (gray-matter: front matter and body) exist in `src/lib/files`.
- **Tests**: 20 e2e tests `goto("/")` and expect the mod explorer (`app.spec.ts`, `app_theme.spec.ts`, `default_mods.spec.ts`, `mod_sandbox.spec.ts`, `mod_stage.spec.ts`, `mod_theme.spec.ts`).

## Goals / Non-Goals

**Goals:**

- One owner of the browser history: the stage. Pages and sandboxes are both stage entries, so back, forward, reload and dropping forward entries keep their tested rules.
- The stage lib stays generic. It sees page ids, a Home target and section links as plain data, never the sidebar registry, icons or markdown.
- The registry is the single place an instantiation edits to add, remove or change a section. The later HTML init will build the same value.
- Pages look exactly like mods, by reusing the frame styles, not by copying them.

**Non-Goals:**

- The HTML init API, a guide index UI, and sub-lists in the sidebar.
- Caching page files beyond the browser's HTTP cache.
- Shortcuts that work while focus is inside a mod's frame. The frame gets the keystrokes, which is the sandbox working as intended.

## Decisions

### D1. Module layout

```
src/lib/core/stage/
  stage_state.ts       # entries point to a view (sandbox | page) and carry a section (D2, D3)
  stage_routes.ts      # readStageRoute for #/run, #/<section>[/<page>], Home (D2). Replaces the route part of stage_history.ts
  stage_history.ts     # history state { position, section }
  stage_sections.ts    # section memory: root and last view per section (D3)
  stage_controller.ts  # followHistory, openStageLink, openStageSection, closeSandbox; snapshot.visible/activeSection
src/main/
  sections/
    section_registry.ts   # SectionDefinition, validateRegistry, availableSections (D5)
    vanilla_sections.ts   # the vanilla registry: the file to edit when cloning
    section_switches.ts   # user switches in storage, external-store style like app_theme (D10)
  sidebar/
    sidebar_layout.ts     # state machine + storage (D6)
    Sidebar.tsx, SidebarItem.tsx, SectionIcon.tsx, SidebarResizeHandle.tsx, HamburgerButton.tsx (D7)
  pages/
    PageView.tsx          # which page to show: markdown or settings (D8)
    MarkdownPage.tsx      # fetch, sanitize, render in a shadow root (D9)
    page_links.ts         # link and image rules (D9)
    page_sanitize_schema.ts
  settings/
    SettingsPage.tsx      # Appearance + Sidebar cards (D10)
  App.tsx, AppHeader.tsx  # layout (D8), hamburger in the header
public/pages/{home,guides,about}/index.md
```

Imports keep their direction: `src/main` → `src/lib/core/stage` and `src/lib/core/theme` and `src/lib/files`. `src/lib` never imports `src/main`.

### D2. Stage entries, routes and options

```ts
type EntryView =
  | { kind: "sandbox"; sandboxId: string }
  | { kind: "page"; section: string; page: string | null };  // null = index

interface StageEntry { position: number; view: EntryView; section: string | null }
interface StageSandbox { id; hash; link; openerId; section: string | null; isHomeMod: boolean }

interface StageOptions {
  // ...existing, minus defaults.home
  routing: {
    pageSections: readonly string[];        // ids whose target is a page
    home: { kind: "page"; section: string } | { kind: "mod"; link: RunLink };
    sectionLinks: readonly { section: string; link: RunLink }[];  // exact-match membership
  };
}
```

- **Routes.** `readStageRoute(hash, routing)` returns one of three things:
  - **run:** `#/run?mod=…` with a non-empty `mod`;
  - **page:** `#/<id>` or `#/<id>/<name>`, when `<id>` is in `pageSections` and `<name>` matches `[A-Za-z0-9_-]+`. `#/home`'s canonical address is `#/`;
  - **home:** everything else.

  Run routes keep today's parsing. The page name check happens before any file is built from it, so `..`, `/` and encoded variants never get through.
- **Pages get their own hash.** A page entry's hash is `#/<section>` or `#/<section>/<page>`, and `#/` for the Home page.
- **Section is stored with the position.** The history state becomes `{ opentesela: { position, section } }`. `readHistoryPosition` keeps reading `position`, and `readHistorySection` reads `section` (a string or `null`, anything else counts as `null`).
- **What the snapshot shows.** It gains `visible: { kind: "sandbox"; id } | { kind: "page"; section; page } | null` and `activeSection: string | null`.
- **`StageView` doesn't change.** It renders sandboxes as today and shows the stage bar only for a visible sandbox.
- **The Home mod is a fallback.** When `home.kind === "mod"`, `#/` opens a sandbox with `isHomeMod: true`, exactly as today's home mod does (no ×).

Alternatives considered: B, an app router outside the stage; C, pages as mods; D, Settings as an overlay. All three were rejected in explore. B means two writers on one history. C can't reach app state. D is a special case that still needs routes for the other pages.

### D3. Section membership and tab-bar navigation

**Membership** (specs/app-sidebar "Active section"):

- `openStageSection` sets the section.
- `openStageLink` (`mods.open`) copies the opener's section.
- `followHistory` for an entry without stage state (typed address or followed link): a page route belongs to its page section. A run route belongs to the section whose `sectionLinks` entry deep-equals the link, or to `null`.
- `followHistory` for an entry with stage state uses the stored section, so membership survives a reload.

**Section memory** (`stage_sections.ts`). Derived and updated on every change, never stored in the browser:

```
sectionMemory: Map<sectionId, { root: sandboxId | null, last: EntryView | null }>
  root: the sandbox openStageSection opened for the section's mod link
        (or, after a reload, the restored sandbox whose link equals it)
  last: the view of the latest entry shown that belongs to the section
  on close / unreachable: any root or last pointing to a closed sandbox -> null
```

**`openStageSection(stage, section)`**, where `section` is `{ id, start: page | link }`:

```
current = section of the visible entry
if current == id or memory.last is null:      target = start
else:                                          target = memory.last
start for a page section  = page view (section, index)
start for a mod section   = root sandbox if open, else a NEW sandbox (becomes root)
push a new entry at position + 1 pointing to target (dropping forward entries,
closing unreachable sandboxes as openStageEntry does), with section = id,
hash = target's hash
```

Pointing a new entry to an existing sandbox reuses the existing rule that several entries may point to one sandbox. A sandbox is closed only when no entry reaches it. Repeated visits therefore keep one explorer (spec "One explorer for repeated visits").

Alternatives considered: always fresh (option 1), where live frames grow with every click, and one root without "last" (option 2), which loses the user's place. Chosen in explore: option 3.

### D4. Closing

`canClose` becomes `!sandbox.isHomeMod`. When there's no open opener, `closeStageSandbox` falls back to the Home target. For a Home page it points the current entry to a page view `home` with hash `#/` and the section `home`. For a Home mod it opens a home sandbox as today. The current history entry is replaced, as today.

### D5. Section registry

```ts
type SectionIcon =
  | { lucide: LucideIcon }
  | { image: string; tint?: boolean };   // relative to the app, tint defaults to true

type SectionTarget =
  | { page: true }                        // pages/<id>/
  | { mod: RunLink };                     // e.g. { mod: "mod_explorer", collection: null, params: {} }

interface SectionDefinition {
  id: string; label: string; icon: SectionIcon; target: SectionTarget;
  group: "main" | "footer"; optional: boolean; comingSoon: boolean;
}
```

- **Validation runs before the stage is created.** `validateRegistry(sections)` checks the id pattern, reserved `run`, duplicates, a `home` section whose target is the Home target, and that an optional section isn't the Home, Settings or About section. It returns errors that name the section. `main.tsx` renders a plain error screen with them instead of the app, because a broken registry is a dev mistake that should fail loudly.
- **Home and Settings are found by id.** `home` is the section shown at `#/`. A dev who wants a mod at `#/` sets `home`'s target to a mod. `settings` is a page section whose page is the Settings component instead of markdown (D8).
- **The vanilla icons are lucide icons:** `House`, `LayoutGrid` (Tiles), `Puzzle` (Mods), `Shapes` (Mosaics), `BookOpen` (Guides), `Settings`, `Info` (About).
- **Switched-off filtering.** `availableSections(registry, resolvedDefaults, baseUrl)` drops a section whose mod target resolves (`resolveModReference`) to a switched-off default mod (`findSwitchedOffMod`). The result feeds both the stage's `routing` and the sidebar.
- **User switches only filter the sidebar.** They're applied after that, in the sidebar view, so a hidden section still routes and still records membership (specs/app-settings "Hidden sections keep working").
- **`DefaultModSettings.home` is removed.** `DEFAULT_MODS` keeps `folder` and `switchedOff`.

### D6. Sidebar layout state

```
                 collapse / drag < 160 / Ctrl+B
   EXPANDED(width) ------------------------------> COLLAPSED
        ^  <------------------------------------      |
        |       expand / Ctrl+B                       |
        |                                             |
        +-- hamburger --> HIDDEN(from) <-- hamburger -+
                            | hamburger / Ctrl+B -> back to `from`

stored (wide only): { state, from, width }   key: opentesela.sidebar
narrow (< 768px):   start COLLAPSED; expand = overlay drawer; nothing stored
```

- **Pure functions, external store.** `sidebar_layout.ts` holds pure transition functions plus an external store like `app_theme.ts`: listeners, a frozen snapshot, `useSyncExternalStore`.
- **Width.** Clamped to `[200, min(400, 0.4 * viewportWidth)]` and re-clamped when the window resizes.
- **Storage.** The stored value is validated, and anything invalid gives `{ expanded, 240 }`. Storage errors are swallowed, as for the theme choice.
- **Narrow viewports.** A `matchMedia("(max-width: 767.98px)")` query switches the mode. Entering narrow mode collapses the sidebar without storing. Leaving it restores the stored layout.
- **Keyboard.** `Ctrl/Cmd+B` is handled on `window` `keydown` when the target isn't an editable field. It calls `preventDefault`, because Firefox otherwise opens its bookmarks sidebar.

### D7. Sidebar view

- **Navigation.** `<nav aria-label="Sections">` with two lists (`main`, `footer`). Each available section is an `<a href>` with its start address (`#/`, `#/guides`, `#/run?mod=mod_explorer`). Its `onClick` calls `preventDefault` and `openStageSection`, so a normal click gets tab-bar behavior, while middle-click and "open in new tab" still work.
- **Current item.** `aria-current="page"` on the active section's item, when that section is shown in the sidebar.
- **Coming soon.** An `<a>` without `href`, `role="link"`, `aria-disabled="true"`, and the label "Coming soon" in its tooltip (always present) and as small text when expanded.
- **Icons.** `SectionIcon` renders a lucide component, or a `<span>` with `mask-image: url(...)` and `background-color: currentColor` for tinted images, or an `<img>` for `tint: false`. All icons are `aria-hidden`.
- **Built from shadcn parts** (component policy rule 2): `Button` for the collapse toggle, `Tooltip` around each item in the rail, `Separator` above the footer group, `Sheet` (side `left`) for the narrow drawer. The drawer reuses the same item list. Its focus handling and Escape come from Radix.
- **Colors.** The app-only `--sidebar*` aliases in `app.css` (from `adopt-ui-stack` D4): sidebar `card`, item hover `accent`, current item `accent` + `accent-foreground`, border `border`.
- **Resize handle.** `role="separator"`, `aria-orientation="vertical"`, `aria-valuemin`/`max`/`now`, `tabIndex=0`. Arrows change the width by 16px, and Enter toggles collapse.
  - A drag uses `setPointerCapture`. While dragging, the stage gets `pointer-events: none`, so a frame under the pointer can't take the events in browsers whose capture doesn't cross iframes.
  - Releasing below 160px collapses the sidebar and keeps the last valid width for the next expand.
- **Hamburger.** At the header's left, `aria-controls` the sidebar, `aria-expanded`, named "Hide sidebar" or "Show sidebar".

### D8. App layout and page view

```
+------------------------------------------------------------------+
| [=] OpenTesela                                     (AppHeader)   |
+-------------+----------------------------------------------------+
| Sidebar     | <main>                                             |
| (expanded:  |   PageView      (rendered only when a page shows)  |
|  width;     |   StageView     (always mounted; hidden while a    |
|  rail: 3rem;|                  page shows; stage bar + frames)   |
|  hidden: 0) |                                                    |
+-------------+----------------------------------------------------+
grid-template-columns: var(--sidebar-width) 1fr   (narrow: rail width;
the drawer is a Sheet overlay and never changes the column)
```

- **The stage stays mounted.** `StageView` keeps its position in the tree and uses the `hidden` attribute while a page shows, so no frame moves or reloads. `PageView` is a sibling before it.
- **`PageView`** takes `snapshot.visible` when it's a page, and renders `SettingsPage` for `settings` or `MarkdownPage` for any other page section.
- **Frame width.** The frame's width follows the `1fr` column, so resizing the sidebar resizes the frame without a reload. `mod-stage` "Frame beside the sidebar" checks this.

### D9. Markdown pages in a shadow root

```
<div class="page-host">            (light DOM, app styles, padding 0)
  #shadow-root (open)
    <style> THEME_FRAME_STYLES + PAGE_HOST_RULES </style>
    <div class="page-body">        (acts as <body>: padding, background, color, font)
      ...sanitized markdown HTML...
```

- **Why the full frame styles.** `THEME_FRAME_STYLES` (the token blocks plus the base stylesheet) is injected, not only the base stylesheet. The `:root` block is inert in a shadow root and tokens inherit from the document's `<html>`, but the `[data-ot-color-scheme="…"]` blocks are needed for color scheme sections inside pages.
- **The host adapter.** `PAGE_HOST_RULES` is a few lines in the `opentesela` layer that give `.page-body` what the base sheet gives `html`/`body` in a frame. These are the only class selectors, and they never leave the shadow root.
- **Rendering.** The shadow root is attached once in a `ref` callback, and the markdown tree renders into it with `createPortal`. The page needs no React event handlers inside: links are plain anchors, and navigation goes through the browser (hash links fire `popstate`, which the stage follows as a link followed in the page). That avoids depending on React's event delegation across shadow boundaries.
- **The pipeline.** `fetchFile(location)` → `parseMarkdown` (front matter dropped) → `react-markdown` with `remark-gfm`, `rehype-raw`, then `rehype-sanitize` with `page_sanitize_schema.ts`.
  - **The schema.** It starts from `hast-util-sanitize`'s default (GitHub's: `javascript:` and `data:` URLs are stripped, there's no `style`, no event handlers, and ids are prefixed). It adds `article`, `section`, `header`, `footer` and `aside`. `role` is allowed only as `alert` or `status`, `data-ot-variant` only on `span` with the six badge values, and `data-ot-color-scheme` only as `light` or `dark`. Sanitizing runs after `rehype-raw`, so raw HTML is sanitized too.
- **Links** (`page_links.ts`, pure and unit-tested). React-markdown's `urlTransform` and an `a` component map hrefs:

| href | becomes |
|---|---|
| `x.md`, `./x.md` (and `#frag`) | `#/<section>/x` (`index.md` → `#/<section>`) |
| `#/…` | unchanged (app address) |
| `http(s)://…` on another origin | unchanged, `target="_blank" rel="noopener noreferrer"` |
| other relative | resolved against the page file's URL |

- **Images.** Image `src` is resolved against the page file's URL.
- **Loading.** A fetch runs on each show, keyed by the page's file URL. A stale result is ignored if the user navigated meanwhile. Failures render a shadcn `Alert` outside the shadow root, naming the URL and the reason (the `FileFetchError` message).
- **Vanilla content.** `public/pages/{home,guides,about}/index.md`: a `# Home` (or Guides, About) heading and `<div role="status">This section is a work in progress.</div>`. The Home page also links to the Mods section, and to the theme docs for mod authors once they're published.

Alternatives considered (explore): Tailwind typography, a third look; a selector-rewritten copy of the base sheet, a build step plus layer juggling with preflight; pages as mods, heavy, and links would have to go through `mods.open`.

### D10. Settings page and section switches

- **The page.** A `SettingsPage` with two shadcn `Card`s: Appearance (the existing `ThemeControl`, moved from `AppHeader`), and Sidebar. The Sidebar card has one row per available section in sidebar order: icon, label, then "Always shown", or a `Switch` with a `Label`, plus "Coming soon" text where it applies.
- **The store.** `section_switches.ts` is an external store like `app_theme.ts`. Its key is `opentesela.sidebar-sections`, with the value `{ [sectionId]: boolean }`. On read, ids not in the available sections are dropped, the value is rewritten without them, and a missing id means on. Writes are best-effort.
- **No highlight while hidden.** The sidebar view intersects `snapshot.activeSection` with the shown sections. Hiding Mods un-highlights it, and showing it again re-highlights it, because the stage still knows the membership.

### D11. Testing

- **Unit (`lib`).**
  - `stage_routes` (every route kind, name checks, encoded `..`);
  - `stage_state` and `stage_sections` (page entries, `openStageSection` cases from the spec, membership, close fallback, unreachable pointers cleared);
  - `stage_history` (section in the state);
  - `page_links` (the link table).
- **Component (`app`, jsdom).**
  - `section_registry` validation;
  - `sidebar_layout` transitions and storage;
  - `section_switches`;
  - `Sidebar` (items, `aria-current`, coming soon, tooltips present in the rail);
  - `SettingsPage`;
  - `MarkdownPage` with a fake fetch (sanitizing scenarios, links, error). jsdom supports `attachShadow`.
- **e2e (Playwright).** Navigation, history, the frame beside the sidebar, resize by dragging over a frame, narrow viewport, storage, page look against a probe mod (same computed heading styles), and the sanitizer in a real browser. Playwright locators pierce open shadow roots.
- **Existing e2e.** Tests that `goto("/")` for the explorer move to `goto("/#/run?mod=mod_explorer")`. A helper `openModsSection(page)` covers the cases that go through the sidebar.

## Risks / Trade-offs

- [**BREAKING** for links: `#/` no longer opens the mod explorer.] → Old `#/` links land on Home, which links to Mods. Run links keep working unchanged.
- [Changing `#/` breaks about 20 e2e tests at once.] → A dedicated task moves them first, before the stage change, using `#/run?mod=mod_explorer`, which works both before and after.
- [Tab-bar navigation makes entries point to sandboxes opened earlier, so "close unreachable sandboxes" must stay correct.] → It already supports several entries per sandbox. Unit tests cover dropping forward entries after a section switch.
- [Section memory gets out of date when a sandbox closes or a reload loses memory.] → Memory is derived and cleared on close. After a reload, `last` is empty and `root` is re-learned from the first restored sandbox whose link matches, so the worst case is opening the section's start.
- [Pointer capture across iframes varies by browser.] → `pointer-events: none` on the stage while dragging. An e2e test drags across a frame.
- [Sanitizer schema mistakes would allow script injection into the app's origin.] → The schema extends GitHub's default instead of starting from scratch. Unit and e2e tests cover scripts, handlers, `style`, `javascript:` links and iframes. Pages are instantiation content from the app's own folder, not mod content.
- [React events in a portal inside a shadow root.] → Pages need none: links navigate natively.
- [`Ctrl+B` is taken by some browsers (the Firefox bookmarks sidebar).] → `preventDefault` when the app handles it. It doesn't work while focus is inside a mod frame, which is documented.
- [Markdown dependencies add to the bundle (react-markdown, remark/rehype, about 50 kB gzipped).] → Accepted. Code splitting is out of scope.
- [Ordering against `adopt-ui-stack`: both modify `theme` "The app follows the color scheme".] → This change is applied and archived after `adopt-ui-stack`, and its delta already contains that change's version plus the sidebar.

## Migration Plan

- **Order.** Apply after `adopt-ui-stack` is archived.
- **Data.** No migration. New storage keys start empty. `DefaultModSettings.home` is removed from the vanilla settings in the same change. Instantiations that cloned the repo and set `home` move that value to the `home` section's target.
- **Order of the tasks.** First move the e2e tests off `#/`. Then the stage lib (routes, entries, sections) with unit tests. Then the registry and the switches, the layout store, the sidebar and the header, the pages, Settings, and the docs.
- **Rollback.** Revert the change. The leftover storage keys are ignored by the old code.
