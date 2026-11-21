# Spec Delta

## REMOVED Requirements

### Requirement: The app has a catalog
**Reason**: The capability is renamed `catalog`, and "app catalog" named both the instantiation's lists and the merged catalog.
**Migration**: Replaced by "The instance catalog" and "The catalog and its parts" in `catalog`, with the same behavior.

### Requirement: The catalog is checked at start
**Reason**: The capability is renamed `catalog`, and the lists that are checked are the instance catalog's.
**Migration**: Replaced by "The instance catalog is checked at start" in `catalog`. The start errors name the instance catalog.

### Requirement: Switched-off default mods are left out
**Reason**: The capability is renamed `catalog`.
**Migration**: Moved to `catalog` under the same name, with the same behavior.

### Requirement: Vanilla catalog
**Reason**: The capability is renamed `catalog`, and the vanilla lists are the instance catalog's.
**Migration**: Replaced by "Vanilla instance catalog" in `catalog`, with the same behavior.

### Requirement: Default mosaics join the mosaics
**Reason**: The capability is renamed `catalog`.
**Migration**: Replaced by "Default mosaics join the catalog's mosaics" in `catalog`, with the same behavior.

### Requirement: A default mosaic is listed once
**Reason**: The capability is renamed `catalog`.
**Migration**: Moved to `catalog` under the same name, with the same behavior.
