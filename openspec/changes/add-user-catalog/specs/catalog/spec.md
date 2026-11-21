# Spec Delta

## MODIFIED Requirements

### Requirement: The catalog and its parts
The app SHALL have one catalog: three ordered lists, `mods`, `collections` and `mosaics`, of resolved addresses. Its mods and collections SHALL be those of the instance catalog, in its order. Its mosaics SHALL be those of the instance catalog, in its order, followed by the default mosaics while "List the default mosaics of mods" is on (see "Default mosaics join the catalog's mosaics"), followed by the user catalog's mosaics (see "The user catalog joins the catalog's mosaics").

#### Scenario: Vanilla catalog with the switch off
- **WHEN** the vanilla app starts with "List the default mosaics of mods" off and an empty user catalog
- **THEN** the catalog's mods, collections and mosaics are exactly those of the vanilla instance catalog, in its order

#### Scenario: Vanilla catalog with the switch on
- **WHEN** "List the default mosaics of mods" is on in the vanilla app, with an empty user catalog
- **THEN** the catalog's mods and collections are those of the instance catalog, and its mosaics are the instance catalog's two sample mosaics followed by the default mosaics

#### Scenario: With user mosaics
- **WHEN** the switch is on and the user catalog holds a stored mosaic and a remote one
- **THEN** the catalog's mosaics are the two sample mosaics, then the default mosaics, then the stored mosaic and the remote one, in the order they were added

## ADDED Requirements

### Requirement: The user catalog joins the catalog's mosaics
The catalog's mosaics SHALL end with the user catalog's mosaics, in the order they were added (see `user-catalog`). A user mosaic whose address an earlier mosaic of the catalog already has SHALL appear once, at its earlier place, and SHALL stay in the user catalog.

#### Scenario: Default mosaic also added by the user
- **WHEN** the user added the book list's default mosaic by URL while the switch was off, and then switches it on
- **THEN** the catalog's mosaics hold that mosaic once, at the default mosaics' place, marked as a default mosaic
- **AND** once the switch is off again, the catalog lists it at the user catalog's place, marked as listed by the user

### Requirement: Who listed an entry and where it lives
Each entry of the catalog SHALL tell who listed it: `"instance"` for an entry of the instance catalog, `"default"` for a default mosaic, or `"user"` for a user catalog entry. It SHALL also tell where its file lives: `"browser"` for an `opentesela-browser:` address, or `"remote"` for any other address.

#### Scenario: Marks of the vanilla catalog with a user mosaic
- **WHEN** the switch is on and the user imported a mosaic
- **THEN** the sample mosaics are listed by the instance and remote, the default mosaics by default and remote, and the imported mosaic by the user and in the browser
