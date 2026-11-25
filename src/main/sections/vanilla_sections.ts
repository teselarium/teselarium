import { BookOpen, House, Info, Settings } from "lucide-react";
import { COLLECTION_ICON, MOD_ICON, MOSAIC_ICON } from "../catalog_icons.ts";
import type { SectionDefinition } from "./section_registry.ts";

/**
 * The vanilla app's sections, in sidebar order. This is the file an
 * instantiation edits to add, remove or change a section (see
 * docs/modules/main/README.md). The future init options will build the same
 * value.
 */
export const VANILLA_SECTIONS: readonly SectionDefinition[] = [
  {
    id: "home",
    label: "Home",
    icon: { lucide: House },
    target: { page: true },
    group: "main",
    optional: false,
    comingSoon: false,
  },
  {
    id: "tiles",
    label: "Tiles",
    icon: { lucide: COLLECTION_ICON },
    target: {
      mod: { mod: "collection_explorer", collection: null, params: {} },
    },
    group: "main",
    optional: true,
    comingSoon: false,
  },
  {
    id: "mods",
    label: "Mods",
    icon: { lucide: MOD_ICON },
    target: { mod: { mod: "mod_explorer", collection: null, params: {} } },
    group: "main",
    optional: true,
    comingSoon: false,
  },
  {
    id: "mosaics",
    label: "Mosaics",
    icon: { lucide: MOSAIC_ICON },
    target: { mod: { mod: "mosaic_explorer", collection: null, params: {} } },
    group: "main",
    optional: true,
    comingSoon: false,
  },
  {
    id: "guides",
    label: "Guides",
    icon: { lucide: BookOpen },
    target: { page: true },
    group: "main",
    optional: true,
    comingSoon: false,
  },
  {
    id: "settings",
    label: "Settings",
    icon: { lucide: Settings },
    target: { page: true },
    group: "footer",
    optional: false,
    comingSoon: false,
  },
  {
    id: "about",
    label: "About",
    icon: { lucide: Info },
    target: { page: true },
    group: "footer",
    optional: false,
    comingSoon: false,
  },
];
