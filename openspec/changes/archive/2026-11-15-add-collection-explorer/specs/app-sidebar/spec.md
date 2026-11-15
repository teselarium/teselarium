# Spec Delta

## ADDED Requirements

### Requirement: Coming-soon items are disabled
A coming-soon section SHALL be shown in the sidebar as a disabled item that says it is coming soon, and SHALL NOT navigate when activated.

#### Scenario: Mosaics is coming soon
- **WHEN** the user clicks the Mosaics item in the vanilla sidebar
- **THEN** the item has `aria-disabled="true"`, its tooltip or label says `Coming soon`, and the visible page or sandbox does not change

## MODIFIED Requirements

### Requirement: Vanilla sections
The vanilla registry SHALL hold, in the `main` group and in this order: Home (a page, always shown), Tiles (the mod link `collection_explorer`, optional), Mods (the mod link `mod_explorer`, optional), Mosaics (optional, coming soon) and Guides (a page, optional); and in the `footer` group: Settings (a page, always shown) and About (a page, always shown). The `footer` group SHALL be shown at the bottom of the sidebar.

#### Scenario: Vanilla sidebar
- **WHEN** the vanilla app is opened for the first time on a 1280×800 viewport
- **THEN** the sidebar's navigation lists Home, Tiles, Mods, Mosaics and Guides, then Settings and About below them

#### Scenario: Tiles opens the collection explorer
- **WHEN** the user clicks the Tiles item in the vanilla sidebar
- **THEN** the collection explorer is the visible mod, the address is `#/run?mod=collection_explorer` and the Tiles item is the current one

### Requirement: Sections of switched-off mods
A section whose target is a default mod that the instantiation switched off SHALL NOT be part of the app: it SHALL be shown neither in the sidebar nor on the Settings page.

#### Scenario: Explorer switched off
- **WHEN** `mod_explorer` is switched off in the default mod settings
- **THEN** the sidebar has no Mods item and the Settings page has no Mods switch

#### Scenario: Collection explorer switched off
- **WHEN** `collection_explorer` is switched off in the default mod settings
- **THEN** the sidebar has no Tiles item and the Settings page has no Tiles switch

## REMOVED Requirements

### Requirement: Coming-soon sections
**Reason**: Its only scenario says that Tiles is coming soon, which this change ends, and a modified requirement cannot drop a scenario. The rule itself is unchanged and moves to "Coming-soon items are disabled", with Mosaics as its example.
**Migration**: None for users or instantiations: coming-soon sections behave as before. Tests that click Tiles to check a coming-soon item click Mosaics instead.
