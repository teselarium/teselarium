# Proposal

## Why

The simplest way for a tile author to add an image is to put it next to the tile and write `image: "./cover.jpg"`, as the tile example in `docs/opentesela_spec.md` does. The tile's origin is already a content host, so the policy allows it, but the image does not load: a mod sets `img.src = tile.metadata.image`, and inside the frame, whose document is built in memory, a relative URL has nothing to resolve against. Today every mod has to remember `new URL(value, tile.source)`, and the sample book list mod does not.

## What Changes

- **Relative paths in tiles are resolved**: in the tiles the engine gives a mod, each metadata string that starts with `./` or `../` is replaced by the absolute URL it names, resolved against the tile's `source`. Strings inside lists and nested mappings are resolved too. `./cover.jpg` in `https://example.org/books/kallocain.md` becomes `https://example.org/books/cover.jpg`.
- **The marker is explicit**: only `./` and `../` count, the same idea as mod references, where a relative path read as a location must contain a `/`. Strings starting with `/`, bare names (`cover.jpg`) and absolute URLs are left as they are, since text such as `/r/books` or a plain word could be read as a path by mistake. No tile type annotation is needed.
- **Where it applies**: the mount context's `tiles` and the `tiles` of `tiles.changed`, so mods mounted for a check get the same tiles as when opened. The tile loader keeps the metadata as written: the tile object stays what the file says, and only what the engine hands to mods is resolved.
- **The sample book list mod needs no change**: it sets `img.src` from the metadata, which now holds an absolute URL.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `mod-engine-api`: the requirements on the mount context's `tiles` and on `tiles.changed` say that metadata strings starting with `./` or `../` are resolved against the tile's `source`.
- `mod-api-version`: the mod API version becomes `0.1.4`.

## Impact

- **Code**: `src/lib/core/engine/mod_launch.ts` (the tiles of the mount context) and the reload path in `src/lib/core/stage/stage_sandboxes.ts` and `src/lib/core/engine/mod_session.ts` (the tiles of `tiles.changed`), through one shared function in the engine.
- **Tests**: unit tests of the resolving function (nested lists and mappings, `../`, strings left as they are); an e2e test that a tile with `image: "./cover.svg"` next to it shows its image in a mod that sets `img.src` from the metadata.
- **Docs**: the mount context's tiles in `docs/modules/lib/core/engine/README.md`; the tile example in `docs/opentesela_spec.md` and the "Assets next to the mod" section of `docs/modules/lib/core/sandbox/README.md`, which gets a sibling note on images next to tiles.
- **Mod API version**: patch bump. The change touches the mount context's `tiles` in `mod-engine-api`. It is a fix that existing mods keep working with: a mod that already resolves with `new URL(value, tile.source)` gets the same URL, since resolving an absolute URL gives it back. A mod that shows such a string as text now shows the absolute URL. No name changes, so the surface guard gets an entry equal to the previous one.
- **App version**: patch bump, following the mod API's patch bump.
- **Out of scope**:
  - tiles picked from the user's computer: their paths resolve to `file:` URLs, which are not content hosts, so images next to them still do not load;
  - the markdown body, which stays exactly as written;
  - the tiles a mod's test file passes to `mount(options)` in a check, which are the test's own data and are used as given;
  - tile types marking which fields are URLs.
