# Spec Delta

## ADDED Requirements

### Requirement: Relative paths in tiles are resolved
In the tiles the engine gives a mod, each metadata string that starts with `./` or `../` SHALL be replaced by the absolute URL it names, resolved against the tile's `source`. Strings inside lists and nested mappings SHALL be resolved too. Every other value SHALL be left as written: other strings, numbers, booleans, null and mapping keys. This applies to the mount context's `tiles`, including when a mod is mounted for a check.

#### Scenario: Image next to the tile
- **WHEN** a mod is opened with a collection whose tile `https://example.org/books/kallocain.md` has `image: "./cover.jpg"`
- **THEN** that tile's `metadata.image` in the context's `tiles` is `"https://example.org/books/cover.jpg"`

#### Scenario: Path to a parent folder
- **WHEN** the tile `https://example.org/books/kallocain.md` has `image: "../covers/kallocain.jpg"`
- **THEN** that tile's `metadata.image` in the context's `tiles` is `"https://example.org/covers/kallocain.jpg"`

#### Scenario: Strings in lists and nested mappings
- **WHEN** the tile `https://example.org/books/kallocain.md` has `gallery: ["./front.jpg", "./back.jpg"]` and `editions: [{ year: 1940, cover: "./first.jpg" }]`
- **THEN** its `gallery` is `["https://example.org/books/front.jpg", "https://example.org/books/back.jpg"]`
- **AND** its `editions` is `[{ year: 1940, cover: "https://example.org/books/first.jpg" }]`

#### Scenario: Strings without the marker are left as written
- **WHEN** the tile `https://example.org/books/kallocain.md` has `link: "/r/books"`, `file: "cover.jpg"`, `image: "https://upload.wikimedia.org/wikipedia/en/a/ab/KallocainCover.jpg"` and `title: "Kallocain"`
- **THEN** each of those values in the context's `tiles` is the same string as written

#### Scenario: Values that are not strings and keys are left as written
- **WHEN** the tile has `pages: 156`, `read: true`, `series: null` and a mapping `covers: { "./front.jpg": "./front.jpg" }`
- **THEN** `pages`, `read` and `series` are unchanged
- **AND** `covers` is `{ "./front.jpg": "https://example.org/books/front.jpg" }`

#### Scenario: Tile picked from the user's computer
- **WHEN** a tile picked from the user's computer at `file:///library/books/kallocain.md` has `image: "./cover.jpg"`
- **THEN** that tile's `metadata.image` in the context's `tiles` is `"file:///library/books/cover.jpg"`

#### Scenario: Mount check gets the resolved tiles
- **WHEN** a mod is checked with a collection whose tile `https://example.org/books/kallocain.md` has `image: "./cover.jpg"`
- **THEN** the mount context of the mount check and of each test case has that tile with `metadata.image` `"https://example.org/books/cover.jpg"`

#### Scenario: Tiles a test passes to mount are used as given
- **WHEN** a case in a mod's test file calls `mount({ tiles })` with a tile whose `metadata.image` is `"./cover.jpg"`
- **THEN** the mod is mounted with that tile's `metadata.image` still `"./cover.jpg"`

### Requirement: Only the tiles given to mods are resolved
Resolving relative paths SHALL change only the tiles the engine gives a mod. A loaded tile SHALL keep its metadata as written, the collection SHALL be validated against the metadata as written, and a tile's `body` SHALL stay exactly as written.

#### Scenario: Loaded tile keeps the path as written
- **WHEN** the tile `https://example.org/books/kallocain.md` with `image: "./cover.jpg"` is loaded
- **THEN** the loaded tile's `metadata.image` is `"./cover.jpg"`

#### Scenario: Body is not resolved
- **WHEN** a mod is opened with a collection whose tile has the body `![Cover](./cover.jpg)`
- **THEN** that tile's `body` in the context's `tiles` is `![Cover](./cover.jpg)`

## MODIFIED Requirements

### Requirement: Tiles changed event
When the tiles of a running mod that was opened with a collection are reloaded, the engine SHALL push `tiles.changed` with `{ tiles, issues }`, following the same rules as the mount context.

#### Scenario: Reloaded tiles are pushed
- **WHEN** the sample collection is reloaded for a running sample book list mod and now lists two books
- **THEN** the mod's `tiles.changed` handlers receive two tiles

#### Scenario: Reloaded tiles have their relative paths resolved
- **WHEN** the collection of a running mod is reloaded and its tile `https://example.org/books/kallocain.md` has `image: "./cover.jpg"`
- **THEN** the mod's `tiles.changed` handlers receive that tile with `metadata.image` `"https://example.org/books/cover.jpg"`
