import type { InstanceCatalog } from "../../lib/core/engine/index.ts";

/**
 * An instance catalog of the test-owned mod and mosaic that e2e tests serve under
 * `/test-mods/` (e2e/test_mods.ts): the tiles mod and the labels mosaic. The
 * e2e build of mode `e2e-test-catalog` imports this file in place of
 * `src/main/instance_catalog.ts` (see vite.config.ts), so it exports the same
 * name, and the explorers list these entries without the shipped samples.
 * A test that does not serve them sees them as entries that cannot be
 * inspected.
 */
export const INSTANCE_CATALOG: InstanceCatalog = {
  mods: ["./test-mods/tiles/"],
  collections: [],
  mosaics: ["./test-mods/mosaics/labels.yaml"],
};
