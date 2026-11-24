/**
 * Sample mod: turns the tiles it receives into flashcards. Explore lists the
 * tiles in a table and opens a card with each tile's metadata and body. Study
 * asks which fields make the question and the answer, then goes through the
 * cards once, in random order. It remembers the chosen fields.
 *
 * After the book list, it is a second example of the mod API:
 *
 * - The outline of each tile, its first heading and that heading's section,
 *   comes from the HTML of `tiles.renderBody`, parsed into an inert
 *   `<template>`. One function, `findHeadingSection`, reads it there and in
 *   the study card, so the table, the card count and the card agree.
 * - A study card with "First heading" is an `<tes-tile-body>` whose
 *   `tes-rendered` listener hides everything but the heading, and "Show
 *   answer" shows the section. The listener runs before the element draws
 *   its diagrams, so a diagram in the answer is drawn only after the flip.
 * - The tile card and the setup dialog are native modal `<dialog>` elements
 *   outside `<main>`, so they never stack and they survive a redraw.
 * - `storage.get` and `storage.set` keep the chosen fields under
 *   `study_fields`, and `tiles.changed` ends a session that the new tiles
 *   would no longer match. The grades of a session are kept in memory only.
 *
 * Like the book list, it gets the app's look from semantic HTML and the base
 * stylesheet. Unlike the book list, whose own CSS is layout only, it also
 * sets a look of its own from the theme's tokens: the study card's
 * background, shadow and radius, the question side's stripe, the answer
 * side's tint, and the muted text of the session bar and of "No title". It
 * uses no literal colors, so it follows light and dark. Its icons are
 * Lucide's, drawn as inline SVG in `currentColor` (see `LUCIDE_ICONS`).
 */

const STUDY_FIELDS_KEY = "study_fields";
const TILE_CARD_TITLE_ID = "tile-card-title";
const SETUP_TITLE_ID = "study-setup-title";

const EXPLORE_MODE = "explore";
const STUDY_MODE = "study";

const NO_TITLE_TEXT = "No title";
const TILES_CHANGED_NOTICE = "The tiles changed, so the session ended.";

const HEADING_TAGS = ["H1", "H2", "H3", "H4", "H5", "H6"];

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

/*
 * The icons the mod draws, from Lucide (https://lucide.dev), the icon set of
 * the app's own interface: the path data of lucide-react 1.61.0. `x` and
 * `circle-question-mark` are derived from Feather (https://feathericons.com).
 *
 * ISC License
 *
 * Copyright (c) 2026 Lucide Icons and Contributors
 *
 * Permission to use, copy, modify, and/or distribute this software for any
 * purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
 * WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
 * ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
 * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
 * ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
 * OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 *
 * The MIT License (MIT) (for the icons derived from Feather)
 *
 * Copyright (c) 2013-present Cole Bemis
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
const LUCIDE_ICONS = {
  x: [
    ["path", { d: "M18 6 6 18" }],
    ["path", { d: "m6 6 12 12" }],
  ],
  "circle-question-mark": [
    ["circle", { cx: "12", cy: "12", r: "10" }],
    ["path", { d: "M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" }],
    ["path", { d: "M12 17h.01" }],
  ],
  lightbulb: [
    [
      "path",
      {
        d: "M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5",
      },
    ],
    ["path", { d: "M9 18h6" }],
    ["path", { d: "M10 22h4" }],
  ],
  "circle-check": [
    ["circle", { cx: "12", cy: "12", r: "10" }],
    ["path", { d: "m16 9-5.5 5.5L8 12" }],
  ],
  "rotate-ccw": [
    ["path", { d: "M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" }],
    ["path", { d: "M3 3v5h5" }],
  ],
};

/** The label and icon of each side of a study card. */
const SIDE_LABELS = {
  question: { text: "Question", icon: "circle-question-mark" },
  answer: { text: "Answer", icon: "lightbulb" },
};

const POSITION_ID = "study-position";
const NOT_YET_LABEL_ID = "not-yet-label";

/** How long after "Show answer" the grading buttons ignore pointer clicks, in milliseconds. */
const GRADE_CLICK_PAUSE = 500;

/** The outline of a tile without a heading, or whose body could not be rendered. */
const EMPTY_OUTLINE = Object.freeze({ heading: null, hasSection: false });

// Layout, and the study card's own look, from the theme's tokens only. "No
// title" is muted with the theme's token, and italic so it doesn't rely on color.
const FLASHCARDS_STYLE = `
  main > header {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--tes-space-4);
    margin-bottom: var(--tes-space-4);
  }
  main > header > h1 { margin: 0; }
  main > header > [role="group"],
  [data-actions] { display: flex; flex-wrap: wrap; gap: var(--tes-space-2); }

  tbody > tr { cursor: pointer; }
  td > button { justify-content: flex-start; min-height: 0; text-align: start; }
  td { overflow-wrap: anywhere; }
  [data-untitled] { font-style: italic; color: var(--tes-muted-foreground); }

  dialog { box-sizing: border-box; width: min(40rem, 100%); }
  dialog > button[data-tes-variant="ghost"] { position: absolute; top: var(--tes-space-2); right: var(--tes-space-2); }
  dialog > button[data-tes-variant="ghost"] > svg { display: block; }
  dialog > h2 { margin-top: 0; padding-right: var(--tes-space-6); }
  dialog dl { display: grid; grid-template-columns: auto minmax(0, 1fr); column-gap: var(--tes-space-4); }
  dialog dd { margin: 0; overflow-wrap: anywhere; white-space: pre-line; }
  dialog [data-fields] { display: grid; gap: var(--tes-space-4); }
  dialog [data-fields] > div { display: grid; gap: var(--tes-space-1); }

  /* Study: the session bar, then the flashcard, both as wide as a card and centered. */
  [data-study] { display: grid; justify-items: center; gap: var(--tes-space-4); }
  [data-session-bar] {
    box-sizing: border-box;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--tes-space-2) var(--tes-space-4);
    width: min(32rem, 100%);
  }
  [data-session-bar] > p { margin: 0; color: var(--tes-muted-foreground); font-size: 0.875rem; }
  [data-session-bar] > progress { flex: 1; min-width: 6rem; accent-color: var(--tes-primary); }

  /* The flashcard: the theme's card, shadow and a radius twice the theme's. */
  article[data-flashcard] {
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    width: min(32rem, 100%);
    min-height: 16rem;
    margin: 0;
    padding: 0;
    overflow: hidden;
    border-radius: calc(var(--tes-radius) * 2);
    background-color: var(--tes-card);
    color: var(--tes-card-foreground);
    box-shadow: var(--tes-shadow);
  }
  article[data-flashcard] > * + * { margin-top: 0; }
  [data-card-actions] {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: var(--tes-space-2);
    margin-top: var(--tes-space-6);
  }
  article[data-flashcard] > footer {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: var(--tes-space-2);
    margin-top: auto;
    padding: var(--tes-space-4) var(--tes-space-6) var(--tes-space-6);
  }

  /* The sides: the question under a primary stripe, the answer on the muted tint. */
  [data-side] { padding: var(--tes-space-6); }
  [data-side="question"] { flex: 1; border-top: 4px solid var(--tes-primary); }
  [data-side="answer"] {
    flex: 1;
    border-top: 1px solid var(--tes-border);
    background-color: var(--tes-muted);
    animation: flashcards-reveal 150ms ease-out;
  }
  [data-side-label] {
    display: flex;
    align-items: center;
    gap: var(--tes-space-2);
    margin: 0 0 var(--tes-space-4);
    font-size: 0.875rem;
    font-weight: 600;
  }
  [data-side="question"] > [data-side-label] { color: var(--tes-primary); }
  [data-side="answer"] > [data-side-label] { color: var(--tes-muted-foreground); }
  [data-side-text] {
    margin: 0;
    font-size: 1.25rem;
    text-align: center;
    white-space: pre-line;
    overflow-wrap: anywhere;
  }
  [data-side] > tes-tile-body { display: block; text-align: start; }

  /* The end of a round, in the same card. */
  [data-round-end] { padding: var(--tes-space-6); }
  [data-round-end] > p:not([data-side-label]) { margin: 0; font-size: 1.25rem; text-align: center; }
  [data-round-end] > [data-side-label] { justify-content: center; margin: var(--tes-space-4) 0 0; color: var(--tes-primary); }
  [data-not-yet] {
    padding: var(--tes-space-4) var(--tes-space-6);
    border-top: 1px solid var(--tes-border);
    background-color: var(--tes-muted);
  }
  [data-not-yet] > [data-side-label] { margin-bottom: var(--tes-space-2); color: var(--tes-muted-foreground); }
  [data-not-yet] > ul { margin: 0; }

  @keyframes flashcards-reveal {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  @media (prefers-reduced-motion: reduce) {
    [data-side="answer"] { animation: none; }
  }

  /* The base stylesheet's [hidden] is layered: a body's alert or figure would show again. */
  tes-tile-body > [hidden] { display: none; }
`;

// Fields and values ----------------------------------------------------------

/*
 * A field is a side of a card, written as the string the selects and the
 * storage use:
 *
 * | Field                              | String       |
 * | a metadata key                     | `key:<name>` |
 * | First heading (question)           | `first-heading` |
 * | Body (answer)                      | `body`       |
 * | Section under the heading (answer) | `section`    |
 *
 * The prefix keeps a metadata key named `body` apart from "Body".
 */
const KEY_FIELD_PREFIX = "key:";
const FIRST_HEADING_FIELD = "first-heading";
const BODY_FIELD = "body";
const SECTION_FIELD = "section";

function encodeKeyField(key) {
  const field = `${KEY_FIELD_PREFIX}${key}`;
  return field;
}

/** The metadata key of a key field, or `null` for another field. */
function readFieldKey(field) {
  if (typeof field !== "string" || !field.startsWith(KEY_FIELD_PREFIX)) {
    return null;
  }
  const key = field.slice(KEY_FIELD_PREFIX.length);
  return key;
}

function isTextValue(value) {
  if (typeof value === "string") {
    return value.trim() !== "";
  }
  if (typeof value === "number") {
    return Number.isFinite(value);
  }
  return typeof value === "boolean";
}

function isTextList(value) {
  if (!Array.isArray(value) || value.length === 0) {
    return false;
  }
  for (const item of value) {
    if (!isTextValue(item)) {
      return false;
    }
  }
  return true;
}

/**
 * A metadata value as the text of a card's side: a non-blank string, a
 * number or a boolean as written, a non-empty list of those joined with
 * `, `, and `null` for anything else.
 */
function readMetadataText(value) {
  if (isTextValue(value)) {
    const text = String(value);
    return text;
  }
  if (isTextList(value)) {
    const listText = value.join(", ");
    return listText;
  }
  return null;
}

function hasBody(tile) {
  return typeof tile.body === "string" && tile.body.trim() !== "";
}

function hasHeadingSection(outline) {
  return outline.heading !== null && outline.hasSection;
}

/**
 * What a tile shows for a field: `{ text }` for a metadata key, `{ rendered }`
 * with the field for a side the engine renders (Body, First heading,
 * Section), or `null` when the tile has no value for the field.
 */
function readFieldValue(tile, outline, field) {
  const key = readFieldKey(field);
  if (key !== null) {
    if (!Object.hasOwn(tile.metadata, key)) {
      return null;
    }
    const text = readMetadataText(tile.metadata[key]);
    if (text === null) {
      return null;
    }
    const textValue = { text };
    return textValue;
  }
  const hasValue =
    field === BODY_FIELD ? hasBody(tile) : hasHeadingSection(outline);
  if (!hasValue) {
    return null;
  }
  const renderedValue = { rendered: field };
  return renderedValue;
}

function readOutline(view, source) {
  const outline = view.outlines.get(source) ?? EMPTY_OUTLINE;
  return outline;
}

/** A tile is a card when both its question and its answer have a value. */
function isCard(view, tile, fields) {
  const outline = readOutline(view, tile.source);
  return (
    readFieldValue(tile, outline, fields.question) !== null &&
    readFieldValue(tile, outline, fields.answer) !== null
  );
}

/** The sources of the tiles that are cards for the fields, in the tiles' order. */
function listCardSources(view, fields) {
  const sources = [];
  for (const tile of view.tiles) {
    if (isCard(view, tile, fields)) {
      sources.push(tile.source);
    }
  }
  return sources;
}

/** Every metadata key of the tiles, in the order the keys first appear. */
function listMetadataKeys(tiles) {
  const keys = [];
  for (const tile of tiles) {
    for (const key of Object.keys(tile.metadata)) {
      if (!keys.includes(key)) {
        keys.push(key);
      }
    }
  }
  return keys;
}

function isPrimitiveValue(value) {
  return (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
}

function isPrimitiveList(value) {
  if (!Array.isArray(value)) {
    return false;
  }
  for (const item of value) {
    if (!isPrimitiveValue(item)) {
      return false;
    }
  }
  return true;
}

/** A metadata value as the tile card writes it: text, a list joined with `, `, or JSON. */
function writeMetadataValue(value) {
  if (isPrimitiveValue(value)) {
    const text = String(value);
    return text;
  }
  if (isPrimitiveList(value)) {
    const listText = value.join(", ");
    return listText;
  }
  const json = JSON.stringify(value);
  return json;
}

// Outline --------------------------------------------------------------------

function isHeading(element) {
  return HEADING_TAGS.includes(element.tagName);
}

function readHeadingLevel(heading) {
  const level = Number(heading.tagName.slice(1));
  return level;
}

function findFirstHeadingIndex(children) {
  for (const [index, child] of children.entries()) {
    if (isHeading(child)) {
      return index;
    }
  }
  return -1;
}

/** The index after the section: the next heading of the same or a higher level, or the end. */
function findSectionEnd(children, headingIndex) {
  const level = readHeadingLevel(children[headingIndex]);
  for (let index = headingIndex + 1; index < children.length; index += 1) {
    const child = children[index];
    if (isHeading(child) && readHeadingLevel(child) <= level) {
      return index;
    }
  }
  return children.length;
}

/**
 * Splits a container's top-level children around its first top-level
 * heading: the heading, the children before it, its section (up to the next
 * heading of the same or a higher level) and the children after the section.
 * A heading inside a blockquote, a list or an alert is not top-level. Without
 * a heading, every child is `before`. Reads the DOM and changes nothing.
 */
function findHeadingSection(container) {
  const children = Array.from(container.children);
  const headingIndex = findFirstHeadingIndex(children);
  if (headingIndex === -1) {
    const noHeading = {
      heading: null,
      before: children,
      section: [],
      after: [],
    };
    return noHeading;
  }
  const sectionEnd = findSectionEnd(children, headingIndex);
  const parts = {
    heading: children[headingIndex],
    before: children.slice(0, headingIndex),
    section: children.slice(headingIndex + 1, sectionEnd),
    after: children.slice(sectionEnd),
  };
  return parts;
}

/** A heading's text, without the TeX source that each formula keeps in an annotation. */
function readHeadingText(heading) {
  const copy = heading.cloneNode(true);
  for (const annotation of copy.querySelectorAll("annotation")) {
    annotation.remove();
  }
  const text = copy.textContent.replace(/\s+/g, " ").trim();
  return text;
}

/** The outline of a rendered body, read from an inert template, which runs no script and loads no image. */
function buildOutline(html) {
  const template = document.createElement("template");
  template.innerHTML = html;
  const parts = findHeadingSection(template.content);
  if (parts.heading === null) {
    return EMPTY_OUTLINE;
  }
  const headingText = readHeadingText(parts.heading);
  const outline = {
    heading: headingText === "" ? null : headingText,
    hasSection: parts.section.length > 0,
  };
  return outline;
}

/** A body that cannot be rendered gives an empty outline, and a warning naming the tile. */
async function readTileOutline(engine, tile) {
  if (!hasBody(tile)) {
    return EMPTY_OUTLINE;
  }
  try {
    const rendered = await engine.request("tiles.renderBody", {
      source: tile.source,
    });
    const outline = buildOutline(rendered.html);
    return outline;
  } catch (error) {
    console.warn(
      `Flashcards: cannot read the headings of ${tile.source}: ${error.message}`,
    );
    return EMPTY_OUTLINE;
  }
}

/**
 * Renders every tile's body, in parallel, and keeps their outlines. A newer
 * round, started when the tiles change again, drops the answers of this one.
 */
async function loadOutlines(view) {
  view.outlineRound += 1;
  const round = view.outlineRound;
  const tiles = view.tiles;
  const readings = [];
  for (const tile of tiles) {
    readings.push(readTileOutline(view.engine, tile));
  }
  const outlines = await Promise.all(readings);
  if (round !== view.outlineRound) {
    return;
  }
  view.outlines = new Map();
  for (const [index, tile] of tiles.entries()) {
    view.outlines.set(tile.source, outlines[index]);
  }
  view.outlinesReady = true;
  showLoadedOutlines(view);
}

// Tiles ----------------------------------------------------------------------

function findTile(view, source) {
  for (const tile of view.tiles) {
    if (tile.source === source) {
      return tile;
    }
  }
  return null;
}

/** A tile's name: its non-blank `title`, else the text of its first heading, else `null`. */
function readTileName(view, tile) {
  const title = tile.metadata.title;
  if (typeof title === "string" && title.trim() !== "") {
    return title;
  }
  const outline = readOutline(view, tile.source);
  return outline.heading;
}

/** The last path segment of the tile's source, percent-decoded. */
function readFileName(tile) {
  const segments = new URL(tile.source).pathname.split("/");
  const segment = segments[segments.length - 1];
  try {
    const fileName = decodeURIComponent(segment);
    return fileName;
  } catch {
    return segment;
  }
}

// Explore --------------------------------------------------------------------

function findActionButton(view, action) {
  const button = view.main.querySelector(`button[data-action="${action}"]`);
  return button;
}

/** Focuses the button of an action, or the current mode's button when the action's button is gone. */
function focusAction(view, action) {
  const button =
    findActionButton(view, action) ?? findActionButton(view, view.mode);
  if (button !== null) {
    button.focus();
  }
}

function buildActionButton(view, action, text, handler) {
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.action = action;
  button.textContent = text;
  button.addEventListener("click", handler.bind(undefined, view));
  return button;
}

function buildPrimaryButton(view, action, text, handler) {
  const button = buildActionButton(view, action, text, handler);
  button.dataset.tesVariant = "primary";
  return button;
}

/** A button whose Lucide icon comes before its text, which alone names it. */
function addButtonIcon(button, icon) {
  button.prepend(buildIcon(icon));
  return button;
}

function buildModeButton(view, mode, text) {
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.action = mode;
  button.textContent = text;
  button.setAttribute("aria-pressed", String(view.mode === mode));
  button.addEventListener("click", chooseMode.bind(undefined, view, mode));
  return button;
}

function buildModeButtons(view) {
  const group = document.createElement("div");
  group.setAttribute("role", "group");
  group.setAttribute("aria-label", "Mode");
  group.append(
    buildModeButton(view, EXPLORE_MODE, "Explore"),
    buildModeButton(view, STUDY_MODE, "Study"),
  );
  return group;
}

function buildMainHeader(view) {
  const header = document.createElement("header");
  const heading = document.createElement("h1");
  heading.textContent = view.title;
  header.append(heading);
  if (view.tiles.length > 0) {
    header.append(buildModeButtons(view));
  }
  return header;
}

function buildStatus(text) {
  const status = document.createElement("p");
  status.setAttribute("role", "status");
  status.textContent = text;
  return status;
}

function buildLoadingStatus() {
  const status = buildStatus("Loading tiles…");
  status.setAttribute("aria-busy", "true");
  return status;
}

/** What a row's button shows: the tile's name, or "No title" muted and italic. */
function buildTileNameText(name) {
  if (name !== null) {
    const nameText = document.createTextNode(name);
    return nameText;
  }
  const untitled = document.createElement("span");
  untitled.dataset.untitled = "";
  untitled.textContent = NO_TITLE_TEXT;
  return untitled;
}

function buildRowButton(view, tile) {
  const name = readTileName(view, tile);
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.tesVariant = "ghost";
  button.dataset.source = tile.source;
  button.setAttribute("aria-haspopup", "dialog");
  button.setAttribute("aria-expanded", String(view.openSource === tile.source));
  button.setAttribute(
    "aria-label",
    `${name ?? NO_TITLE_TEXT}, ${readFileName(tile)}`,
  );
  button.append(buildTileNameText(name));
  button.addEventListener(
    "click",
    openTileCardFromRow.bind(undefined, view, tile.source),
  );
  return button;
}

/** A click anywhere on the row presses its button, which stays the row's one focusable element. */
function pressRowButton(event) {
  const button = event.currentTarget.querySelector("button");
  if (!button.contains(event.target)) {
    button.click();
  }
}

function buildTileRow(view, tile) {
  const row = document.createElement("tr");
  const nameCell = document.createElement("td");
  nameCell.append(buildRowButton(view, tile));
  const fileCell = document.createElement("td");
  fileCell.textContent = readFileName(tile);
  row.append(nameCell, fileCell);
  row.addEventListener("click", pressRowButton);
  return row;
}

function buildColumnHeader(text) {
  const header = document.createElement("th");
  header.scope = "col";
  header.textContent = text;
  return header;
}

function buildTileTable(view) {
  const table = document.createElement("table");
  const head = document.createElement("thead");
  const headRow = document.createElement("tr");
  headRow.append(buildColumnHeader("Title"), buildColumnHeader("File"));
  head.append(headRow);
  const body = document.createElement("tbody");
  for (const tile of view.tiles) {
    body.append(buildTileRow(view, tile));
  }
  table.append(head, body);
  return table;
}

function findRowButton(view, source) {
  for (const button of view.main.querySelectorAll("td > button")) {
    if (button.dataset.source === source) {
      return button;
    }
  }
  return null;
}

// Tile card ------------------------------------------------------------------

function buildIconShape(tag, attributes) {
  const shape = document.createElementNS(SVG_NAMESPACE, tag);
  for (const [name, value] of Object.entries(attributes)) {
    shape.setAttribute(name, value);
  }
  return shape;
}

/**
 * A 20 by 20 Lucide icon of `LUCIDE_ICONS`, stroked in `currentColor` so it
 * takes the color of its label or button, and hidden from assistive
 * technology, which reads the text next to it.
 */
function buildIcon(name) {
  const icon = buildIconShape("svg", {
    viewBox: "0 0 24 24",
    width: "20",
    height: "20",
    fill: "none",
    stroke: "currentColor",
    "stroke-width": "2",
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
    "aria-hidden": "true",
  });
  for (const [tag, attributes] of LUCIDE_ICONS[name]) {
    icon.append(buildIconShape(tag, attributes));
  }
  return icon;
}

function closeDialog(dialog) {
  dialog.close();
}

function buildCloseButton(dialog) {
  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.dataset.tesVariant = "ghost";
  closeButton.setAttribute("aria-label", "Close");
  closeButton.append(buildIcon("x"));
  closeButton.addEventListener("click", closeDialog.bind(undefined, dialog));
  return closeButton;
}

function isOutsideDialog(dialog, event) {
  const box = dialog.getBoundingClientRect();
  return (
    event.clientX < box.left ||
    event.clientX > box.right ||
    event.clientY < box.top ||
    event.clientY > box.bottom
  );
}

/** A click on the backdrop targets the dialog itself, outside its box. */
function closeOnBackdropClick(dialog, event) {
  if (event.target === dialog && isOutsideDialog(dialog, event)) {
    dialog.close();
  }
}

function buildDialog(titleId) {
  const dialog = document.createElement("dialog");
  dialog.setAttribute("aria-labelledby", titleId);
  dialog.addEventListener(
    "click",
    closeOnBackdropClick.bind(undefined, dialog),
  );
  return dialog;
}

/** The tile's metadata as labeled values, in the metadata's order, or `null` without any. */
function buildMetadataList(tile) {
  const keys = Object.keys(tile.metadata);
  if (keys.length === 0) {
    return null;
  }
  const list = document.createElement("dl");
  for (const key of keys) {
    const term = document.createElement("dt");
    term.textContent = key;
    const description = document.createElement("dd");
    description.textContent = writeMetadataValue(tile.metadata[key]);
    list.append(term, description);
  }
  return list;
}

/** Fills the tile card: the close button, the name (or the file), the metadata and the full body. */
function fillTileCard(view, tile) {
  const heading = document.createElement("h2");
  heading.id = TILE_CARD_TITLE_ID;
  heading.textContent = readTileName(view, tile) ?? readFileName(tile);
  view.tileCard.replaceChildren(buildCloseButton(view.tileCard), heading);
  const metadataList = buildMetadataList(tile);
  if (metadataList !== null) {
    view.tileCard.append(metadataList);
  }
  if (hasBody(tile)) {
    const body = document.createElement("tes-tile-body");
    body.tile = tile;
    view.tileCard.append(document.createElement("hr"), body);
  }
}

/** Opens the tile card; `opener` says what gets the focus back: a row's source, or an action. */
function openTileCard(view, source, opener) {
  const tile = findTile(view, source);
  if (tile === null || view.tileCard.open || view.setup.open) {
    return;
  }
  fillTileCard(view, tile);
  view.tileCard.showModal();
  view.openSource = source;
  view.tileCardOpener = opener;
  const rowButton = findRowButton(view, source);
  if (rowButton !== null) {
    rowButton.setAttribute("aria-expanded", "true");
  }
}

function openTileCardFromRow(view, source) {
  openTileCard(view, source, { source });
}

function openFullTile(view) {
  const source = view.session.order[view.session.index];
  openTileCard(view, source, { action: "open-full-tile" });
}

/** After the tile card closes: its row is no longer expanded, and its opener gets the focus back. */
function showClosedTileCard(view) {
  const opener = view.tileCardOpener;
  const rowButton = findRowButton(view, view.openSource);
  view.openSource = null;
  view.tileCardOpener = null;
  if (rowButton !== null) {
    rowButton.setAttribute("aria-expanded", "false");
  }
  if (opener === null) {
    return;
  }
  if (opener.action !== undefined) {
    focusAction(view, opener.action);
    return;
  }
  if (rowButton !== null) {
    rowButton.focus();
  }
}

/** The tile card opened in Explore follows its tile: filled again from the new tile, or closed when it is gone. */
function updateOpenTileCard(view) {
  if (view.openSource === null) {
    return;
  }
  const tile = findTile(view, view.openSource);
  if (tile === null) {
    view.tileCard.close();
    return;
  }
  fillTileCard(view, tile);
}

// Study setup ----------------------------------------------------------------

function buildOption(value, text) {
  const option = document.createElement("option");
  option.value = value;
  option.textContent = text;
  return option;
}

function buildKeyOptions(keys) {
  const options = [];
  for (const key of keys) {
    options.push(buildOption(encodeKeyField(key), key));
  }
  return options;
}

function isQuestionOffered(keys, question) {
  if (question === FIRST_HEADING_FIELD) {
    return true;
  }
  const key = readFieldKey(question);
  return key !== null && keys.includes(key);
}

function isAnswerOffered(keys, answer) {
  if (answer === BODY_FIELD) {
    return true;
  }
  const key = readFieldKey(answer);
  return key !== null && keys.includes(key);
}

function readDefaultQuestion(keys) {
  if (keys.includes("question")) {
    const question = encodeKeyField("question");
    return question;
  }
  return FIRST_HEADING_FIELD;
}

function readDefaultAnswer(keys) {
  if (keys.includes("answer")) {
    const answer = encodeKeyField("answer");
    return answer;
  }
  return BODY_FIELD;
}

/** The answer for a question: the section under First heading, else `answer` when offered, else the default. */
function resolveAnswer(keys, question, answer) {
  if (question === FIRST_HEADING_FIELD) {
    return SECTION_FIELD;
  }
  if (isAnswerOffered(keys, answer)) {
    return answer;
  }
  const defaultAnswer = readDefaultAnswer(keys);
  return defaultAnswer;
}

/** The fields the setup dialog shows: each of `wanted` that its select offers, the default for the others. */
function resolveSetupFields(keys, wanted) {
  const question = isQuestionOffered(keys, wanted.question)
    ? wanted.question
    : readDefaultQuestion(keys);
  const fields = {
    question,
    answer: resolveAnswer(keys, question, wanted.answer),
  };
  return fields;
}

/** The stored fields, or no fields when the storage holds anything else. */
function readStoredFields(value) {
  const noFields = { question: null, answer: null };
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return noFields;
  }
  const storedFields = {
    question: typeof value.question === "string" ? value.question : null,
    answer: typeof value.answer === "string" ? value.answer : null,
  };
  return storedFields;
}

function findSetupSelect(view, name) {
  const select = view.setup.querySelector(`select[name="${name}"]`);
  return select;
}

/** The Answer select's choices: locked on the section under First heading, else Body and the keys. */
function fillAnswerSelect(view, keys) {
  const select = findSetupSelect(view, "answer");
  const isLocked = view.setupFields.question === FIRST_HEADING_FIELD;
  if (isLocked) {
    select.replaceChildren(
      buildOption(SECTION_FIELD, "Section under the heading"),
    );
  } else {
    select.replaceChildren(
      buildOption(BODY_FIELD, "Body"),
      ...buildKeyOptions(keys),
    );
  }
  select.disabled = isLocked;
  select.value = view.setupFields.answer;
}

function updateSetupCount(view) {
  const cardCount = listCardSources(view, view.setupFields).length;
  const count = view.setup.querySelector("output");
  count.textContent = `${cardCount} of ${view.tiles.length} tiles have these fields.`;
  const startButton = view.setup.querySelector('button[data-action="start"]');
  startButton.disabled = cardCount === 0;
}

function chooseQuestion(view, event) {
  const keys = listMetadataKeys(view.tiles);
  const question = event.currentTarget.value;
  view.setupFields = {
    question,
    answer: resolveAnswer(keys, question, view.unlockedAnswer),
  };
  fillAnswerSelect(view, keys);
  updateSetupCount(view);
}

function chooseAnswer(view, event) {
  view.setupFields = {
    question: view.setupFields.question,
    answer: event.currentTarget.value,
  };
  view.unlockedAnswer = view.setupFields.answer;
  updateSetupCount(view);
}

/**
 * A select and its label. The label is not wrapped around the select, so
 * the select's name is the label's text alone, without its options.
 */
function buildFieldControl(labelText, name, handler) {
  const control = document.createElement("div");
  const label = document.createElement("label");
  label.htmlFor = `study-${name}`;
  label.textContent = labelText;
  const select = document.createElement("select");
  select.id = `study-${name}`;
  select.name = name;
  select.addEventListener("change", handler);
  control.append(label, select);
  return control;
}

/**
 * The fields, the count and Start. Not a `<form>`: the sandbox blocks form
 * submission, so Start is a button with a click handler.
 */
function buildSetupFields(view, keys) {
  const fields = document.createElement("div");
  fields.dataset.fields = "";
  const questionControl = buildFieldControl(
    "Question",
    "question",
    chooseQuestion.bind(undefined, view),
  );
  const questionSelect = questionControl.querySelector("select");
  questionSelect.append(
    buildOption(FIRST_HEADING_FIELD, "First heading"),
    ...buildKeyOptions(keys),
  );
  const answerControl = buildFieldControl(
    "Answer",
    "answer",
    chooseAnswer.bind(undefined, view),
  );
  const count = document.createElement("output");
  fields.append(
    questionControl,
    answerControl,
    count,
    buildPrimaryButton(view, "start", "Start", startSession),
  );
  return fields;
}

/** Fills the setup dialog with the choices of the current tiles, showing `wanted` where offered. */
function fillSetup(view, wanted) {
  const keys = listMetadataKeys(view.tiles);
  view.setupFields = resolveSetupFields(keys, wanted);
  view.unlockedAnswer =
    view.setupFields.answer === SECTION_FIELD ? null : view.setupFields.answer;
  const heading = document.createElement("h2");
  heading.id = SETUP_TITLE_ID;
  heading.textContent = "Study setup";
  view.setup.replaceChildren(buildCloseButton(view.setup), heading);
  if (view.notice !== null) {
    view.setup.append(buildStatus(view.notice));
  }
  view.setup.append(buildSetupFields(view, keys));
  findSetupSelect(view, "question").value = view.setupFields.question;
  fillAnswerSelect(view, keys);
  updateSetupCount(view);
}

/** The fields the setup dialog starts from: the session's, else the remembered ones. */
function readWantedFields(view) {
  if (view.session !== null) {
    return view.session.fields;
  }
  return view.storedFields;
}

/** Opens the setup dialog; `opener` is the action whose button gets the focus back when it closes without a start. */
function openSetup(view, opener) {
  if (view.setup.open || view.tileCard.open || view.tiles.length === 0) {
    return;
  }
  view.setupOpener = opener;
  fillSetup(view, readWantedFields(view));
  view.setup.returnValue = "";
  view.setup.showModal();
}

/** Opens the setup dialog now, or once the outlines are in. */
function requestSetup(view, opener) {
  if (!view.outlinesReady) {
    view.setupPending = true;
    view.setupOpener = opener;
    return;
  }
  openSetup(view, opener);
}

/** The setup dialog shows the new tiles' choices and count, keeping the shown fields where offered. */
function updateOpenSetup(view) {
  const hadFocus = view.setup.contains(document.activeElement);
  fillSetup(view, view.setupFields);
  if (hadFocus) {
    findSetupSelect(view, "question").focus();
  }
}

/** After the setup dialog closes: a start focuses the first card, anything else gives the focus back to the opener. */
function showClosedSetup(view) {
  if (view.setup.returnValue === "start") {
    focusAction(view, "show-answer");
    return;
  }
  focusAction(view, view.setupOpener);
}

// Study session --------------------------------------------------------------

/** A shuffled copy of the sources (Fisher–Yates). `random` gives numbers in [0, 1). */
function shuffleSources(sources, random) {
  const shuffled = [...sources];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    const kept = shuffled[index];
    shuffled[index] = shuffled[other];
    shuffled[other] = kept;
  }
  return shuffled;
}

/** Remembers the fields; a storage failure leaves them unremembered and the session starts anyway. */
async function storeStudyFields(view, fields) {
  view.storedFields = fields;
  try {
    await view.engine.request("storage.set", {
      key: STUDY_FIELDS_KEY,
      value: fields,
    });
  } catch (error) {
    console.warn(
      `Flashcards: cannot remember the study fields: ${error.message}`,
    );
  }
}

/**
 * Stores the fields, then starts the session, so a session shown is one
 * whose fields are remembered. Start is disabled meanwhile, and a setup
 * dialog closed meanwhile starts nothing.
 */
async function startSession(view, event) {
  const fields = view.setupFields;
  const sources = listCardSources(view, fields);
  if (sources.length === 0) {
    return;
  }
  event.currentTarget.disabled = true;
  await storeStudyFields(view, fields);
  if (!view.setup.open) {
    return;
  }
  view.session = {
    fields,
    order: shuffleSources(sources, Math.random),
    index: 0,
    side: "question",
    round: 1,
    results: new Map(),
    done: false,
  };
  view.notice = null;
  renderContent(view);
  view.setup.close("start");
}

function keepParts(body, keptParts) {
  for (const child of body.children) {
    child.hidden = !keptParts.includes(child);
  }
}

/**
 * The `tes-rendered` listener of a First heading question: hides everything
 * but the heading. It runs before the element draws its diagrams, so the
 * section's diagrams are never drawn on the question side.
 */
function keepOnlyHeading(event) {
  const body = event.currentTarget;
  const parts = findHeadingSection(body);
  keepParts(body, [parts.heading]);
}

/** The `tes-rendered` listener of a section answer: hides everything but the heading's section. */
function keepOnlySection(event) {
  const body = event.currentTarget;
  const parts = findHeadingSection(body);
  keepParts(body, parts.section);
}

/** The whole body, or only the part of it a First heading card shows on this side. */
function buildRenderedBody(tile, field) {
  const body = document.createElement("tes-tile-body");
  if (field === FIRST_HEADING_FIELD) {
    body.addEventListener("tes-rendered", keepOnlyHeading);
  }
  if (field === SECTION_FIELD) {
    body.addEventListener("tes-rendered", keepOnlySection);
  }
  body.tile = tile;
  return body;
}

/** The visible label of a side, after its icon. */
function buildSideLabel(sideName) {
  const label = buildIconLabel(
    SIDE_LABELS[sideName].icon,
    SIDE_LABELS[sideName].text,
  );
  return label;
}

/** One side of a study card, under its label: plain text for a key, the rendered body otherwise. */
function buildSide(tile, value, sideName) {
  const side = document.createElement("div");
  side.dataset.side = sideName;
  side.append(buildSideLabel(sideName));
  if (value.text !== undefined) {
    const text = document.createElement("p");
    text.dataset.sideText = "";
    text.textContent = value.text;
    side.append(text);
    return side;
  }
  side.append(buildRenderedBody(tile, value.rendered));
  return side;
}

function readCurrentTile(view) {
  const tile = findTile(view, view.session.order[view.session.index]);
  return tile;
}

function buildCardSide(view, tile, sideName) {
  const value = readFieldValue(
    tile,
    readOutline(view, tile.source),
    view.session.fields[sideName],
  );
  const side = buildSide(tile, value, sideName);
  return side;
}

/** The card's button row, which sits under the question: "Show answer", then the grades and "Open full tile" in the same place. */
function buildCardActions(view) {
  const actions = document.createElement("div");
  actions.dataset.cardActions = "";
  if (view.session.side === "question") {
    actions.append(
      buildPrimaryButton(view, "show-answer", "Show answer", showAnswer),
    );
    return actions;
  }
  const knownButton = buildPrimaryButton(
    view,
    "knew-it",
    "I knew it",
    gradeKnown,
  );
  const missedButton = buildActionButton(
    view,
    "not-yet",
    "Not yet",
    gradeMissed,
  );
  const fullTileButton = buildActionButton(
    view,
    "open-full-tile",
    "Open full tile",
    openFullTile,
  );
  fullTileButton.dataset.tesVariant = "ghost";
  fullTileButton.setAttribute("aria-haspopup", "dialog");
  actions.append(
    addButtonIcon(knownButton, "circle-check"),
    addButtonIcon(missedButton, "rotate-ccw"),
    fullTileButton,
  );
  return actions;
}

/** The session bar above the card: the round from the second one on, the position, the progress and Restart. */
function buildSessionBar(view) {
  const session = view.session;
  const bar = document.createElement("div");
  bar.dataset.sessionBar = "";
  if (session.round > 1) {
    const round = document.createElement("p");
    round.textContent = `Round ${session.round}`;
    bar.append(round);
  }
  const position = document.createElement("p");
  position.id = POSITION_ID;
  position.textContent = `Card ${session.index + 1} of ${session.order.length}`;
  const progress = document.createElement("progress");
  progress.max = session.order.length;
  progress.value = session.results.size;
  progress.setAttribute("aria-labelledby", POSITION_ID);
  bar.append(
    position,
    progress,
    buildActionButton(view, "restart", "Restart", restartSession),
  );
  return bar;
}

function buildFlashcard() {
  const card = document.createElement("article");
  card.dataset.flashcard = "";
  return card;
}

function buildStudyCard(view) {
  const tile = readCurrentTile(view);
  const card = buildFlashcard();
  const questionSide = buildCardSide(view, tile, "question");
  questionSide.append(buildCardActions(view));
  card.append(questionSide);
  if (view.session.side === "answer") {
    card.append(buildCardSide(view, tile, "answer"));
  }
  return card;
}

/**
 * Shows the answer side below the question, without drawing the question
 * again: the grades take the place of "Show answer", and the answer is added
 * after them, so nothing above it moves.
 */
function showAnswer(view) {
  view.session.side = "answer";
  view.answerShownAt = performance.now();
  const card = view.content.querySelector("article[data-flashcard]");
  card.querySelector("[data-card-actions]").replaceWith(buildCardActions(view));
  card.append(buildCardSide(view, readCurrentTile(view), "answer"));
  focusAction(view, "knew-it");
}

/** The sources of the round's cards graded "Not yet", in the order they were shown. */
function listMissedSources(session) {
  const missed = [];
  for (const source of session.order) {
    if (session.results.get(source) === "missed") {
      missed.push(source);
    }
  }
  return missed;
}

/** Records the grade of the current card and goes to the next one, or to the end of the round. */
function gradeCard(view, result) {
  const session = view.session;
  session.results.set(session.order[session.index], result);
  session.index += 1;
  session.side = "question";
  if (session.index < session.order.length) {
    renderContent(view);
    focusAction(view, "show-answer");
    return;
  }
  session.done = true;
  renderContent(view);
  const firstAction =
    listMissedSources(session).length > 0 ? "study-missed" : "start-again";
  focusAction(view, firstAction);
}

/**
 * A pointer click (`detail` above 0) within the pause after "Show answer":
 * the second click of a double-click on "Show answer", which lands on the
 * grade under the pointer. A click from the keyboard has `detail` 0.
 */
function isTooSoonAfterAnswer(view, event) {
  return (
    event.detail > 0 &&
    view.answerShownAt !== null &&
    event.timeStamp - view.answerShownAt < GRADE_CLICK_PAUSE
  );
}

function gradeKnown(view, event) {
  if (!isTooSoonAfterAnswer(view, event)) {
    gradeCard(view, "known");
  }
}

function gradeMissed(view, event) {
  if (!isTooSoonAfterAnswer(view, event)) {
    gradeCard(view, "missed");
  }
}

/** A new round of the same session over the missed cards, in a new random order. */
function studyMissedCards(view) {
  const session = view.session;
  session.order = shuffleSources(listMissedSources(session), Math.random);
  session.round += 1;
  session.results = new Map();
  session.index = 0;
  session.side = "question";
  session.done = false;
  renderContent(view);
  focusAction(view, "show-answer");
}

function restartSession(view) {
  openSetup(view, "restart");
}

function startAgain(view) {
  openSetup(view, "start-again");
}

function startNewSession(view) {
  openSetup(view, "new-session");
}

/** "card" for one, "cards" otherwise. */
function writeCardWord(count) {
  if (count === 1) {
    return "card";
  }
  return "cards";
}

/** A label styled like a side's, after a Lucide icon. */
function buildIconLabel(icon, text) {
  const label = document.createElement("p");
  label.dataset.sideLabel = "";
  label.append(buildIcon(icon), text);
  return label;
}

/**
 * The cards graded "Not yet", on the answer side's tint: under a label with
 * the icon of the "Not yet" button, in a list named by that label. Each card
 * is named by its tile's name, or its file when it has none.
 */
function buildNotYetList(view, missedSources) {
  const notYet = document.createElement("div");
  notYet.dataset.notYet = "";
  const label = buildIconLabel(
    "rotate-ccw",
    `Not yet · ${missedSources.length} ${writeCardWord(missedSources.length)}`,
  );
  label.id = NOT_YET_LABEL_ID;
  const list = document.createElement("ul");
  list.setAttribute("aria-labelledby", NOT_YET_LABEL_ID);
  for (const source of missedSources) {
    const tile = findTile(view, source);
    const item = document.createElement("li");
    item.textContent = readTileName(view, tile) ?? readFileName(tile);
    list.append(item);
  }
  notYet.append(label, list);
  return notYet;
}

/** "Study these M again", or "Study this card again" for one. */
function writeStudyAgainText(missedCount) {
  if (missedCount === 1) {
    return "Study this card again";
  }
  const text = `Study these ${missedCount} again`;
  return text;
}

function buildRoundEndActions(view, missedCount) {
  const actions = document.createElement("footer");
  const startAgainButton = buildActionButton(
    view,
    "start-again",
    "Start again",
    startAgain,
  );
  if (missedCount === 0) {
    startAgainButton.dataset.tesVariant = "primary";
    actions.append(startAgainButton);
    return actions;
  }
  actions.append(
    buildPrimaryButton(
      view,
      "study-missed",
      writeStudyAgainText(missedCount),
      studyMissedCards,
    ),
    startAgainButton,
  );
  return actions;
}

/**
 * The end of a round, in the flashcard: how many cards were known, then the
 * "Not yet" list, or "Every card known", and what to do next.
 */
function buildRoundEnd(view) {
  const session = view.session;
  const missedSources = listMissedSources(session);
  const cardCount = session.order.length;
  const card = buildFlashcard();
  const summary = document.createElement("div");
  summary.dataset.roundEnd = "";
  const message = document.createElement("p");
  message.textContent = `You knew ${cardCount - missedSources.length} of ${cardCount} ${writeCardWord(cardCount)}.`;
  summary.append(message);
  card.append(summary);
  if (missedSources.length === 0) {
    summary.append(buildIconLabel("circle-check", "Every card known"));
  } else {
    card.append(buildNotYetList(view, missedSources));
  }
  card.append(buildRoundEndActions(view, missedSources.length));
  return card;
}

function buildNoSession(view) {
  const noSession = document.createElement("div");
  const message = document.createElement("p");
  message.textContent = "No study session.";
  const actions = document.createElement("p");
  actions.dataset.actions = "";
  actions.append(
    buildPrimaryButton(view, "new-session", "New session", startNewSession),
  );
  noSession.append(message, actions);
  return noSession;
}

function buildStudyContent(view) {
  if (view.session === null) {
    const noSession = buildNoSession(view);
    return noSession;
  }
  const study = document.createElement("div");
  study.dataset.study = "";
  if (view.session.done) {
    study.append(buildRoundEnd(view));
    return study;
  }
  study.append(buildSessionBar(view), buildStudyCard(view));
  return study;
}

// Mount ----------------------------------------------------------------------

function buildContent(view) {
  if (view.tiles.length === 0) {
    const emptyStatus = buildStatus("There are no tiles to show.");
    return emptyStatus;
  }
  if (!view.outlinesReady) {
    const loadingStatus = buildLoadingStatus();
    return loadingStatus;
  }
  if (view.mode === STUDY_MODE) {
    const studyContent = buildStudyContent(view);
    return studyContent;
  }
  const tileTable = buildTileTable(view);
  return tileTable;
}

/** Draws the mode's content, below the header. The dialogs, outside `<main>`, are left as they are. */
function renderContent(view) {
  view.content.replaceChildren(buildContent(view));
}

/** Draws the heading, the mode buttons and the content in `<main>`. */
function renderMain(view) {
  view.main.replaceChildren(buildMainHeader(view), view.content);
  renderContent(view);
}

/** Switches mode without redrawing the buttons, so the pressed one keeps the focus. A session pauses in Explore. */
function chooseMode(view, mode) {
  view.mode = mode;
  for (const button of view.main.querySelectorAll("button[aria-pressed]")) {
    button.setAttribute("aria-pressed", String(button.dataset.action === mode));
  }
  view.setupPending = false;
  renderContent(view);
  if (mode === STUDY_MODE && view.session === null) {
    requestSetup(view, STUDY_MODE);
  }
}

function showLoadedOutlines(view) {
  renderMain(view);
  updateOpenTileCard(view);
  if (view.setup.open) {
    updateOpenSetup(view);
    return;
  }
  if (view.setupPending && view.mode === STUDY_MODE) {
    openSetup(view, view.setupOpener);
  }
  view.setupPending = false;
}

/** The session ends with its results: the tile card opened from it closes, and the next setup says why. */
function endChangedSession(view) {
  view.session = null;
  view.notice = TILES_CHANGED_NOTICE;
  if (view.tileCard.open && view.tileCardOpener.action !== undefined) {
    view.tileCard.close();
  }
  if (view.mode === STUDY_MODE && !view.setup.open) {
    view.setupPending = true;
    view.setupOpener = "new-session";
  }
}

function showChangedTiles(view, params) {
  view.tiles = params.tiles;
  view.outlinesReady = false;
  if (view.session !== null) {
    endChangedSession(view);
  }
  renderMain(view);
  loadOutlines(view);
}

function addFlashcardsStyle() {
  const style = document.createElement("style");
  style.textContent = FLASHCARDS_STYLE;
  document.head.append(style);
}

/** Entry point called by the frame loader with the engine API object and the mount context. */
export default async function mount(engine, context) {
  const view = {
    engine,
    main: document.createElement("main"),
    content: document.createElement("div"),
    tileCard: buildDialog(TILE_CARD_TITLE_ID),
    setup: buildDialog(SETUP_TITLE_ID),
    title: context.mod.title,
    tiles: context.tiles,
    outlines: new Map(),
    outlinesReady: false,
    outlineRound: 0,
    mode: EXPLORE_MODE,
    session: null,
    notice: null,
    storedFields: readStoredFields(null),
    setupFields: null,
    unlockedAnswer: null,
    setupOpener: null,
    setupPending: false,
    openSource: null,
    tileCardOpener: null,
    answerShownAt: null,
  };
  view.tileCard.addEventListener(
    "close",
    showClosedTileCard.bind(undefined, view),
  );
  view.setup.addEventListener("close", showClosedSetup.bind(undefined, view));
  engine.on("tiles.changed", showChangedTiles.bind(undefined, view));
  addFlashcardsStyle();
  document.body.replaceChildren(view.main, view.tileCard, view.setup);
  renderMain(view);
  const storedFields = await engine.request("storage.get", {
    key: STUDY_FIELDS_KEY,
  });
  view.storedFields = readStoredFields(storedFields);
  await loadOutlines(view);
}
