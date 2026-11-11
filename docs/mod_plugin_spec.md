# Mosaic Design (Mod) Specification

Mosaic Designs (or mods) are javascript plugins that allow to visualize and interact with a collection tiles of a given type.

Mods are loaded inside an isolated iframe (sandbox) where it can display their UI. The Mod module inside `src/lib` is in charge of loading/unloading a mod.

Mods can communicates with the main app via the core engine API, like requesting data and receiving data, storing and modifying data, redirecting to another mod. Once a mod is loaded, they can interact with the core engine and request data like the mod API version, tiles, tile collections, mods, mosaics, settings, etc. Each mod can display the data in a customized way inside the sandbox. 

A loaded mod doesn't have direct access to localStorage or indexedDB, it must use the core engine API for operations like requesting, writing or redirecting the user. Mods only have access to their own data and the common (shared) data from the main app via the core engine API. Data from each mod is stored in separated slots.

Mods need a Mosaic for defining the configuration. Mods come with a default mosaic.

As mods are created by the community and they need to follow principles of privacy and security.

Each mod has a required tile type (JTD schema) and they define the minimum fields that must be present in the metadata of the tile in order to be shown in the mod UI (i.e structural typing). Input tiles that have missing fields will be ignored with a warning.

A same tile could be compatible with multiple mods if they have the required fields.

A Mod can use a generic tile type in order to be compatible with any tile, for example defining only optional parameter like title or name. Furthermore, a mod may not need any tile to work, for example a mod for an alternative visualization of the home or the settings page

Mods use configuration files called mod_conf.yaml for defining mod metadata and configuration default values. By default, a mod is a folder that bundles its mod_conf.yaml, its code, its tile type file, a sample collection and its tests, so it can be copied or shared as one folder. `type_path`, `sample_collection` and `test_path` are resolved against the mod_conf.yaml location, and they may also point outside the mod folder or to another site, for example to share one tile type between several mods. For example for a mod called "country_markers_map" that shows input tiles organized by country in a map:

```yaml
mod:
  name: "country_markers_map"
  title: "Country Markers Map"
  version: "1.0.0"
  api: "^0.1.0"
  description: "An interactive world map that display tiles as markers organized by country."
  entrypoint: "./main.js"
  type_path: "./country_location.md"
  sample_collection: "./sample_collection.yaml"
  test_path: "./test.js"
  config:
    map:
      center: [0, 0.0] # [latitude, longitude]
      zoom: 2
      base_layer: "openstreetmap"
    markers:
      color: "#3366cc"
      size: 12
    popup:
      show_image: true
      show_body: false
```

`api` is the range of mod API versions the mod was written for, in npm's semver range syntax. The mod API version is separate from the app's own version and covers what a mod relies on: the engine methods and events, the mount context, the mod file format and the test API (see [Mod tests](#mod-tests)). When the range does not match the app's mod API version, the app asks the user before starting the mod; a mod without `api` runs with a warning. A mod reads the version it runs on in its mount context, as `context.api.version`.

The tile type is a markdown file whose frontmatter has a `schema` mapping, here `country_location.md` next to mod_conf.yaml:

```markdown
---
schema:
  definitions:
    country_location:
      properties:
        title:
          type: string
        country:
          type: string
      optionalProperties:
        image:
          type: string
        date:
          type: string
      additionalProperties: true
  ref: country_location
---

# Country Location

Tiles with a title and the country they are located in.
```

## Showing a tile's body

A tile's `body` is markdown, as its author wrote it. A mod does not need a markdown parser to show it: the engine renders it to safe HTML that works inside the mod's sandbox, with images, video, audio and pictures, paths resolved against the tile, links that open through the app and a placeholder for each video or audio player (see [Tile bodies](modules/lib/core/engine/README.md#tile-bodies) in the engine's README).

The simplest way is the `ot-tile-body` element, which every mod frame defines. Set its `tile` to one of the tiles of the mount context:

```js
export default function mount(engine, context) {
  for (const tile of context.tiles) {
    const article = document.createElement("article");
    const title = document.createElement("h2");
    title.textContent = tile.metadata.title;
    const body = document.createElement("ot-tile-body");
    body.tile = tile;
    article.append(title, body);
    document.body.append(article);
  }
}
```

The element sends `tiles.renderBody`, shows the result as its children and fires a bubbling `ot-rendered` event. The theme styles the rendered body, alerts and player placeholders, and the mod's CSS can style it too, since it is in the light DOM.

The element also draws the body's diagrams: each fenced `mermaid` block becomes a `<figure data-mermaid-source>` holding the diagram as an SVG, in the theme's colors, drawn again when the color scheme changes. The text shows first: a block stays as code until its diagram replaces it, blocks are drawn one at a time as they come into view, and a block mermaid cannot draw stays as code. A block waiting for its diagram, or a diagram being drawn again, has `aria-busy="true"`, which the base stylesheet pulses; the drawn figure, a failed block and a block out of view have none. Labels are text, so a diagram's markup adds no element; an image shape's picture loads only from a host in `permissions.show`, and from another host the block stays as code. Mermaid's built-in icons are drawn, but icon packs are not registered (see [Diagrams](modules/lib/core/tile_bodies/README.md#diagrams) in the tile bodies module). The element fires a bubbling `ot-diagrams-drawn` event each time the blocks in view are drawn; `ot-rendered` still fires first, as soon as the text is shown. A body without mermaid blocks fires none, and so does a body replaced or removed before its diagrams are drawn. To keep the blocks as code, and never load the library, set `diagrams` to `"source"` before `tile` (the default is `"draw"`):

```js
const body = document.createElement("ot-tile-body");
body.diagrams = "source";
body.tile = tile;
```

To place the HTML yourself, send the request:

```js
const { html } = await engine.request("tiles.renderBody", {
  source: tile.source,
});
container.innerHTML = html;
```

A rendered body holds GitHub-flavored markdown and the HTML GitHub allows, with `<video>`, `<audio>` and `<picture>`, alerts (`aside.ot-alert`) and player placeholders (`button.ot-player`). Formulas between dollars and fenced `math` blocks are MathML: each `<math>` keeps the formula's source in its `<annotation encoding="application/x-tex">`, and a formula that cannot be rendered stays as `code.language-math` with `data-ot-math-error`. Code blocks labeled with a common language are highlighted with `hljs-` spans the theme colors, and emoji shortcodes such as `:tada:` are emoji. When a library a body needs cannot be loaded, the request fails with `-32603`, and `ot-tile-body` shows the message (see [Tile bodies](modules/lib/core/tile_bodies/README.md#math) in the tile bodies module).

Either way, the frame loader handles clicks in the rendered body: a link asks the user to open it in a new tab (`links.open`), a link to a heading of the body scrolls to it, and a click on a player placeholder asks the user to play it in the app's player dialog (`players.open`). A mod writes no code for them.

To handle a click yourself, cancel it in your own listener with `preventDefault()`: the frame loader then leaves it alone. Do not only stop its propagation: a link click that is not cancelled navigates the mod's frame, which stops the mod.

```js
function openInViewer(event) {
  const link = event.target.closest("a[data-ot-link]");
  if (link === null) {
    return;
  }
  event.preventDefault();
  showTileFromLink(link.href);
}

document.addEventListener("click", openInViewer);
```

A body placed this way shows its mermaid blocks as code: to draw them, load the library as the next section shows.

## Telling the user something

A mod draws what it wants in its frame, but the frame is the mod's own page: the user cannot tell an error the app found from one the mod made up. To tell the user something outside its frame, a mod sends `ui.notify`, and the app adds the message to the mod's stage bar, under the errors, warnings or notifications button, labeled "Mod" (see [Telling the user something](modules/lib/core/engine/README.md#telling-the-user-something) in the engine's README):

```js
export default async function mount(engine, context) {
  if (context.tiles.length === 0) {
    await engine.request("ui.notify", {
      message: "No books found",
      level: "error",
    });
    return;
  }
  showBooks(context.tiles);
  await engine.request("ui.notify", { message: "Loaded" });
}
```

`level` is `"info"` (the default), `"warning"` or `"error"`, and `source`, by default the mod's source, says what the message is about, such as a tile's `source`. The message is plain text of at most 1000 characters. It needs no permission and no dialog, and hidden mods can send it too. The app keeps the last 100 messages of each level from the mod in its sandbox and says how many older ones it dropped, so notifications never push out the mod's errors or warnings. A check records the mod's errors and warnings as findings, and a test case reads the request from `requests` (see [Checking a mod](#checking-a-mod) and [What a case records](#what-a-case-records)).

## Libraries

The app ships some large libraries that a mod can use without bundling them or loading code from another site: `libs.load` installs one in the mod's frame, from the app's own copy (see [Libraries](modules/lib/core/engine/README.md#libraries) in the engine's README). Today there is one, `mermaid` at major version `12`, ready as `globalThis.mermaid`. A mod asks for a major version, and the result gives the full version installed.

This mod draws a diagram and draws it again in the new colors when the user switches between light and dark:

```js
const SOURCE = "flowchart LR\n  Tile --> Mod";

let diagramCount = 0;

async function drawDiagram(figure, theme) {
  globalThis.mermaid.initialize({
    startOnLoad: false,
    securityLevel: "strict",
    htmlLabels: false,
    theme: theme.colorScheme === "dark" ? "dark" : "default",
  });
  diagramCount += 1;
  const diagram = await globalThis.mermaid.render(
    `diagram-${diagramCount}`,
    SOURCE,
  );
  figure.innerHTML = diagram.svg;
}

export default async function mount(engine, context) {
  await engine.request("libs.load", { name: "mermaid", version: "12" });
  const figure = document.createElement("figure");
  document.body.append(figure);
  await drawDiagram(figure, context.theme);
  engine.on("theme.changed", drawDiagram.bind(undefined, figure));
}
```

- Draw with `securityLevel: "strict"` and `htmlLabels: false` when the source comes from tiles: labels are then SVG text, and diagrams hold no click handlers. Add `"htmlLabels"` to `secure` too (`secure: [...globalThis.mermaid.mermaidAPI.defaultConfig.secure, "htmlLabels"]`), or a diagram can turn HTML labels back on in its front matter or an `%%{init}%%` directive.
- Load the library only when the mod needs it: it is about 5.5 MB, and each frame that loads it pays its install, a few tenths of a second.
- A second `libs.load` resolves at once with the same result, so a mod can ask before each use.

## Bundling a mod

A mod can be written in TypeScript, split into modules, or use npm packages, as long as what it ships follows one rule: **each entry point is one self-contained ES module.** The frame loader fetches the entrypoint as text and imports it from a `blob:` URL, and a relative `import` cannot be resolved from a `blob:` URL. So a bundler must give the mod one file for `entrypoint`, and one for `test_path` if the mod has tests:

- **One ESM file per entry point.** Output format `esm`, for the browser, with the entry's default export kept as the file's default export.
- **Dependencies inlined.** Every module the entry imports, the mod's own and npm packages alike, goes into that file. Nothing is left external.
- **No code splitting.** Dynamic `import()` calls are inlined too, so the bundle never loads a second chunk. With Rolldown, that is `output.codeSplitting: false`; with Rollup or Vite, `inlineDynamicImports: true`; with esbuild, `bundle: true` without `splitting`.
- **Libraries through bundling, `libs.load` or `ot-tile-body`.** A small library is bundled like any dependency. A large one the app ships, such as mermaid, comes from `libs.load` (see [Libraries](#libraries)), and a tile's markdown from `ot-tile-body` (see [Showing a tile's body](#showing-a-tiles-body)), so the mod bundles neither. Loading code from another site needs a `code` permission and the user's consent: a bundle avoids both.
- **Test files bundled the same way.** The test file is fetched and imported like the entrypoint, so it is one self-contained ES module too. It may import the mod's helpers, which the bundle inlines, but it does not import the entrypoint: each case mounts the mod through its context (see [Mod tests](#mod-tests)).
- **HTTP caching.** The app fetches `mod_conf.yaml`, the entrypoint and the test file with the browser's ordinary HTTP cache. Serve them so a new version is seen: either with revalidation (`Cache-Control: no-cache` and an `ETag`), or with bundles named after their content, such as `main.3f9a2c.js`, cached for long and named by a `mod_conf.yaml` that is always revalidated.

Ship only what the bundler outputs, `mod_conf.yaml` and the mod's data files. The sources, the bundler's config and the `node_modules/` stay in your repository.

The app's own default mods are the worked example (see the [default mods folder](../default_mods/README.md)). Each is written in TypeScript, as `src/main.ts` and the modules it imports, with its tests in `test/test.ts`. The app's build bundles each entry point with Rolldown, in `build/default_mod_build.ts`: `src/main.ts` becomes `main.js` and `test/test.ts` becomes `test.js`, with ESM output, the browser as platform, dynamic imports inlined, no code splitting and no minifying, so the shipped code stays readable. A bundle that still holds an `import` statement or an `import(` call fails the build, and so does an import that leaves the mod's folder. The mods are typed with `default_mods/mod_api.d.ts`, imported with `import type` so it adds nothing to the bundle. Their `mod_conf.yaml` names the outputs, as any mod's does:

```yaml
mod:
  name: "mod_viewer"
  entrypoint: "./main.js"
  test_path: "./test.js"
```

## Checking a mod

A mod can be checked before anyone runs it, with no code from its author. Open the mod in the mod viewer (`#/run?mod=mod_viewer&target=<mod reference>`) and press "Check mod". The viewer sends `mods.check` with the mod's source, and with the collection field's address when it holds one; otherwise the mod's sample collection is used. Any visible mod with an `open` permission for the mod's site can send `mods.check` the same way.

The check has three steps:

- **Bundle check**: the mod file, the entrypoint, the tile type and the collection must load, and the collection's tiles are validated against the tile type. A file that cannot be loaded or has the wrong format is an error naming that file. A tile that does not match the type is a warning naming the tile. A missing `api` range, or one that does not match the app's mod API version, is a warning: the check asks nothing.
- **Mount check**: when the bundle check found no error, the mod is mounted in a hidden frame, with the permissions it would get if it were opened, the tiles of its type and an empty storage slot that is thrown away afterwards; the mod's real slot is never read nor written. The check records a `mount` that throws or rejects, a mod that left its page, blocked requests and blocked browser dialogs, every request answered with `-32600`, `-32601` or `-32602` (a message that is not a request, an unknown method, bad params), and the requests that would need the user (`links.open`, `files.save`, `ui.confirm` and `players.open` answer `false`, `mods.open` and `mods.check` are refused), without showing any dialog. `ui.notify` answers `null`, and each notification with level `"error"` or `"warning"` is a finding at that level, with the notification's source and message; an `"info"` one is none. A `mount` that has not finished after 10 seconds is an error. Only the start of the mod is watched: the mount check ends 1 second after `mount` finished, so timers and requests that start later are not recorded.
- **Tests**: when the mod declares `test_path` and neither step found an error, the mod's own tests run, one case after another (see [Mod tests](#mod-tests)).

The report's status is `pass` when there are no findings, `warn` when there are only warnings and `fail` when a finding is an error. Each finding names its step (`bundle`, `mount` or `test`), its level, the file or mod it is about and a message. `tests` lists each case with its status (`pass` or `fail`) and, for a failed case, the message, and `testsChecked` says whether the cases ran. The check leaves the app as it was: no new sandbox, history entry or stage bar item.

## Mod tests

The bundle and mount checks tell whether a mod's files fit together and whether it starts and uses the mod API correctly, not whether it does what you meant: that it lists the books, that a click stores the selection, that it asks before deleting. Tests say that. They ship in the mod's folder and the app runs them as part of every check, so they hold wherever the mod is served and whatever OpenTesela runs it, with no tools on either side.

### The test file

Declare the test file in mod_conf.yaml with `test_path`, resolved against mod_conf.yaml like the entrypoint:

```yaml
mod:
  name: "book_list"
  entrypoint: "./main.js"
  test_path: "./test.js"
```

The test file is an ES module whose default export is a function. The app calls it with `t`, and `t.test(name, fn)` registers a case: a non-empty name that no other case has, and a plain or async function that receives the case context. The test file cannot import the entrypoint: each case mounts the mod through its context. An excerpt of the sample book list mod's `public/samples/mods/book_list/test.js`:

```js
/**
 * Tests of the sample mod, which `mods.check` runs after mounting it. Each
 * case runs in a fresh hidden frame with a throwaway storage slot, and
 * mounts the mod itself through its context.
 */

function findBookButton(context, title) {
  for (const button of context.root.querySelectorAll("li > button")) {
    if (button.getAttribute("aria-label").startsWith(title)) {
      return button;
    }
  }
  throw new Error(`No book button is named "${title}"`);
}

function readBooksPerRowChoice(context) {
  const select = context.root.querySelector("select");
  return select.value;
}

async function listsTheSampleBooks(context) {
  await context.mount();
  context.expect(context.root.querySelectorAll("li").length).toBe(3);
}

async function remembersTheBooksPerRow(context) {
  await context.storage.set("columns", 10);
  await context.mount({ config: { columns: 4 } });
  context.expect(readBooksPerRowChoice(context)).toBe("10");
}

function readExpandedStates(context) {
  const states = [];
  for (const button of context.root.querySelectorAll("li > button")) {
    states.push(button.getAttribute("aria-expanded"));
  }
  return states;
}

function isUnmarked(button) {
  return button.getAttribute("aria-expanded") === "false";
}

async function unmarksTheBookWhenItsCardCloses(context) {
  await context.mount();
  const kallocain = findBookButton(context, "Kallocain");
  kallocain.click();
  context.root.querySelector("dialog").close();
  await context.waitFor(isUnmarked.bind(undefined, kallocain));
  context
    .expect(readExpandedStates(context))
    .toEqual(["false", "false", "false"]);
}

export default function registerBookListTests(t) {
  t.test("lists the sample books", listsTheSampleBooks);
  // …
  t.test("remembers the books per row", remembersTheBooksPerRow);
  // …
  t.test(
    "unmarks the book when its card closes",
    unmarksTheBookWhenItsCardCloses,
  );
}
```

Write test files like the mod's own code: named functions for the cases and for the conditions you wait for, and no anonymous callbacks.

The test file is fetched only by a check, after the mount check found no error: never when the mod is opened or inspected. A test file that cannot be loaded or imported, has no default export function, throws while registering, registers a case with an empty or repeated name, or registers no case is a `test` error naming the test file, and no case runs.

### The case context

Each case runs in a fresh hidden frame, with the content policy and permissions the mod would get if it were opened, and a throwaway storage slot that starts empty. Nothing a case does is seen by another case, or by the mod's real slot. The mod is not mounted until the case calls `mount`. The case function receives:

| Name | What it is |
|---|---|
| `mount(options?)` | Calls the mod's real `mount` with the engine API object and a mount context built as for a check, and resolves once it finished. `options.tiles` replaces the tiles, `options.config` replaces the config keys it names, and `options.params` is the context's `params`. When the mod's `mount` throws or rejects, `mount` rejects with that error. A second call rejects with `the mod is already mounted`. |
| `root` | The frame's body, where the mod draws. |
| `tiles` | The tiles the check gives: the collection's, or the mod's sample collection's, of the mod's tile type. |
| `storage` | `get(key)` and `set(key, value)` on the case's slot, with the rules of `storage.get` and `storage.set`. Usable before `mount`, to seed what the mod reads. |
| `requests` | Each request the mod sent, in order, as `{ method, params, result }` once it resolved, or `{ method, params, error }` with the error's `code` and `message`. |
| `answer(method, value)` | Scripts the answer to the next request for `method` (see below). |
| `expect(actual)` | The expectations (see below). |
| `waitFor(fn, timeout?)` | Calls `fn` until it returns a truthy value without throwing, and resolves with that value (see below). |

### Scripted answers

A check shows no dialog. `answer(method, value)` queues the answer to the next request for `method`: `links.open`, `files.save`, `ui.confirm` or `players.open` with a boolean, or `mods.open` with `null`. The request resolves with it, a `mods.open` answered this way opens nothing, and a `players.open` answered this way requests nothing from the player's site. Requests without a queued answer get what the mount check gives: `false` for `links.open`, `files.save`, `ui.confirm` and `players.open`, and `-32002` for `mods.open` and `mods.check`. In a case, none of them is a finding. A wrong method or value throws at once, for example `the answer to ui.confirm must be a boolean`. The app still checks each request's params, so a `links.open` with a bad address fails as it would in the app, and leaves its answer queued.

```js
function hasNoBooks(context) {
  return context.root.querySelectorAll("li").length === 0;
}

async function deletesAfterConfirming(context) {
  await context.mount();
  context.answer("ui.confirm", true);
  context.root.querySelector("button.delete").click();
  await context.waitFor(hasNoBooks.bind(undefined, context));
}
```

### Expectations and waiting

`expect(actual)` returns matchers that throw an error naming the expected and the actual value when they fail, such as `Expected 2 to be 3`:

- `toBe(expected)`: the same value, by `Object.is`;
- `toEqual(expected)`: equal plain data, lists by their items in order and mappings by their keys in any order;
- `toContain(item)`: a string's substring, or a list's item by `toEqual`;
- `toBeTruthy()`.

`expect(actual).not` has the same matchers with the opposite result.

`waitFor(fn, timeout)` calls `fn` every 50 milliseconds until it returns a truthy value without throwing, and resolves with that value. When `timeout` milliseconds (2000 by default) pass first, it rejects with an error that includes the last error `fn` threw. Use it for what the mod does after `mount` resolved, such as drawing after a click or a timer.

### What a case records

While a case runs, the check records what the mount check would, as `test` findings whose message starts with `In the test "<name>": `: blocked requests and blocked browser dialogs as warnings, and each request answered with `-32600`, `-32601` or `-32602` as an error. A `mount` that throws or rejects is not a finding: it rejects the case's `mount` call, so a case can expect it. A `ui.notify` answers `null` and is not a finding, whatever its level, so a case can expect a mod's error notification: read it from `requests`, which lists `ui.notify` with its params and result `null`.

A case passes when its function finishes without throwing. It fails when its function throws or rejects, when its frame leaves its page, or when it has not finished 10 seconds after its frame started. A failed case is listed in the report's `tests` with its message, and it is also a `test` error, `The test "<name>" failed: <message>`, naming the test file, so the report fails. A failing case does not stop the others. The cases run one after another, each with up to 10 seconds, so keep them short.
