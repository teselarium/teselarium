# Modules

Each file in this folder contains the specifications for their respective module.

The global architecture of modules:
- The `lib` module contains common scripts and functions that doesn't render anything.
- The other modules can contain render related functions.
- Tiles, Mods and Mosaics organized in three components:
    - Explore: for exploring their respective catalogs of objects (tiles, mods o mosaics)
    - Viewer: for viewing a single instance of their object
    - Maker: for creating or editing instance of their object

The Explore, Viewer and Maker components ship as default mods, built from the [`default_mods/`](../../default_mods/README.md) folder at the repository's root and served at `./default_mods/`: ordinary sandboxed mods that use only the engine API, like any community mod, so an instantiation can switch them off or replace them. The default mods folder and the switched-off list are the default mod settings in `src/main/default_mods.ts`; what `#/` shows is the Home section of the [section registry](main/README.md#the-section-registry). This version ships the mod explorer ([mods/explorer](mods/explorer/README.md), opened by the Mods section), the mod viewer ([mods/viewer](mods/viewer/README.md)), the collection explorer and collection viewer ([tiles/explorer](tiles/explorer/README.md), the explorer opened by the Tiles section), the tile viewer ([tiles/viewer](tiles/viewer/README.md), opened from the collection viewer or by a run link with a `tile`), the mosaic explorer ([mosaics/explorer](mosaics/explorer/README.md), opened by the Mosaics section) and the mosaic viewer ([mosaics/viewer](mosaics/viewer/README.md), opened from the mosaic explorer). See the [stage](lib/core/stage/README.md) for how links open mods. A mosaic also opens from its run link `#/run?mosaic=…` or from a mod through `mosaics.open` (see [mosaics](mosaics/README.md)). No Maker component ships yet.

# TODO
