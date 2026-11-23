import type { InstanceCatalog } from "../lib/core/engine/index.ts";

/**
 * The vanilla instance catalog: the mods, collections and mosaics the Mods,
 * Tiles and Mosaics explorers list, as part of the catalog. References are relative to the app's
 * address, and a mod may be a default mod name. `main.tsx` checks it with
 * `resolveInstanceCatalog` before the app starts. The future init options will
 * build this value; the lib only receives it.
 */
export const INSTANCE_CATALOG: InstanceCatalog = {
  mods: [
    "./samples/mods/book_list",
    "./samples/mods/flashcards",
    "./samples/mods/country_map",
  ],
  collections: [
    "./samples/tiles/literature_nobel_laureates/collection.yaml",
    "./samples/tiles/literature_nobel_laureates_books/collection.yaml",
  ],
  mosaics: [
    "./samples/mosaics/nobel_books_list.yaml",
    "./samples/mosaics/nobel_laureates_map.yaml",
    "./samples/mosaics/flashcards_literature_laureates.yaml",
  ],
};
