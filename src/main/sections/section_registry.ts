import type { LucideIcon } from "lucide-react";
import { findSwitchedOffMod } from "../../lib/core/engine/index.ts";
import type {
  ResolvedDefaultModSettings,
  RunLink,
} from "../../lib/core/engine/index.ts";
import type {
  SectionLink,
  StageHome,
  StageRouting,
} from "../../lib/core/stage/index.ts";
import { resolveModReference } from "../../lib/mod/index.ts";

/**
 * A section's icon: a lucide icon, or an image relative to the app. An image
 * is drawn in the item's text color unless `tint` is `false`.
 */
export type SectionIcon =
  { lucide: LucideIcon } | { image: string; tint?: boolean };

/** What a section shows: its pages, in `pages/<id>/`, or a mod link. */
export type SectionTarget = { page: true } | { mod: RunLink };

/** One section of the sidebar. */
export interface SectionDefinition {
  /** Matches `[a-z][a-z0-9_-]*`, unique, and not `run`. Also the page folder and address. */
  id: string;
  label: string;
  icon: SectionIcon;
  /** Not used while the section is coming soon. */
  target: SectionTarget;
  /** `footer` sections are shown at the bottom of the sidebar. */
  group: "main" | "footer";
  /** The user can hide an optional section on the Settings page. */
  optional: boolean;
  /** Shown as a disabled item that says it is coming soon. */
  comingSoon: boolean;
}

/** The section shown at `#/`. */
export const HOME_SECTION_ID = "home";

/** The section whose page is the Settings page. */
export const SETTINGS_SECTION_ID = "settings";

const SECTION_ID_PATTERN = /^[a-z][a-z0-9_-]*$/;

const RESERVED_SECTION_IDS: readonly string[] = ["run"];

const ALWAYS_SHOWN_SECTION_IDS: readonly string[] = [
  HOME_SECTION_ID,
  SETTINGS_SECTION_ID,
  "about",
];

function checkSectionId(id: string, seenIds: Set<string>): string | null {
  if (!SECTION_ID_PATTERN.test(id)) {
    return `Section "${id}": the id must match [a-z][a-z0-9_-]*.`;
  }
  if (RESERVED_SECTION_IDS.includes(id)) {
    return `Section "${id}": the id "${id}" is reserved for run links (#/${id}?mod=...).`;
  }
  if (seenIds.has(id)) {
    return `Section "${id}": the id is a duplicate. Each section id must be unique.`;
  }
  return null;
}

function checkOptional(section: SectionDefinition): string | null {
  if (!section.optional || !ALWAYS_SHOWN_SECTION_IDS.includes(section.id)) {
    return null;
  }
  return `Section "${section.id}": it cannot be optional. Home, Settings and About are always shown.`;
}

/**
 * The rule errors of a registry, each naming its section, or none. A broken
 * registry is a mistake of whoever edited it, so the app does not start.
 */
export function validateRegistry(
  sections: readonly SectionDefinition[],
): string[] {
  const errors: string[] = [];
  const seenIds = new Set<string>();
  for (const section of sections) {
    const idError = checkSectionId(section.id, seenIds);
    if (idError !== null) {
      errors.push(idError);
    }
    const optionalError = checkOptional(section);
    if (optionalError !== null) {
      errors.push(optionalError);
    }
    seenIds.add(section.id);
  }
  if (!seenIds.has(HOME_SECTION_ID)) {
    errors.push(
      `The registry has no "${HOME_SECTION_ID}" section. It is Home, shown at #/.`,
    );
  }
  return errors;
}

/** Whether a section targets a default mod that the instantiation switched off. */
function isSwitchedOff(
  section: SectionDefinition,
  defaults: ResolvedDefaultModSettings,
  baseUrl: string,
): boolean {
  if (!("mod" in section.target)) {
    return false;
  }
  try {
    const source = resolveModReference(section.target.mod.mod, {
      baseUrl,
      defaultModsFolder: defaults.folder,
    });
    return findSwitchedOffMod(source, defaults) !== null;
  } catch {
    // An unresolvable reference fails when its mod is launched, with the reason.
    return false;
  }
}

/**
 * The sections that are part of the app: every section but the ones whose
 * mod is a switched-off default mod. Both the stage's routing and the sidebar
 * are built from them.
 */
export function availableSections(
  sections: readonly SectionDefinition[],
  defaults: ResolvedDefaultModSettings,
  baseUrl: string,
): SectionDefinition[] {
  const available: SectionDefinition[] = [];
  for (const section of sections) {
    if (!isSwitchedOff(section, defaults, baseUrl)) {
      available.push(section);
    }
  }
  return available;
}

function buildStageHome(sections: readonly SectionDefinition[]): StageHome {
  for (const section of sections) {
    if (section.id === HOME_SECTION_ID && "mod" in section.target) {
      const modHome: StageHome = {
        kind: "mod",
        section: section.id,
        link: section.target.mod,
      };
      return modHome;
    }
  }
  const pageHome: StageHome = { kind: "page", section: HOME_SECTION_ID };
  return pageHome;
}

/**
 * What the stage needs of the sections, as plain data: the page sections,
 * Home and the mod sections' links. Coming-soon sections are left out, so
 * their addresses show Home.
 */
export function buildStageRouting(
  sections: readonly SectionDefinition[],
): StageRouting {
  const pageSections: string[] = [];
  const sectionLinks: SectionLink[] = [];
  for (const section of sections) {
    if (section.comingSoon) {
      continue;
    }
    if ("mod" in section.target) {
      sectionLinks.push({ section: section.id, link: section.target.mod });
    } else {
      pageSections.push(section.id);
    }
  }
  const routing: StageRouting = {
    pageSections,
    home: buildStageHome(sections),
    sectionLinks,
  };
  return routing;
}
