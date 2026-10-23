import {
  BookOpen,
  House,
  Info,
  LayoutGrid,
  Puzzle,
  Settings,
  Shapes,
} from "lucide-react";
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
    icon: { lucide: LayoutGrid },
    target: { page: true },
    group: "main",
    optional: true,
    comingSoon: true,
  },
  {
    id: "mods",
    label: "Mods",
    icon: { lucide: Puzzle },
    target: { mod: { mod: "mod_explorer", collection: null, params: {} } },
    group: "main",
    optional: true,
    comingSoon: false,
  },
  {
    id: "mosaics",
    label: "Mosaics",
    icon: { lucide: Shapes },
    target: { page: true },
    group: "main",
    optional: true,
    comingSoon: true,
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
