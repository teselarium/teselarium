import { Shapes } from "lucide-react";
import type { SectionDefinition } from "../../main/sections/section_registry.ts";
import { VANILLA_SECTIONS } from "../../main/sections/vanilla_sections.ts";

/**
 * A made-up section that exists only in the tests: an example of an
 * instantiation's optional section marked as coming soon. The vanilla
 * registry has no coming-soon section, so the tests of coming-soon sections
 * pass this registry in (see docs/modules/main/README.md).
 */
export const COMING_SOON_SECTION: SectionDefinition = {
  id: "example_section",
  label: "Example Section",
  icon: { lucide: Shapes },
  target: { page: true },
  group: "main",
  optional: true,
  comingSoon: true,
};

function buildComingSoonRegistry(): SectionDefinition[] {
  const sections: SectionDefinition[] = [];
  for (const section of VANILLA_SECTIONS) {
    sections.push(section);
    if (section.id === "mosaics") {
      sections.push(COMING_SOON_SECTION);
    }
  }
  return sections;
}

/** The vanilla sections with the example coming-soon section after Mosaics. */
export const COMING_SOON_SECTIONS: readonly SectionDefinition[] =
  buildComingSoonRegistry();
