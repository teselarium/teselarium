import type { SectionDefinition } from "../../main/sections/section_registry.ts";
import { VANILLA_SECTIONS as VANILLA_REGISTRY } from "../../main/sections/vanilla_sections.ts";

/**
 * The vanilla sections as an instantiation changes them: the mod explorer as
 * Home, so a mod shows at `#/`, and an SVG image as the Guides icon, tinted
 * with the text color. The e2e build of mode `e2e-home-mod` imports this file
 * in place of `src/main/sections/vanilla_sections.ts` (see vite.config.ts),
 * so it exports the same name.
 */
function changeSection(section: SectionDefinition): SectionDefinition {
  if (section.id === "home") {
    const homeMod: SectionDefinition = {
      ...section,
      target: { mod: { mod: "mod_explorer", collection: null, params: {} } },
    };
    return homeMod;
  }
  if (section.id === "guides") {
    const imageIcon: SectionDefinition = {
      ...section,
      icon: { image: "./favicon.svg" },
    };
    return imageIcon;
  }
  return section;
}

function buildHomeModRegistry(): SectionDefinition[] {
  const sections: SectionDefinition[] = [];
  for (const section of VANILLA_REGISTRY) {
    sections.push(changeSection(section));
  }
  return sections;
}

export const VANILLA_SECTIONS: readonly SectionDefinition[] =
  buildHomeModRegistry();
