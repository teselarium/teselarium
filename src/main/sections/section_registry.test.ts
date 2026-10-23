import { BookOpen, House, Info, Puzzle, Settings } from "lucide-react";
import { describe, expect, it } from "vitest";
import { resolveDefaultModSettings } from "../../lib/core/engine/index.ts";
import { APP_BASE_URL } from "../../test/sample_files.ts";
import {
  availableSections,
  buildStageRouting,
  validateRegistry,
} from "./section_registry.ts";
import type { SectionDefinition } from "./section_registry.ts";
import { VANILLA_SECTIONS } from "./vanilla_sections.ts";

const EXPLORER_LINK = { mod: "mod_explorer", collection: null, params: {} };

function buildPageSection(
  id: string,
  overrides: Partial<SectionDefinition> = {},
): SectionDefinition {
  const section: SectionDefinition = {
    id,
    label: id,
    icon: { lucide: BookOpen },
    target: { page: true },
    group: "main",
    optional: false,
    comingSoon: false,
    ...overrides,
  };
  return section;
}

/** The smallest valid registry: Home, Settings and About pages. */
function buildBaseRegistry(): SectionDefinition[] {
  const registry = [
    buildPageSection("home", { icon: { lucide: House } }),
    buildPageSection("settings", {
      icon: { lucide: Settings },
      group: "footer",
    }),
    buildPageSection("about", { icon: { lucide: Info }, group: "footer" }),
  ];
  return registry;
}

function resolveDefaults(
  switchedOff: string[],
): ReturnType<typeof resolveDefaultModSettings> {
  return resolveDefaultModSettings(
    { folder: "./default_mods/", switchedOff },
    APP_BASE_URL,
  );
}

function listIds(sections: readonly SectionDefinition[]): string[] {
  const ids: string[] = [];
  for (const section of sections) {
    ids.push(section.id);
  }
  return ids;
}

describe("validateRegistry", function describeValidateRegistry(): void {
  it("accepts the vanilla registry", function acceptsVanilla(): void {
    expect(validateRegistry(VANILLA_SECTIONS)).toEqual([]);
  });

  it("Reserved id", function refusesRun(): void {
    const registry = [...buildBaseRegistry(), buildPageSection("run")];

    const errors = validateRegistry(registry);

    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('"run"');
    expect(errors[0]).toContain("reserved");
  });

  it("Duplicate id", function refusesDuplicate(): void {
    const registry = [
      ...buildBaseRegistry(),
      buildPageSection("guides"),
      buildPageSection("guides"),
    ];

    const errors = validateRegistry(registry);

    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('"guides"');
    expect(errors[0]).toContain("duplicate");
  });

  it("Invalid id", function refusesPattern(): void {
    const registry = [...buildBaseRegistry(), buildPageSection("My Guides")];

    const errors = validateRegistry(registry);

    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('"My Guides"');
    expect(errors[0]).toContain("[a-z][a-z0-9_-]*");
  });

  it("needs a home section", function needsHome(): void {
    const registry = buildBaseRegistry().slice(1);

    const errors = validateRegistry(registry);

    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('"home"');
  });

  it("refuses an optional Home, Settings or About section", function refusesOptionalFixed(): void {
    const registry = [
      buildPageSection("home", { optional: true }),
      buildPageSection("settings", { optional: true }),
      buildPageSection("about", { optional: true }),
    ];

    const errors = validateRegistry(registry);

    expect(errors).toHaveLength(3);
    expect(errors[0]).toContain('"home"');
    expect(errors[1]).toContain('"settings"');
    expect(errors[2]).toContain('"about"');
  });

  it("lists every error", function listsEveryError(): void {
    const registry = [buildPageSection("run"), buildPageSection("A")];

    expect(validateRegistry(registry)).toHaveLength(3);
  });
});

describe("availableSections", function describeAvailableSections(): void {
  it("keeps every vanilla section with no switched-off mod", function keepsAll(): void {
    const sections = availableSections(
      VANILLA_SECTIONS,
      resolveDefaults([]),
      APP_BASE_URL,
    );

    expect(listIds(sections)).toEqual([
      "home",
      "tiles",
      "mods",
      "mosaics",
      "guides",
      "settings",
      "about",
    ]);
  });

  it("Explorer switched off", function dropsSwitchedOff(): void {
    const sections = availableSections(
      VANILLA_SECTIONS,
      resolveDefaults(["mod_explorer"]),
      APP_BASE_URL,
    );

    expect(listIds(sections)).not.toContain("mods");
    expect(sections).toHaveLength(VANILLA_SECTIONS.length - 1);
  });

  it("finds a switched-off mod whatever reference names it", function comparesSources(): void {
    const registry = [
      ...buildBaseRegistry(),
      buildPageSection("mods", {
        target: {
          mod: {
            mod: "./default_mods/mod_explorer/",
            collection: null,
            params: {},
          },
        },
      }),
    ];

    const sections = availableSections(
      registry,
      resolveDefaults(["mod_explorer"]),
      APP_BASE_URL,
    );

    expect(listIds(sections)).toEqual(["home", "settings", "about"]);
  });
});

describe("buildStageRouting", function describeBuildStageRouting(): void {
  it("Vanilla sections", function buildsVanillaRouting(): void {
    expect(buildStageRouting(VANILLA_SECTIONS)).toEqual({
      pageSections: ["home", "guides", "settings", "about"],
      home: { kind: "page", section: "home" },
      sectionLinks: [{ section: "mods", link: EXPLORER_LINK }],
    });
  });

  it("Home as a mod", function buildsHomeMod(): void {
    const registry = [
      buildPageSection("home", {
        icon: { lucide: Puzzle },
        target: { mod: EXPLORER_LINK },
      }),
      ...buildBaseRegistry().slice(1),
    ];

    expect(buildStageRouting(registry)).toEqual({
      pageSections: ["settings", "about"],
      home: { kind: "mod", section: "home", link: EXPLORER_LINK },
      sectionLinks: [{ section: "home", link: EXPLORER_LINK }],
    });
  });
});
