# Proposal

## Why

The app ships one sample mod, the book list, which shows how to list tiles and open a card for each one. It shows nothing about using a collection to *do* something. Studying is a common reason to keep notes as markdown tiles. A flashcards mod that turns any collection into a deck shows that use, and it gives authors a second, different example of the mod API: rendered bodies taken apart after `ot-rendered`, dialogs, storage, choices driven by the tiles' own frontmatter, and a look of its own from the theme's tokens.

## What Changes

- New sample mod `flashcards` in `public/samples/mods/flashcards/` (plain JavaScript, like the book list), with its mod file, tile type, test file and sample collection.
- Two modes, switched by two toggle buttons at the top: **Explore** and **Study**.
- **Explore**: a table with a Title column and a File column, one row per tile. A tile is named by its `title`, then its first heading. When it has neither, the row shows "No title", italic and muted. Clicking a row opens a modal card with the tile's metadata and its full rendered body.
- **Study**: a setup dialog with a Question select (every frontmatter key, plus "First heading") and an Answer select (every frontmatter key, plus "Body"). Choosing "First heading" locks the answer to the body under that heading: its section, up to the next heading of the same or higher level.
  - Defaults: the `question` and `answer` keys when at least one tile has them, otherwise "First heading" and "Body".
  - Tiles that cannot make a card with the chosen fields are left out. The dialog shows "N of M tiles", and Start is disabled at 0.
- A study session shows each card once, in random order, on a card that looks like a flashcard, with a labeled question side and answer side in the theme's colors. "Show answer" shows the answer below the question. "I knew it" and "Not yet" grade the card and go on. The answer side has "Open full tile", which opens the same card as Explore. A bar above the card shows the position and the progress, and holds "Restart", which goes back to the setup dialog at any time.
- After the last card, the mod says how many cards you knew, lists the missed ones, and offers to study only those in a new round or to start again from the setup dialog. Scores last only while the session does: nothing is stored.
- "Reload tiles" during a session ends it, with a notice, and opens the setup dialog.
- The last chosen fields are remembered in the mod's storage.
- Tile type `flashcard`: `title`, `question` and `answer`, all optional. Its body documents the default rules, so any collection matches it.
- Sample collection of 8 tiles about general markdown (emphasis, links, task lists, tables, code, math, diagrams, alerts). Each tile has `question`/`answer` frontmatter and a `##` heading with its section, so both kinds of deck can be tried.
- The mod explorer's vanilla config lists the flashcards sample after the book list.

Mod API version bump: **none**. The mod uses only existing methods and elements (`tiles.renderBody`, `ot-tile-body`, `storage.get`/`storage.set`, `tiles.changed`) and no mod API spec changes. Frontmatter values are shown as plain text, not rendered as markdown, so no new engine method is needed.

## Capabilities

### New Capabilities

- `sample-flashcards`: what the shipped sample flashcards mod shows and how the user works with it. This covers the Explore table and the tile card, the study setup and its defaults, which tiles become cards, the study session, its end and restart, the flashcard tile type and the sample deck.

### Modified Capabilities

- `default-mods`: the mod explorer's vanilla config lists the sample flashcards mod next to the sample book list mod.

## Impact

- New files under `public/samples/mods/flashcards/`: `mod_conf.yaml`, `main.js`, `test.js`, `flashcard_type.md`, `flashcard_collection.yaml`, `cards/*.md`.
- `default_mods/mod_explorer/mod_conf.yaml`: one more entry in `mods`, and the explorer's tests and the e2e tests that count or name its entries.
- Tests: the shipped-sample checks in `src/lib/mod/sample_mod.test.ts` extended to the new mod, and a new Playwright spec `e2e/sample_flashcards.spec.ts`, with helpers in `e2e/sample_mod.ts`.
- Docs: the samples are mentioned in `docs/modules/lib/mod/README.md` and `docs/modules/mods/explorer/README.md`.
- No change to the app's code, the engine, or the mod API. A patch changeset for the app.
