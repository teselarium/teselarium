# Mosaic Module

## Introduction

A mosaic is a shareable file that opens a mod with a tile collection, the way the mosaic's author wants it shown. It names the mod and the collection, overrides the mod's config, maps the collection's field names to the names the mod's tile type uses, and declares the media hosts the collection's tiles need. This library reads what a mosaic is, as plain data: its file and the references that name it. It decides nothing about trust. The [engine](../core/engine/README.md#launch) opens a mosaic, and what a mosaic is granted lives in [permissions](../core/permissions/README.md).

### Mosaic file format

A mosaic is a YAML file, by convention `mosaic.yaml` in a folder of its own. The laureates' map, which shows the Nobel laureates in literature on the country map:

```yaml
mosaic:
  title: "Laureates on the map"
  description: "Where each laureate was born."
  mod: "../mods/country_map"
  collection: "../tiles/literature_nobel_laureates"
  config:
    map:
      zoom: 3
  aliases:
    title: ["name"]
    country: ["birth_country"]
  permissions:
    show:
      - host: "https://upload.wikimedia.org"
        reason: "Shows the laureates' portraits"
```

Every key lives under a `mosaic` mapping:

| Key | Required | Meaning |
|---|---|---|
| `title` | yes | Non-empty string, the mosaic's name for the user. |
| `description` | no | String, defaults to `""`. |
| `mod` | yes | A [mod reference](../mod/README.md#mod-references): a default mod name, a mod folder or a mod file. |
| `collection` | no | A [collection reference](../tile/README.md#collection-loader): a collection folder or a collection file. Absent or `null` means the mod gets no tiles. Any other value must be a non-empty string. |
| `config` | no | Mapping merged into the mod's config, see [Config merge](#config-merge). Defaults to `{}`. |
| `aliases` | no | The names a collection uses for the fields of the mod's tile type, see [Aliases](#aliases). Defaults to `{}`. |
| `permissions` | no | The `show` hosts the collection's media need, see [Permissions](#permissions). Defaults to none. |

- `mod` and `collection` are resolved against the mosaic file's location, not against the app's address. A default mod name stays a default mod name.
- Other keys are ignored.
- The file follows the same plain YAML rules as a collection file. A file that is not plain YAML, or has no mapping at its top level, raises `YamlParseError`, and one that cannot be fetched raises `FileFetchError`, both with the mosaic file as source.

### Mosaic references

A mosaic is named by a reference, which follows the rule of mod and collection references. Every reference to one mosaic file gives the same source, which is the mosaic's identity.

| Reference | Read as | Mosaic file (app at `https://example.org/`) |
|---|---|---|
| `./mosaics/nobel_map` | a folder (a `/` is added) | `https://example.org/mosaics/nobel_map/mosaic.yaml` |
| `./mosaics/nobel_map/` | a folder | `https://example.org/mosaics/nobel_map/mosaic.yaml` |
| `./mosaics/nobel_map.yaml` | the mosaic file (path ends in `.yaml` or `.yml`) | `https://example.org/mosaics/nobel_map.yaml` |
| `https://mosaics.example.net/maps/laureates.yml` | the mosaic file | `https://mosaics.example.net/maps/laureates.yml` |

- A folder's query and fragment are dropped.
- Mosaics have no default names.

The `mod` and `collection` a mosaic file holds are references too, resolved against the mosaic file. A mosaic next to its mod file names it with `mod: "./"`: the mosaic file's own folder, which means the `mod_conf.yaml` in it (see [Mod references](../mod/README.md#mod-references)). This is how a mod's default mosaic, the `mosaic.yaml` its mod file names with `default_mosaic`, opens the mod it belongs to:

| Mosaic file | `mod` | Mod file |
|---|---|---|
| `https://example.org/samples/mods/book_list/mosaic.yaml` | `"./"` | `https://example.org/samples/mods/book_list/mod_conf.yaml` |
| `https://example.org/samples/mosaics/nobel_map/mosaic.yaml` | `"../../mods/country_map"` | `https://example.org/samples/mods/country_map/mod_conf.yaml` |
| `https://example.org/samples/mosaics/viewer/mosaic.yaml` | `"mod_viewer"` | the `mod_viewer` folder of the default mods folder |

### Config merge

When a mosaic opens, the mod's `context.config` is the mod's config merged with the mosaic's:

- where both have a mapping under the same key, the mappings are merged the same way, key by key;
- any other mosaic value, a list, a string, a number, a boolean or `null`, replaces the mod's value. Lists are replaced, not joined: a mosaic that extends a list writes the whole list;
- keys only the mod has keep their values and their order, and keys only the mosaic has are added after them.

With the mod's config `{ map: { zoom: 2, center: [0, 0] }, markers: { color: "#3366cc" } }` and the mosaic's `{ map: { zoom: 3 } }`, the mod gets `{ map: { zoom: 3, center: [0, 0] }, markers: { color: "#3366cc" } }`. Neither file changes: `mods.inspect` still gives the mod's own config.

### Aliases

`aliases` maps a field name of the mod's tile type to a non-empty list of non-empty strings, the names a collection may use for that field, in order of preference. When a mosaic opens, the engine renames each tile's top-level metadata keys before it validates the tiles against the tile type:

- for each field of `aliases` that the metadata lacks, the first listed name the metadata has is renamed to the field. The value is kept, and so is the key's place in the key order;
- a field the metadata already has is kept, and its listed names are left as written;
- a name is renamed, not copied, so a laureate tile with `name` and `birth_country` reaches the country map with `title` and `country`, and without `name` or `birth_country`;
- only top-level keys are renamed. A tile's `source` and `body` never change.

A name listed under two fields (`{ title: ["name"], label: ["name"] }`), or a name that is also a field (`{ title: ["name"], name: ["full_name"] }`), raises `MosaicFormatError` naming it, so the result never depends on the order of the fields.

### Permissions

`permissions` is a mapping whose only key is `show`: the hosts the collection's images, media, fonts and stylesheets come from. Each line is a mapping with a non-empty string `host` and a non-empty string `reason`, and the host follows the mod file's [rules for `show` hosts](../mod/README.md#permission-categories), wildcard hosts included. Any other category, such as `connect` or `open`, raises `MosaicFormatError` saying that a mosaic can only declare `show` permissions: a mosaic chooses data, not what the mod's code may reach.

The loaded lines keep the file order, as `{ category: "show", host, reason }`. They apply to the sandbox opened from the mosaic, and to a sandbox whose run link names the mosaic as `sites`, which gets these lines and nothing else of the mosaic (see the [stage module](../core/stage/README.md#run-links)). How they are granted, and when the user is asked, is described in the [sandbox module](../core/sandbox/README.md#permissions-of-a-mosaic).

### Editing a mosaic file

A user's mosaic is edited as text: the mosaic viewer's form and its YAML tab both change the same draft, the full text of the mosaic file (see [the viewer](../../mosaics/viewer/README.md)). The form's changes are applied to that text by this module, so the app is the only place that writes mosaic YAML.

An edit sets some of these keys of the `mosaic` mapping, and nothing else:

| Edit | Value | Effect |
|---|---|---|
| `title` | string | Sets `title`. |
| `description` | string or `null` | Sets `description`, or removes it. |
| `mod` | string | Sets `mod`. |
| `collection` | string or `null` | Sets `collection`, or removes it (the mod gets no tiles). |
| `aliases` | mapping of field names to lists of names | Sets the fields of `aliases`. A field it lacks is removed, and an empty mapping removes `aliases`. |
| `show` | list of `{ host, reason }` | Sets the lines of `permissions.show`. An empty list removes them, and `permissions` with them. |

What an edit keeps:

- every other key, such as `config`, and the order of the keys. A key that was missing is added in the mosaic's order (`title`, `description`, `mod`, `collection`, `config`, `aliases`, `permissions`);
- the comments, and the quoting of the values it does not touch. A changed value keeps its quoting. A new string is written in double quotes, as the mosaic files of the app are, and a list of names as a flow list (`["name"]`);
- alias fields and `show` lines whose value did not change, with their comments.

The text is written back with the `yaml` package's document API. That package keeps comments, and `js-yaml`, which the loader uses, does not. Its output only normalizes what carries no meaning: spaces inside a flow list (`[ "name" ]` becomes `["name"]`) and long strings, which it never folds.

Loading still uses `js-yaml` under the rules of `parseYaml`, so what a mosaic file may hold does not change (no dates, no tags, no repeated keys). The two packages only meet here: `yaml` writes the edit, then the result goes back through `parseYaml` and `buildLoadedMosaic`. An edit is refused when it would make the loader refuse the text for a reason the edit introduced, such as a `show` host that is not an origin. A draft the loader already refuses, for example one without a `mod` yet, can still be edited.

With the laureates' map, whose `config` has a comment above it:

```ts
import { applyMosaicEdits } from "./lib/mosaic/index.ts";

const draft = [
  "mosaic:",
  '  title: "Laureates on the map"',
  '  mod: "../mods/country_map"',
  '  collection: "../tiles/literature_nobel_laureates"',
  "  # Closer than the mod's default zoom.",
  "  config:",
  "    map:",
  "      zoom: 3",
  "",
].join("\n");

const edited = applyMosaicEdits(draft, { aliases: { country: ["birth_country"] } });
// edited is the draft with two lines added at its end, the comment kept:
//   aliases:
//     country: ["birth_country"]
```

Copies and new mosaics start from this module too:

- a copy's relative `mod` and `collection` are rewritten as the absolute addresses they resolve to from the original, so the copy opens from the browser. A default mod name and an absolute address are kept. `../mods/book_list` in `https://example.org/samples/mosaics/nobel_books_list.yaml` becomes `https://example.org/samples/mods/book_list`;
- a new mosaic starts as `mosaic:\n  title: "Untitled mosaic"\n`, with the edits of its mod, its collection and its `show` lines.

## Module Details

Implemented in `src/lib/mosaic/`. Other modules import only from the public entry point `src/lib/mosaic/index.ts`. It reuses the [files module](../files/README.md) for fetching and YAML, `resolveModReference`, `isDefaultModName` and `isShowHost` of the [mod module](../mod/README.md), and `resolveCollectionReference` and the `TileCollection` type of the [tile module](../tile/README.md).

### Mosaic loader

- `resolveMosaicReference(reference, baseUrl)`: resolves a mosaic reference to the URL of its mosaic file, against `baseUrl` or the page's document base URL when it is `undefined`. Raises `FileFetchError` when it cannot.
- `loadMosaicFile(reference, options?)`: resolves the reference, fetches and parses the mosaic file, and resolves its `mod` and `collection` against it. Returns a `LoadedMosaic` (`source`, `title`, `description`, `mod`, `collection`, `config`, `aliases`, `permissions`), where `mod` is the resolved address of the mod file and `collection` the resolved address of the collection file, or `null`. It requests the mosaic file only: neither its mod nor its collection.
- `loadMosaicWithText(reference, options?)`: the same load, answering `{ mosaic, content }`, where `content` is the mosaic file's text as read, comments included. `mosaics.inspect` answers it, so an editor can start a draft from it.
- `MosaicLoadOptions`: the `FileFetchOptions` of the files module plus `defaultModsFolder`, needed for a `mod` that is a default mod name. Without it, such a `mod` raises `MosaicFormatError` saying that `"mod"` cannot be resolved.
- Errors: `MosaicFormatError` (the file does not follow the mosaic file format). It exposes the failing `source`, and its message is `Invalid mosaic "<source>": <reason>`, where the reason names the wrong key, e.g. `"title" must be a non-empty string`, `"config" must be a mapping` or `"aliases.title" must be a non-empty list of non-empty strings`. A mosaic file that cannot be fetched raises `FileFetchError`, and one that is not plain YAML raises `YamlParseError`.
- Types: `LoadedMosaic`, `MosaicLoadOptions`, `MosaicWithText`, `MosaicAliases` (field name to list of names).

Loaded mosaics are plain data, and two loads of the same mosaic never share objects.

### Mosaic document

Implemented in `mosaic_document.ts`, with the `yaml` package.

- `applyMosaicEdits(content, edits)`: the [edit](#editing-a-mosaic-file) of a draft's text. Returns the new text. Raises `MosaicEditError`.
- `readMosaicEdits(value)`: reads edits as a request gives them, a mapping whose keys are those of `MosaicEdits`. Raises `MosaicEditError` naming the key, e.g. `"edits.colour" is not a draft edit` or `"edits.aliases.country" must be a list of strings`.
- `makeCopyDraft(content, original)`: the draft of a copy of the mosaic file at `original`, with absolute references.
- `buildNewDraft(mod, collection, show)`: the draft of a new mosaic, with `collection` `null` for none.
- `readDraftFields(content)`: the fields a draft holds as written, `MosaicDraftFields` (`{ title, description, mod, collection, config, aliases, show }`), read with the loader's YAML rules but without its format checks: a text that is missing or not a string is `null`, `aliases` keeps the fields with a list of names, and `show` the lines with a string host and reason. `null` when the text cannot be read. `mosaics.validate` answers it, so an editor's form never reads YAML.
- `listRelativeReferences(mosaic)`: the keys, `mod` and `collection`, of a parsed `mosaic` mapping whose reference is relative: neither an absolute address nor a default mod name. A copy rewrites them, and a new draft may not have them.
- `buildLoadedMosaic(parsedYaml, options)`: what `loadMosaicFile` does after fetching, for a text already in memory. The engine validates drafts with it.
- `DRAFT_ADDRESS`: `teselarium-draft:///mosaic.yaml`, the address a draft without one is read at.
- Errors: `MosaicEditError`, whose `reason` says which edit is wrong, or that the draft cannot be read (`the draft cannot be read: <parse error>`), or that the edits make the mosaic invalid (`the edits make the mosaic invalid: <loader error>`). Its message is `Cannot edit mosaic draft: <reason>`.
- Types: `MosaicEdits`, `MosaicDraftFields`, `MosaicShowLine` (`{ host, reason }`).

### Config and aliases

- `mergeMosaicConfig(modConfig, mosaicConfig)`: the [config merge](#config-merge). Returns a new mapping that shares no objects with its inputs, and changes neither.
- `applyMosaicAliases(metadata, aliases)`: the [alias renaming](#aliases) of one tile's metadata. Returns new metadata and changes neither input.
- `aliasCollectionTiles(collection, aliases)`: the collection with each tile's metadata renamed by `applyMosaicAliases`. The tiles' `source`, `body` and `types`, and the collection's other fields, are kept. Returns a new collection and changes neither input.

All three are pure. The engine calls them when it builds a mosaic's launch, and the [combinations module](../core/combinations/README.md) calls `aliasCollectionTiles` to score a mosaic as its launch would.

Example:

```ts
import {
  applyMosaicAliases,
  loadMosaicFile,
  mergeMosaicConfig,
} from "./lib/mosaic/index.ts";

const mosaic = await loadMosaicFile("./samples/mosaics/nobel_map.yaml", {
  baseUrl: "https://example.org/",
  defaultModsFolder: "https://example.org/default_mods/",
});
// mosaic.source === "https://example.org/samples/mosaics/nobel_map.yaml"
// mosaic.mod === "https://example.org/samples/mods/country_map/mod_conf.yaml"
// mosaic.collection === "https://example.org/samples/tiles/literature_nobel_laureates/collection.yaml"
// only the mosaic file was requested

const config = mergeMosaicConfig({ map: { zoom: 2, center: [0, 0] } }, mosaic.config);
// config is { map: { zoom: 3, center: [0, 0] } }

const metadata = applyMosaicAliases(
  { name: "Bob Dylan", birth_country: "United States" },
  mosaic.aliases,
);
// metadata is { title: "Bob Dylan", country: "United States" }
```
