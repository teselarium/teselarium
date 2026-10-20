import type { DefaultModSettings } from "../lib/core/engine/index.ts";

/**
 * The vanilla app's default mods: the folder next to the app, the mod
 * explorer as home mod, and none switched off. The future init options will
 * build this value; the lib only receives it.
 */
export const DEFAULT_MODS: DefaultModSettings = {
  folder: "./default_mods/",
  home: "mod_explorer",
  switchedOff: [],
};
