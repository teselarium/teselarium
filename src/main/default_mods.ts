import type { DefaultModSettings } from "../lib/core/engine/index.ts";

/**
 * The vanilla app's default mods: the folder next to the app, and none
 * switched off. What `#/` shows is the Home section's target
 * (`sections/vanilla_sections.ts`). The future init options will build this
 * value; the lib only receives it.
 */
export const DEFAULT_MODS: DefaultModSettings = {
  folder: "./default_mods/",
  switchedOff: [],
};
