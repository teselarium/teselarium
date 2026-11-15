import type { DefaultModSettings } from "../../lib/core/engine/index.ts";

/**
 * The vanilla default mods with the mod explorer and the collection viewer
 * switched off. The e2e build
 * of mode `e2e-explorer-off` imports this file in place of
 * `src/main/default_mods.ts` (see vite.config.ts), so it exports the same name.
 */
export const DEFAULT_MODS: DefaultModSettings = {
  folder: "./default_mods/",
  switchedOff: ["mod_explorer", "collection_viewer"],
};
