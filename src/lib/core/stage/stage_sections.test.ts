import { describe, expect, it } from "vitest";
import type { RunLink } from "../engine/index.ts";
import {
  createSectionMemory,
  forgetSandboxes,
  readSectionPlace,
  rememberShownEntry,
} from "./stage_sections.ts";
import { createStageState, openStageEntry } from "./stage_state.ts";
import type { EntryTarget, StageState } from "./stage_state.ts";
import type { StageRouting } from "./stage_routes.ts";

const EXPLORER_LINK: RunLink = {
  mod: "mod_explorer",
  collection: null,
  params: {},
};

const ROUTING: StageRouting = {
  pageSections: ["home", "guides"],
  home: { kind: "page", section: "home" },
  sectionLinks: [{ section: "mods", link: EXPLORER_LINK }],
};

function newSandbox(link: RunLink, openerId: string | null): EntryTarget {
  const target: EntryTarget = {
    kind: "new-sandbox",
    opening: { hash: "#/run", link, openerId, isHomeMod: false },
  };
  return target;
}

function openExplorer(section: string | null): StageState {
  return openStageEntry(
    createStageState(),
    newSandbox(EXPLORER_LINK, null),
    section,
  ).state;
}

describe("rememberShownEntry", function describeRememberShownEntry(): void {
  it("starts with nothing remembered", function startsEmpty(): void {
    expect(readSectionPlace(createSectionMemory(), "mods")).toEqual({
      root: null,
      last: null,
    });
  });

  it("learns the root from a sandbox of the section's own link", function learnsRoot(): void {
    const state = openExplorer("mods");

    const memory = rememberShownEntry(createSectionMemory(), state, ROUTING);

    expect(readSectionPlace(memory, "mods")).toEqual({
      root: "sandbox-1",
      last: { kind: "sandbox", sandboxId: "sandbox-1" },
    });
  });

  it("keeps the root and moves last to a sandbox the root opened", function keepsRoot(): void {
    const explorer = openExplorer("mods");
    const first = rememberShownEntry(createSectionMemory(), explorer, ROUTING);
    const viewer = openStageEntry(
      explorer,
      newSandbox(
        { mod: "mod_viewer", collection: null, params: {} },
        "sandbox-1",
      ),
      "mods",
    ).state;

    const memory = rememberShownEntry(first, viewer, ROUTING);

    expect(readSectionPlace(memory, "mods")).toEqual({
      root: "sandbox-1",
      last: { kind: "sandbox", sandboxId: "sandbox-2" },
    });
  });

  it("does not take a sandbox a mod opened as root", function refusesOpenedRoot(): void {
    const state = openStageEntry(
      createStageState(),
      newSandbox(EXPLORER_LINK, "sandbox-9"),
      "mods",
    ).state;

    const memory = rememberShownEntry(createSectionMemory(), state, ROUTING);

    expect(readSectionPlace(memory, "mods").root).toBeNull();
  });

  it("remembers the last page of a page section", function remembersPage(): void {
    const state = openStageEntry(
      createStageState(),
      { kind: "page", section: "guides", page: "first_steps" },
      "guides",
    ).state;

    const memory = rememberShownEntry(createSectionMemory(), state, ROUTING);

    expect(readSectionPlace(memory, "guides")).toEqual({
      root: null,
      last: { kind: "page", section: "guides", page: "first_steps" },
    });
  });

  it("remembers nothing for an entry without a section", function skipsNoSection(): void {
    const memory = rememberShownEntry(
      createSectionMemory(),
      openExplorer(null),
      ROUTING,
    );

    expect(memory.size).toBe(0);
  });
});

describe("forgetSandboxes", function describeForgetSandboxes(): void {
  it("clears the root and last that point to a closed sandbox", function clearsPointers(): void {
    const memory = rememberShownEntry(
      createSectionMemory(),
      openExplorer("mods"),
      ROUTING,
    );

    const forgotten = forgetSandboxes(memory, ["sandbox-1"]);

    expect(readSectionPlace(forgotten, "mods")).toEqual({
      root: null,
      last: null,
    });
    expect(readSectionPlace(memory, "mods").root).toBe("sandbox-1");
  });

  it("keeps pages and other sandboxes", function keepsOthers(): void {
    const pageState = openStageEntry(
      createStageState(),
      { kind: "page", section: "guides", page: null },
      "guides",
    ).state;
    const memory = rememberShownEntry(
      rememberShownEntry(createSectionMemory(), openExplorer("mods"), ROUTING),
      pageState,
      ROUTING,
    );

    const forgotten = forgetSandboxes(memory, ["sandbox-7"]);

    expect(forgotten).toEqual(memory);
  });
});
