# Proposal

## Why

OpenTesela should look modern, clean and welcoming. Today the app is a few hand-written stylesheets on cool gray tokens, and every new piece of interface, such as the sidebar and the settings page planned next, would mean more hand-written CSS and hand-built accessible widgets. `docs/stack.md` already names Tailwind CSS, shadcn/ui and lucide-react, but none of them is installed. Adopting them now, before the sidebar change, gives that change consistent, accessible components to build on. Renaming the mod theme tokens is also cheapest now: the token API is days old, and every mod that uses it lives in this repository.

## What Changes

- **Stack**: add Tailwind CSS v4 (through its Vite plugin), shadcn/ui and lucide-react. The app's own interface is styled with Tailwind utilities and shadcn components instead of hand-written CSS.
- **Vendored zone**: the code the shadcn CLI generates lives in `src/vendor/shadcn/`, kept apart from the project's code. It is changed only by regenerating it, it is exempt from the project's code conventions and style lint rules (correctness rules still apply), and it never imports project code. Project code keeps every convention.
- **Component policy**: the app uses shadcn components by default, with three documented exceptions: elements that guard the app from mods stay native (the action dialog stays a native modal `<dialog>`), interface that no shadcn component fits is composed from shadcn parts, and where a native control works better, its native-styled variant is used (the Theme control stays a native `<select>`).
- **BREAKING** for mods: **theme tokens renamed to shadcn's role names**, keeping the `--ot-` prefix. For example `--ot-color-background` → `--ot-background`, `--ot-color-text` → `--ot-foreground`, `--ot-color-accent` → `--ot-primary`, `--ot-color-accent-text` → `--ot-primary-foreground`, `--ot-color-surface` → `--ot-card` / `--ot-muted`, `--ot-color-focus` → `--ot-ring`, `--ot-color-danger` → `--ot-destructive`, `--ot-font-body` → `--ot-font-sans`. New roles are added (`popover`, `secondary`, `accent` as a subtle hover color, `input`, and a `-foreground` for each surface and for `destructive`, which filled destructive buttons need). `--ot-warning` and `--ot-success` stay as the project's own roles. The tokens remain the only source of colors for both the app and the mods. shadcn's variables in the app are aliases of them.
- **Warm look**: new token values with a terracotta primary on warm stone neutrals, in light and dark, and a softer radius (`0.625rem`). This is a first palette and may change later. Fonts stay the system font stack.
- **Contrast**: every text role keeps a contrast of at least 4.5:1 on the surfaces it is drawn on. This is now a spec requirement, not only a code comment.
- **Restyle**: the app header, the Theme control, the stage bar, the issue list, the load and loading messages and the action dialog use the new stack and the warm palette. Their behavior, labels and roles stay the same.
- **Mods look like the app by default, from plain semantic HTML**: the base stylesheet stays classless and gives semantic HTML the look of the app's shadcn components. Plain buttons, form fields, tables, dialogs and focus rings look like the app's. Some patterns map to app components: `<article>` is a card, `role="alert"` and `role="status"` are alerts, `<button type="submit">` is the primary button, `role="switch"` checkboxes are switches, `aria-invalid` fields look invalid, `<details>` is an accordion, `aria-busy` shows loading. Mod authors declare no classes and learn no component names: well-written, accessible HTML already looks like OpenTesela. Mods get no Tailwind and no shadcn.
- **A few variant attributes**: for app patterns that have no semantic HTML, a small attribute, `data-ot-variant`, picks a variant. On a `<button>` it takes `primary`, `secondary`, `outline`, `ghost` or `destructive`. A `<span>` with it is a badge: `primary`, `secondary`, `outline`, `destructive`, `success` or `warning`. Unknown values give the plain look. It is prefixed like the tokens, so it cannot collide with a mod library's own `data-variant`.
- **Default mods as examples**: `mod_explorer`, `mod_viewer` and the sample `book_list` are rewritten as short, plain-JavaScript examples of that principle: semantic HTML and variant attributes for the look, their own CSS for layout only. Advanced users can read them to see how a mod gets the app's look. The explorer lists mods as cards and shows failures as alerts. The viewer shows its main action as a primary button and permission statuses as badges.
- **Docs**: `docs/code_conventions.md` documents the vendored zone and the component policy. `docs/stack.md` notes where shadcn code lives. The theme module docs list the new tokens.

## Capabilities

### New Capabilities

None. The stack, the vendored zone and the component policy are tooling and conventions, not system behavior.

### Modified Capabilities

- `theme`: the token names and how color tokens are identified change (Theme tokens). A new requirement covers token contrast. The app's restyled interface still follows the tokens, and the action dialog is now named in that requirement (The app follows the color scheme).
- `mod-theme`: every requirement whose scenarios name a token uses the new names (Theme in the mount context, Base stylesheet by default, Color scheme sections, Mod styles override the base stylesheet, Opt out of the theme styles, Sample and default mods follow the theme). New requirements cover the semantic patterns that look like the app's components and the `data-ot-variant` attribute.
- `default-mods`: a new requirement makes the default mods examples of the semantic approach, with their look from the theme only and their own CSS for layout only, plus the explorer's cards and alerts and the viewer's primary action and badges.

## Impact

- **Dependencies added**: `tailwindcss`, `@tailwindcss/vite`, `lucide-react`, `class-variance-authority`, `clsx`, `tailwind-merge`, `tw-animate-css`, and the `radix-ui` packages that the chosen shadcn components need. `shadcn` runs through `npx` only and is not added as a dependency.
- **Config**: `components.json` (aliases into `src/vendor/shadcn/`), the `@/` path alias in `tsconfig.json`, `tsconfig.app.json` and `vite.config.ts`, the Tailwind plugin in `vite.config.ts`, an oxlint override for `src/vendor/**`, and `.prettierignore`.
- **Changed code**:
  - `src/lib/core/theme/`: token names and values, the base stylesheet, and the token tests (names, schemes, contrast).
  - `src/main/`: the app stylesheet becomes the Tailwind entry with the shadcn aliases, and `AppHeader`, `ThemeControl`, `StageBar`, `IssueList`, `StageView` and `ActionDialog` use utilities and components. `stage.css` keeps only what utilities cannot express.
  - `public/samples/mods/book_list/main.js` and `public/default_mods/*/main.js`: rewritten as semantic examples. Their visible texts, roles and accessible names stay, so the existing scenarios keep holding.
  - Tests: the token tests, `src/lib/core/engine/mod_session.test.ts`, `src/lib/core/theme/theme_styles.test.ts`, `e2e/theme_probes.ts` (token values), `e2e/mod_theme.spec.ts` (token names, semantic patterns, variants) and `e2e/default_mods.spec.ts` (the explorer's error found by role instead of class, new look scenarios).
- **Mod authors**: a mod that uses an old `--ot-color-*` name or `--ot-font-body` stops getting that value. No outside mods are known yet. There are no aliases for the old names.
- **Unchanged**: the content policy, the sandbox flags, the frame document, the engine API, `context.theme`'s shape, `theme.changed`, the color scheme attribute, the `theme: "none"` opt-out, the stage's behavior, and the Theme control's place in the header (the sidebar change moves it).
- **Out of scope**: the sidebar, the settings page, page routing and the markdown pages (next change: `add-app-sidebar`); a class-based component kit for mods; components that need JavaScript in the frame (tooltips, tabs, menus); a shadcn bridge or a copy-paste snippet for mod authors; `chart-*` and `sidebar-*` tokens for mods; web fonts; i18n; code splitting.
