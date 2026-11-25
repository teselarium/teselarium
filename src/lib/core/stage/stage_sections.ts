import { areSameLinks, findSectionLink } from "./stage_routes.ts";
import type { StageRouting } from "./stage_routes.ts";
import { findSandbox, readVisibleEntry } from "./stage_state.ts";
import type { EntryView, StageState } from "./stage_state.ts";

/**
 * Where a section is: `root`, the sandbox of the section's own mod link, and
 * `last`, the view of the latest entry shown that belongs to the section.
 * Both point only to open sandboxes.
 */
export interface SectionPlace {
  root: string | null;
  last: EntryView | null;
}

/**
 * The place of each section, by section id. Derived from what the stage
 * shows, never stored in the browser: after a reload it starts empty.
 */
export type SectionMemory = ReadonlyMap<string, SectionPlace>;

const EMPTY_PLACE: SectionPlace = Object.freeze({ root: null, last: null });

export function createSectionMemory(): SectionMemory {
  const memory: SectionMemory = new Map();
  return memory;
}

export function readSectionPlace(
  memory: SectionMemory,
  section: string,
): SectionPlace {
  return memory.get(section) ?? EMPTY_PLACE;
}

/**
 * The root a shown view gives its section: a sandbox no mod opened, whose
 * link is exactly the section's mod link. It covers the sandbox a section
 * opened, one restored after a reload, and a typed link to the section's mod.
 */
function readRootCandidate(
  state: StageState,
  routing: StageRouting,
  section: string,
  view: EntryView,
): string | null {
  if (view.kind !== "sandbox") {
    return null;
  }
  const sandbox = findSandbox(state, view.sandboxId);
  const sectionLink = findSectionLink(routing, section);
  if (sandbox === null || sectionLink === null || sandbox.openerId !== null) {
    return null;
  }
  return areSameLinks(sandbox.link, sectionLink) ? sandbox.id : null;
}

/** Remembers the visible entry as its section's last view, and learns the section's root. */
export function rememberShownEntry(
  memory: SectionMemory,
  state: StageState,
  routing: StageRouting,
): SectionMemory {
  const entry = readVisibleEntry(state);
  if (entry === null || entry.section === null) {
    return memory;
  }
  const place = readSectionPlace(memory, entry.section);
  const root =
    place.root ?? readRootCandidate(state, routing, entry.section, entry.view);
  const remembered = new Map(memory);
  remembered.set(entry.section, { root, last: entry.view });
  return remembered;
}

function pointsToSandbox(view: EntryView | null, ids: Set<string>): boolean {
  return view !== null && view.kind === "sandbox" && ids.has(view.sandboxId);
}

/** Clears every root and last that points to a closed sandbox. */
export function forgetSandboxes(
  memory: SectionMemory,
  closedIds: readonly string[],
): SectionMemory {
  const ids = new Set(closedIds);
  const remaining = new Map<string, SectionPlace>();
  for (const [section, place] of memory) {
    const kept: SectionPlace = {
      root: place.root !== null && ids.has(place.root) ? null : place.root,
      last: pointsToSandbox(place.last, ids) ? null : place.last,
    };
    remaining.set(section, kept);
  }
  return remaining;
}
