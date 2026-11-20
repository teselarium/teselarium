# Spec Delta

## MODIFIED Requirements

### Requirement: Mounting from a case
`mount(options)` SHALL call the mod's default export with the engine API object and a mount context built as for a check, and SHALL resolve once that call has finished. `options.tiles` SHALL replace the case's tiles, `options.config` SHALL replace the mod's config keys it names, `options.params` SHALL be the context's `params`, and `options.collection`, a `{ source, title, description }` mapping or `null`, SHALL replace the context's `collection`. Without `options.collection`, the context SHALL keep the check's `collection`. An `options.collection` that is neither SHALL make `mount` reject. When the mod's `mount` throws or rejects, `mount` SHALL reject with that error. A second call SHALL reject.

#### Scenario: Config override
- **WHEN** a case calls `mount` with a `config` that names one key of the mod's config
- **THEN** the mod's mount context has that key's value from `config`, and the mod's other config keys unchanged

#### Scenario: Other tiles
- **WHEN** a case calls `mount({ tiles: [] })`
- **THEN** the mod's mount context has no tiles

#### Scenario: Check's collection
- **WHEN** a mod is checked with its default mosaic and a case calls `mount()`
- **THEN** the mod's mount context's `collection` holds the `source`, `title` and `description` of the mosaic's collection

#### Scenario: No collection
- **WHEN** a case calls `mount({ collection: null })`
- **THEN** the mod's mount context's `collection` is `null`, and its tiles are the check's tiles

#### Scenario: Invalid collection
- **WHEN** a case calls `mount({ collection: "books.yaml" })`
- **THEN** `mount` rejects with an error that says `collection` must be a mapping with `source`, `title` and `description`, or `null`

#### Scenario: Mount twice
- **WHEN** a case calls `mount()` twice
- **THEN** the second call rejects with an error that says the mod is already mounted
