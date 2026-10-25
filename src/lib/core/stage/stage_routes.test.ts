import { describe, expect, it } from "vitest";
import {
  SAMPLE_MOD_REFERENCE,
  SAMPLE_MOD_SOURCE,
  SAMPLE_RUN_HASH,
  SAMPLE_VIEWER_RUN_HASH,
} from "../../../test/sample_mods.ts";
import type { RunLink } from "../engine/index.ts";
import {
  buildPageHash,
  buildSectionHash,
  findLinkSection,
  readStageRoute,
  routeForLink,
} from "./stage_routes.ts";
import type { StageRouting } from "./stage_routes.ts";

const EXPLORER_LINK: RunLink = {
  mod: "mod_explorer",
  collection: null,
  params: {},
};

const PAGE_ROUTING: StageRouting = {
  pageSections: ["home", "guides", "settings", "about"],
  home: { kind: "page", section: "home" },
  sectionLinks: [{ section: "mods", link: EXPLORER_LINK }],
};

const MOD_ROUTING: StageRouting = {
  pageSections: ["guides", "settings", "about"],
  home: { kind: "mod", section: "home", link: EXPLORER_LINK },
  sectionLinks: [
    { section: "home", link: EXPLORER_LINK },
    { section: "mods", link: EXPLORER_LINK },
  ],
};

const HOME_PAGE_ROUTE = {
  kind: "page",
  hash: "#/",
  section: "home",
  page: null,
};

describe("readStageRoute", function describeReadStageRoute(): void {
  it("keeps the hash and the link of a run link", function readsRunLink(): void {
    const hash = `${SAMPLE_RUN_HASH}&extra=1`;

    expect(readStageRoute(hash, PAGE_ROUTING)).toEqual({
      kind: "sandbox",
      hash,
      link: {
        mod: SAMPLE_MOD_REFERENCE,
        collection: null,
        params: { extra: "1" },
      },
      isHomeMod: false,
    });
  });

  it("gives the Home page for #/ and an empty hash", function readsHome(): void {
    expect(readStageRoute("#/", PAGE_ROUTING)).toEqual(HOME_PAGE_ROUTE);
    expect(readStageRoute("", PAGE_ROUTING)).toEqual(HOME_PAGE_ROUTE);
  });

  it("gives #/ as the address of the Home section's index page", function readsHomeSection(): void {
    expect(readStageRoute("#/home", PAGE_ROUTING)).toEqual(HOME_PAGE_ROUTE);
  });

  it("Index page", function readsIndexPage(): void {
    expect(readStageRoute("#/guides", PAGE_ROUTING)).toEqual({
      kind: "page",
      hash: "#/guides",
      section: "guides",
      page: null,
    });
  });

  it("Sub-page", function readsSubPage(): void {
    expect(readStageRoute("#/guides/first_steps", PAGE_ROUTING)).toEqual({
      kind: "page",
      hash: "#/guides/first_steps",
      section: "guides",
      page: "first_steps",
    });
  });

  it("Name with a path", function refusesPathName(): void {
    const hashes = [
      "#/guides/..%2Fabout%2Findex",
      "#/guides/../about",
      "#/guides/a/b",
      "#/guides/",
      "#/guides/first steps",
      "#/guides?page=first_steps",
    ];

    for (const hash of hashes) {
      expect(readStageRoute(hash, PAGE_ROUTING)).toEqual(HOME_PAGE_ROUTE);
    }
  });

  it("Unknown hash", function readsUnknownHash(): void {
    for (const hash of ["#/mods/view", "#/run", "#/running?mod=a", "#guides"]) {
      expect(readStageRoute(hash, PAGE_ROUTING)).toEqual(HOME_PAGE_ROUTE);
    }
  });

  it("gives Home for a section that is not a page section", function refusesModSection(): void {
    expect(readStageRoute("#/mods", PAGE_ROUTING)).toEqual(HOME_PAGE_ROUTE);
  });

  it("Home as a mod", function readsHomeMod(): void {
    for (const hash of ["", "#/", "#/home", "#/mods/view"]) {
      expect(readStageRoute(hash, MOD_ROUTING)).toEqual({
        kind: "sandbox",
        hash: "#/",
        link: EXPLORER_LINK,
        isHomeMod: true,
      });
    }
  });

  it("gives a copy of the Home mod's link", function copiesHomeLink(): void {
    const route = readStageRoute("#/", MOD_ROUTING);

    expect(route.kind === "sandbox" && route.link).not.toBe(EXPLORER_LINK);
  });
});

describe("buildPageHash", function describeBuildPageHash(): void {
  it("builds the address of a page", function buildsHashes(): void {
    expect(buildPageHash(PAGE_ROUTING, "home", null)).toBe("#/");
    expect(buildPageHash(PAGE_ROUTING, "home", "news")).toBe("#/home/news");
    expect(buildPageHash(PAGE_ROUTING, "guides", null)).toBe("#/guides");
    expect(buildPageHash(PAGE_ROUTING, "guides", "first_steps")).toBe(
      "#/guides/first_steps",
    );
  });
});

describe("buildSectionHash", function describeBuildSectionHash(): void {
  it("gives the start address of each section", function buildsStarts(): void {
    expect(buildSectionHash(PAGE_ROUTING, "home")).toBe("#/");
    expect(buildSectionHash(PAGE_ROUTING, "guides")).toBe("#/guides");
    expect(buildSectionHash(PAGE_ROUTING, "mods")).toBe(
      "#/run?mod=mod_explorer",
    );
    expect(buildSectionHash(MOD_ROUTING, "home")).toBe("#/");
    expect(buildSectionHash(PAGE_ROUTING, "tiles")).toBeNull();
  });
});

describe("findLinkSection", function describeFindLinkSection(): void {
  it("Typed link to a section's mod", function findsExactLink(): void {
    expect(findLinkSection(PAGE_ROUTING, EXPLORER_LINK)).toBe("mods");
  });

  it("gives the first section in order when several have the link", function findsFirst(): void {
    expect(findLinkSection(MOD_ROUTING, EXPLORER_LINK)).toBe("home");
  });

  it("Link to another mod", function findsNone(): void {
    const otherLinks: RunLink[] = [
      { mod: SAMPLE_MOD_REFERENCE, collection: null, params: {} },
      { mod: "mod_explorer", collection: "./c.yaml", params: {} },
      { mod: "mod_explorer", collection: null, params: { from: "home" } },
    ];

    for (const link of otherLinks) {
      expect(findLinkSection(PAGE_ROUTING, link)).toBeNull();
    }
  });
});

describe("routeForLink", function describeRouteForLink(): void {
  it("builds the hash with buildRunLink and is not the Home mod", function buildsRoute(): void {
    const link = {
      mod: "mod_viewer",
      collection: null,
      params: { target: SAMPLE_MOD_SOURCE },
    };

    expect(routeForLink(link)).toEqual({
      kind: "sandbox",
      hash: SAMPLE_VIEWER_RUN_HASH,
      link,
      isHomeMod: false,
    });
  });
});
