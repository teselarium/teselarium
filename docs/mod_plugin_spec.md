# Mosaic Design (Mod) Specification

Mosaic Designs (or mods) are javascript plugins that allow to visualize and interact with a collection tiles of a given type.

Mods are loaded inside an isolated iframe (sandbox) where it can display their UI. The Mod module inside `src/lib` is in charge of loading/unloading a mod.

Mods can communicates with the main app via the core engine API, like requesting data and receiving data, storing and modifying data, redirecting to another mod. Once a mod is loaded, they can interact with the core engine and request data like the mod API version, tiles, tile collections, mods, mosaics, settings, etc. Each mod can display the data in a customized way inside the sandbox. 

A loaded mod doesn't have direct access to localStorage or indexedDB, it must use the core engine API for operations like requesting, writing or redirecting the user. Mods only have access to their own data and the common (shared) data from the main app via the core engine API. Data from each mod is stored in separated slots.

A mosaic is a file that opens a mod with a collection, the way the data's author wants it shown: it names the mod and the collection, overrides values of the mod's config, renames the collection's field names to the names of the mod's tile type (`aliases`), and declares the `show` hosts the collection's media need. A mod needs no mosaic: it runs from a mod link with its own config. When it is opened from a mosaic, it reads the mosaic in `context.mosaic`, gets the merged config in `context.config` and the renamed tiles in `context.tiles`, and its sandbox gets the mosaic's granted `show` lines in `context.permissions` (see the [mosaic module](modules/lib/mosaic/README.md)).

As mods are created by the community and they need to follow principles of privacy and security.

Each mod has a required tile type (JTD schema) and they define the minimum fields that must be present in the metadata of the tile in order to be shown in the mod UI (i.e structural typing). Input tiles that have missing fields will be ignored with a warning.

A same tile could be compatible with multiple mods if they have the required fields.

A Mod can use a generic tile type in order to be compatible with any tile, for example defining only optional parameter like title or name. Furthermore, a mod may not need any tile to work, for example a mod for an alternative visualization of the home or the settings page

Mods use configuration files called mod_conf.yaml for defining mod metadata and configuration default values. By default, a mod is a folder that bundles its mod_conf.yaml, its code, its tile type file, its default mosaic and its tests, so it can be copied or shared as one folder. `title`, the mod's name as people read it, is required. `type_path`, `default_mosaic` and `test_path` are resolved against the mod_conf.yaml location, and they may also point outside the mod folder or to another site, for example to share one tile type between several mods. For example, the sample country map mod the app ships, `public/samples/mods/country_map/`, shows the tiles of any collection organized by country on a world map. Its `default_mosaic`, `mosaic.yaml` next to it, opens it with its own sample collection, eleven UNESCO World Heritage Sites in its `sites/` folder, and declares the `show` permission that lets the cards show the sites' images from `https://upload.wikimedia.org`, since that host belongs to the data rather than to the mod. To show a mod with data from elsewhere, write a standalone mosaic rather than a default mosaic that points outside the mod folder: `samples/mosaics/nobel_laureates_map.yaml`, for example, opens the country map with the Nobel laureates (see [Mosaics](modules/mosaics/README.md)). Its `libraries` are covered in [Declared libraries](#declared-libraries):

```yaml
mod:
  title: "Country Map"
  version: "1.0.1"
  api: "^0.1.14"
  description: "Shows any collection on a world map, with a marker per country, a list of its tiles and a card for each one."
  entrypoint: "./main.js"
  type_path: "./country_tile_type.md"
  default_mosaic: "./mosaic.yaml"
  test_path: "./test.js"
  libraries:
    leaflet:
      npm: "leaflet@1.9.4"
      files: ["dist/leaflet.js", "dist/leaflet.css"]
    topojson_client:
      npm: "topojson-client@3.1.0"
      files: ["dist/topojson-client.min.js"]
    proj4:
      npm: "proj4@2.23.0"
      files: ["dist/proj4.js"]
    world_atlas:
      npm: "world-atlas@2.0.2"
      files: ["countries-110m.json"]
```

Its default mosaic, `mosaic.yaml`, names the mod's own folder with `mod: "./"`. The mod viewer's "Open default mosaic" opens it, and `mods.check` without a collection checks the mod with it (see [Mosaics](modules/mosaics/README.md#a-mods-default-mosaic)):

```yaml
mosaic:
  title: "UNESCO World Heritage Sites Example"
  mod: "./"
  collection: "./sites/collection.yaml"
  permissions:
    show:
      - host: "https://upload.wikimedia.org"
        reason: "Shows the sites' images"
```

`api` is the range of mod API versions the mod was written for, in npm's semver range syntax. The mod API version is separate from the app's own version and covers what a mod relies on: the engine methods and events, the mount context, the mod file format and the test API (see [Mod tests](#mod-tests)). When the range does not match the app's mod API version, the app asks the user before starting the mod; a mod without `api` runs with a warning. A mod reads the version it runs on in its mount context, as `context.api.version`.

The tile type is a markdown file whose frontmatter has a `schema` mapping, here `country_tile_type.md` next to mod_conf.yaml. Its body tells the user what the type means:

````markdown
---
schema:
  definitions:
    country_tile:
      properties:
        title:
          type: string
        country:
          type: string
      additionalProperties: true
  ref: country_tile
---

# Country Tile Type

Any tile with a string `title` and a string `country` is a country tile. Other
keys are allowed, and the card shows them as labeled values.

## Country names

A tile belongs to a country of the map when its `country`, trimmed, is the
country's name or one of its common names, ignoring case and accents. The map
is Natural Earth's 1:110m countries (`countries-110m.json` of `world-atlas`),
which writes some names short or formally, such as "United States of America",
"Czechia", "Côte d'Ivoire" or "Dem. Rep. Congo". Their common names also
match: "United States", "USA", "Czech Republic", "Ivory Coast", "DR Congo", and
so on. A country is shown with the `country` of its first tile, as written.

## Not on the map

A tile whose country matches no country of the map is listed under "Not on the
map": an empty or unknown name, a country too small for the 1:110m map, such
as Singapore, or a country that no longer exists, such as the Soviet Union. No
tile is left out.
````

## Width and layout

A mod's frame fills the stage area. By default, its layout is `contained`: the base stylesheet keeps `<body>` at most `--ot-content-width` wide and centered, so content stays readable on a wide screen. The user can turn on theater mode from the stage bar, where the body has no limit, or show the mod fullscreen. A mod reads its layout as `context.layout` or from the `data-ot-layout` attribute on `<html>`, and receives `layout.changed` with `{ layout }` when it changes (see [Write HTML, get the app's look](modules/lib/core/theme/README.md#write-html-get-the-apps-look) in the theme's README). A mod that needs the full width in every layout, such as media, a map or a game, adds one style:

```css
body { max-width: none; }
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

## Inspecting collections

A mod can read what a tile collection holds without being opened with it: `collections.inspect` reads the collection file alone and answers its `source`, `name`, `description`, `tiles` (the address of each tile it lists) and `issues` (its entry issues), with no tile requested (see [Inspecting collections](modules/lib/core/engine/README.md#inspecting-collections) in the engine's README). It needs an `open` permission for the collection's site, or for `"*"`, as inspecting a mod does:

```yaml
  permissions:
    open:
      - host: "*"
        reason: "Lists the collections you pick"
```

```js
const inspection = await engine.request("collections.inspect", {
  collection: "./samples/tiles/literature_nobel_laureates/collection.yaml",
});
showCollection(inspection.title, inspection.description, inspection.tiles);
```

The location is resolved against the app's address, and a folder means the `collection.yaml` in it, so `./samples/tiles/literature_nobel_laureates` names the same collection. A collection that cannot be loaded answers `-32001` with the load error's message, and one whose site the mod's `open` does not cover answers `-32002`, before anything is requested.

## Opening a mosaic

A mod can read a mosaic file without opening it, with `mosaics.inspect`, and open it, with `mosaics.open`, as if the user had followed its link `#/run?mosaic=…` (see [Inspecting and opening mosaics](modules/lib/core/engine/README.md#inspecting-and-opening-mosaics) in the engine's README). Both need an `open` permission for the mosaic file's site, or for `"*"`. Only the mosaic file's site is checked, not the site of the mod it names: that mod still gets its own mod API question and site consent when it opens.

```js
const inspection = await engine.request("mosaics.inspect", {
  mosaic: "./samples/mosaics/nobel_map",
});
showMosaic(inspection.title, inspection.description, inspection.mod);

await engine.request("mosaics.open", {
  mosaic: inspection.source,
  params: { from: context.mod.source },
});
```

`mosaics.inspect` answers the mosaic's `source`, `title`, `description`, the resolved `mod` and `collection`, its own `config` and `aliases`, and `permissions`, the `granted` and `denied` lists its `show` lines would get without asking; it requests nothing else and never asks the user. `mosaics.open` takes `params`, without `mod`, `collection`, `tile`, `mosaic` or `sites`, and `replace`, as `mods.open` does, and only the visible mod can open mosaics. The mosaic's load failures belong to the new sandbox.

The mod opened from a mosaic tells it apart from a mod link with `context.mosaic`:

```js
export default function mount(engine, context) {
  const heading = document.createElement("h1");
  heading.textContent = context.mosaic?.title ?? context.mod.title;
  document.body.append(heading);
}
```

## Opening a tile

A mod opens another mod with `mods.open`, which needs the same `open` permission. With `tile`, the location of one tile file, the opened mod receives that tile as `context.tiles`, loaded and validated before its frame starts, with its media allowed as for the tiles of a collection (see [Inspecting and opening mods](modules/lib/core/engine/README.md#inspecting-and-opening-mods) in the engine's README). A link has a collection or a tile, not both, and `mod`, `collection`, `tile`, `mosaic` and `sites` cannot be passed in `params`:

```js
await engine.request("mods.open", {
  mod: context.config.tile_viewer,
  tile: inspection.tiles[0],
  params: { from: inspection.source },
});
```

With `replace: true`, the opened mod takes the place of the requesting one in the same history entry, so stepping through tiles does not pile up entries or frames. The requesting mod is stopped and gets no answer, so it sends this last. The Home mod at `#/` cannot be replaced:

```js
await engine.request("mods.open", {
  mod: context.config.tile_viewer,
  tile: nextTile,
  params: { from },
  replace: true,
});
```

## Libraries

`libs.load` installs a library in the mod's frame, without the mod bundling it or loading code from another site (see [Libraries](modules/lib/core/engine/README.md#libraries) in the engine's README). There are two kinds: the libraries the app ships, and the ones the mod declares in its `mod_conf.yaml`.

### Libraries the app ships

The app ships some large libraries, from its own copy. Today there is one, `mermaid` at major version `12`, ready as `globalThis.mermaid`. A mod asks for a major version, and the result gives the full version installed.

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

### Declared libraries

Any other library a mod uses can be declared under `libraries` in its `mod_conf.yaml`: an npm package at an exact version, with the files the mod needs, or files next to the mod. The mod then loads it by name with `libs.load`, and the app fetches the files and installs them in the frame. The mod needs no bundler, no `code` permission and no consent, and every dependency is written in the mod file, where `mods.inspect` lists it and a mod check fetches it.

The sample country map mod, `public/samples/mods/country_map/`, is the complete example: its `main.js` holds only the mod's own logic, and Leaflet, topojson-client, proj4, which projects the map in Equal Earth, and the world's countries from npm come from its declarations. Its `libraries`, shortened here to what loading them needs:

```yaml
mod:
  title: "Country Map"
  version: "1.0.0"
  api: "^0.1.14"
  entrypoint: "./main.js"
  libraries:
    leaflet:
      npm: "leaflet@1.9.4"
      files: ["dist/leaflet.js", "dist/leaflet.css"]
    topojson_client:
      npm: "topojson-client@3.1.0"
      files: ["dist/topojson-client.min.js"]
    proj4:
      npm: "proj4@2.23.0"
      files: ["dist/proj4.js"]
    world_atlas:
      npm: "world-atlas@2.0.2"
      files: ["countries-110m.json"]
```

```js
export default async function mount(engine, context) {
  await engine.request("libs.load", { name: "leaflet" });
  await engine.request("libs.load", { name: "topojson_client" });
  await engine.request("libs.load", { name: "proj4" });
  const { files } = await engine.request("libs.load", { name: "world_atlas" });
  const world = JSON.parse(files["countries-110m.json"]);
  const container = document.createElement("div");
  container.style.height = "100vh";
  document.body.append(container);
  const map = globalThis.L.map(container, { crs: globalThis.L.CRS.Simple });
  const equalEarth = globalThis.proj4("EPSG:4326", "+proj=eqearth");
  // ... project each position of `globalThis.topojson.feature(world, world.objects.countries)`
  // with `equalEarth.forward([longitude, latitude])`, and draw it and the tiles on `map`
}
```

The same mod with its own copy of the files, next to `mod_conf.yaml`:

```yaml
mod:
  title: "country_map"
  version: "0.1.0"
  api: "^0.1.10"
  entrypoint: "./main.js"
  libraries:
    leaflet:
      files: ["./vendor/leaflet.js", "./vendor/leaflet.css"]
    world_atlas:
      files: ["./vendor/countries-110m.json"]
```

- `npm` is `"<package>@<exact version>"`, such as `leaflet@1.9.4` or `@turf/helpers@7.2.0`. A range (`^1.9.4`) or a tag (`latest`) is a mod format error: npm never replaces a published version, so the exact version pins the files. Without `npm`, the files are resolved against `mod_conf.yaml`, like `entrypoint`.
- `files` lists the files the mod needs, in order: paths inside the package for an npm library. A `.js` file runs as a classic script, each one after the previous one, so a plugin goes after the library it extends; a `.css` file is added as a stylesheet, before the mod's own styles, so the mod's rules win at equal specificity; any other file, such as JSON, is data, which the result's `files` gives the mod as text, by path. A relative `url()` in a declared stylesheet does not resolve.
- Pick the package's UMD or IIFE build, the one that sets a global such as `globalThis.L`. ES module builds are not supported: an `.mjs` file is a mod format error.
- `version` may be left out of the request, or be the declared version. The result is `{ name, version, files }`, with the declared version, or `null` for files next to the mod.
- In the vanilla app, npm files come from jsDelivr, at `https://cdn.jsdelivr.net/npm/<package>@<version>/<path>`. An instance can choose another npm host. The app's page fetches them, not the mod's frame, so jsDelivr sees the user's address and the package names, not the mod. A file is fetched the first time a mod loads its library, once per page, and two mods that declare the same files share the download.
- A file that cannot be fetched fails the request with `-32001`, naming the library, the file and the host's reason, such as `Couldn't find the requested release version 9.9.9.`, and installs nothing. A mod check reports it too (see [Checking a mod](#checking-a-mod)).

## Bundling a mod or declaring its libraries

A mod can be written in TypeScript, split into modules, or use npm packages, as long as what it ships follows one rule: **each entry point is one self-contained ES module.** The frame loader fetches the entrypoint as text and imports it from a `blob:` URL, and a relative `import` cannot be resolved from a `blob:` URL. So a bundler must give the mod one file for `entrypoint`, and one for `test_path` if the mod has tests:

- **One ESM file per entry point.** Output format `esm`, for the browser, with the entry's default export kept as the file's default export.
- **Dependencies inlined.** Every module the entry imports, the mod's own and npm packages alike, goes into that file. Nothing is left external.
- **No code splitting.** Dynamic `import()` calls are inlined too, so the bundle never loads a second chunk. With Rolldown, that is `output.codeSplitting: false`; with Rollup or Vite, `inlineDynamicImports: true`; with esbuild, `bundle: true` without `splitting`.
- **Libraries through bundling, declaring, `libs.load` or `ot-tile-body`.** A small library is bundled like any dependency. A large one the app ships, such as mermaid, comes from `libs.load` (see [Libraries](#libraries)), and a tile's markdown from `ot-tile-body` (see [Showing a tile's body](#showing-a-tiles-body)), so the mod bundles neither. Any other large library, or one the author would rather not bundle, can be declared in `mod_conf.yaml` and loaded with `libs.load` too (see [Declared libraries](#declared-libraries)). Loading code from another site yourself needs a `code` permission and the user's consent: a bundle or a declaration avoids both.
- **Test files bundled the same way.** The test file is fetched and imported like the entrypoint, so it is one self-contained ES module too. It may import the mod's helpers, which the bundle inlines, but it does not import the entrypoint: each case mounts the mod through its context (see [Mod tests](#mod-tests)).
- **HTTP caching.** The app fetches `mod_conf.yaml`, the entrypoint and the test file with the browser's ordinary HTTP cache. Serve them so a new version is seen: either with revalidation (`Cache-Control: no-cache` and an `ETag`), or with bundles named after their content, such as `main.3f9a2c.js`, cached for long and named by a `mod_conf.yaml` that is always revalidated.

Ship only what the bundler outputs, `mod_conf.yaml` and the mod's data files. The sources, the bundler's config and the `node_modules/` stay in your repository.

A plain JavaScript mod needs no bundler at all: one `main.js` that imports nothing, plus its declared libraries. When to declare rather than bundle:

- **Declare** a large library with a browser build, such as a map, chart or data library, or a data file from npm: the mod stays one plain file, the version shows in the mod file, and two mods share one download.
- **Bundle** a library that only has an ES module build, small helpers, and anything the mod imports by name: the frame cannot resolve `import` statements, so they need the bundler either way.
- **Vendor the files next to the mod** when the mod must work offline or on a network that blocks the npm host: download the package's files into the mod's folder and declare them without `npm`. The app then fetches them from the mod's own host.

The app's own default mods are the worked example (see the [default mods folder](../default_mods/README.md)). Each is written in TypeScript, as `src/main.ts` and the modules it imports, with its tests in `test/test.ts`. The app's build bundles each entry point with Rolldown, in `build/default_mod_build.ts`: `src/main.ts` becomes `main.js` and `test/test.ts` becomes `test.js`, with ESM output, the browser as platform, dynamic imports inlined, no code splitting and no minifying, so the shipped code stays readable. A bundle that still holds an `import` statement or an `import(` call fails the build, and so does an import that leaves the mod's folder. The mods are typed with `default_mods/mod_api.d.ts`, imported with `import type` so it adds nothing to the bundle. Their `mod_conf.yaml` names the outputs, as any mod's does:

```yaml
mod:
  title: "mod_viewer"
  version: "0.1.0"
  entrypoint: "./main.js"
  test_path: "./test.js"
```

## Checking a mod

A mod can be checked before anyone runs it, with no code from its author. Open the mod in the mod viewer (`#/run?mod=mod_viewer&target=<mod reference>`) and press "Check mod". The viewer sends `mods.check` with the mod's source, and with the collection field's address when it holds one. With a collection, the mod is checked with its own config and permissions. Without one, it is checked as its default mosaic opens it: with the mosaic's collection, merged config, aliases and `show` permissions. A mod without a default mosaic is checked with no tiles, and a default mosaic that names another mod is an error. Any visible mod with an `open` permission for the mod's site can send `mods.check` the same way.

A mosaic is checked the same way with `mosaics.check { mosaic }`, which needs an `open` permission for the mosaic file's site. It checks the mosaic's mod as the mosaic opens it, with the bundle and mount checks below, and does not run the mod's tests, which belong to the mod. A mosaic from another site gets only the `show` permissions the user allowed and remembered for it, and nothing is asked. See [Checking a mosaic](modules/lib/core/engine/README.md#checking-a-mosaic).

The check has three steps:

- **Bundle check**: the mosaic file, when the check uses one, the mod file, the entrypoint, every file of the declared libraries, the tile type and the collection must load, and the collection's tiles are validated against the tile type, after the mosaic's aliases. A file that cannot be loaded or has the wrong format is an error naming that file; for a library file, the message names the library and ends with the host's reason, such as jsDelivr's `Couldn't find the requested file /dist/missing.js in leaflet.`, so a wrong version or path shows before anyone runs the mod. A tile that does not match the type is a warning naming the tile. A missing `api` range, or one that does not match the app's mod API version, is a warning: the check asks nothing. With a mosaic, an alias for a field the tile type does not declare, and a config key, at any depth, that the mod's config does not have, are warnings naming the field or the key path, such as `config.map.zom`, so a typo in a mosaic shows before anyone opens it.
- **Mount check**: when the bundle check found no error, the mod is mounted in a hidden frame, with the config and permissions it would get if it were opened, the mosaic's included, the tiles of its type and an empty storage slot that is thrown away afterwards; the mod's real slot is never read nor written. The check records a `mount` that throws or rejects, a mod that left its page, blocked requests and blocked browser dialogs, every request answered with `-32600`, `-32601` or `-32602` (a message that is not a request, an unknown method, bad params), and the requests that would need the user (`links.open`, `files.save`, `ui.confirm` and `players.open` answer `false`, `mods.open`, `mosaics.open`, `mods.check` and `mosaics.check` are refused), without showing any dialog. `ui.notify` answers `null`, and each notification with level `"error"` or `"warning"` is a finding at that level, with the notification's source and message; an `"info"` one is none. A `mount` that has not finished after 10 seconds is an error. Only the start of the mod is watched: the mount check ends 1 second after `mount` finished, so timers and requests that start later are not recorded.
- **Tests**: for `mods.check`, when the mod declares `test_path` and neither step found an error, the mod's own tests run, one case after another (see [Mod tests](#mod-tests)).

The report's status is `pass` when there are no findings, `warn` when there are only warnings and `fail` when a finding is an error. The report names the checked mod file as `source`, and the mosaic file the check used as `mosaic`, or `null` when it used none. Each finding names its step (`bundle`, `mount` or `test`), its level, the file or mod it is about and a message. `tests` lists each case with its status (`pass` or `fail`) and, for a failed case, the message, and `testsChecked` says whether the cases ran. The check leaves the app as it was: no new sandbox, history entry or stage bar item.

## Mod tests

The bundle and mount checks tell whether a mod's files fit together and whether it starts and uses the mod API correctly, not whether it does what you meant: that it lists the books, that a click stores the selection, that it asks before deleting. Tests say that. They ship in the mod's folder and the app runs them as part of every check, so they hold wherever the mod is served and whatever OpenTesela runs it, with no tools on either side.

### The test file

Declare the test file in mod_conf.yaml with `test_path`, resolved against mod_conf.yaml like the entrypoint:

```yaml
mod:
  title: "book_list"
  version: "1.1.0"
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
| `tiles` | The tiles the check gives: the collection's, or the default mosaic's collection's, of the mod's tile type, after the mosaic's aliases. |
| `storage` | `get(key)` and `set(key, value)` on the case's slot, with the rules of `storage.get` and `storage.set`. Usable before `mount`, to seed what the mod reads. |
| `requests` | Each request the mod sent, in order, as `{ method, params, result }` once it resolved, or `{ method, params, error }` with the error's `code` and `message`. |
| `answer(method, value)` | Scripts the answer to the next request for `method` (see below). |
| `expect(actual)` | The expectations (see below). |
| `waitFor(fn, timeout?)` | Calls `fn` until it returns a truthy value without throwing, and resolves with that value (see below). |

### Scripted answers

A check shows no dialog. `answer(method, value)` queues the answer to the next request for `method`: `links.open`, `files.save`, `ui.confirm` or `players.open` with a boolean, `mods.open` or `mosaics.open` with `null` (`mosaics.open` since mod API `0.1.14`), or `catalog.list` with a catalog (since mod API `0.1.15`, see below). The request resolves with it, a `mods.open` or `mosaics.open` answered this way opens nothing, and a `players.open` answered this way requests nothing from the player's site. Requests without a queued answer get what the mount check gives: `false` for `links.open`, `files.save`, `ui.confirm` and `players.open`, and `-32002` for `mods.open`, `mosaics.open`, `mods.check` and `mosaics.check`. In a case, none of them is a finding. A wrong method or value throws at once, for example `the answer to ui.confirm must be a boolean`. The app still checks each request's params, so a `links.open` with a bad address fails as it would in the app, and leaves its answer queued.

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

A catalog answer is a mapping whose optional `mods`, `collections` and `mosaics` are lists of entries with a non-empty string `source`. A mosaic entry may also have `defaultOf`: `null`, or `{ source, title }` with non-empty strings. A missing list is empty and a missing `defaultOf` is `null`, so `catalog.list` resolves with the catalog in its complete form, as the app answers it. Any other value throws, naming the first wrong key, for example `the answer to catalog.list must be a catalog: "mods[0]" must be a mapping with a non-empty "source"`. Sources are kept as given, so a case can list its own fixtures by their address in the default mods folder, and the mod's `*.inspect` requests resolve them against the app's address. A `catalog.list` without a queued answer, in a case or in the mount check, gets the app's catalog, as in the app. Script it before `mount` when the mod lists the catalog as it mounts, so the case never depends on what the app ships:

```js
async function listsTheFixtureMod(context) {
  context.answer("catalog.list", {
    mods: [{ source: "./default_mods/mod_explorer/fixtures/listed_mod" }],
  });
  await context.mount();
  // catalog.list resolved with that mod, no collection and no mosaic.
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
