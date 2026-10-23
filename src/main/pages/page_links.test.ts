import { describe, expect, it } from "vitest";
import {
  buildPageFileUrl,
  mapPageLink,
  resolvePageImage,
} from "./page_links.ts";
import type { PageFile } from "./page_links.ts";

const GUIDES_INDEX: PageFile = {
  section: "guides",
  url: "https://example.org/pages/guides/index.md",
};

describe("buildPageFileUrl", function describeBuildPageFileUrl(): void {
  it("Index file", function buildsIndexUrl(): void {
    expect(buildPageFileUrl("https://example.org/", "about", null)).toBe(
      "https://example.org/pages/about/index.md",
    );
  });

  it("builds a page's file next to the app, also under a sub-path", function buildsPageUrl(): void {
    expect(
      buildPageFileUrl(
        "https://example.org/repo/index.html",
        "guides",
        "first_steps",
      ),
    ).toBe("https://example.org/repo/pages/guides/first_steps.md");
  });
});

describe("mapPageLink", function describeMapPageLink(): void {
  it("Sibling page", function mapsSibling(): void {
    for (const href of [
      "first_steps.md",
      "./first_steps.md",
      "first_steps.md#start",
    ]) {
      expect(mapPageLink(href, GUIDES_INDEX)).toEqual({
        href: "#/guides/first_steps",
        isExternal: false,
      });
    }
  });

  it("maps the index file to the section's address", function mapsIndex(): void {
    expect(mapPageLink("./index.md", GUIDES_INDEX).href).toBe("#/guides");
  });

  it("Run link", function keepsAppAddress(): void {
    const href = "#/run?mod=./samples/mods/book_list";

    expect(mapPageLink(href, GUIDES_INDEX)).toEqual({
      href,
      isExternal: false,
    });
    expect(mapPageLink("#/settings", GUIDES_INDEX).href).toBe("#/settings");
  });

  it("Other site", function marksOtherSite(): void {
    for (const href of ["https://example.com/", "http://example.com/a?b=1"]) {
      expect(mapPageLink(href, GUIDES_INDEX)).toEqual({
        href,
        isExternal: true,
      });
    }
  });

  it("keeps an address on the app's own origin in the app's browsing context", function keepsOwnOrigin(): void {
    expect(mapPageLink("https://example.org/other.html", GUIDES_INDEX)).toEqual(
      {
        href: "https://example.org/other.html",
        isExternal: false,
      },
    );
  });

  it("resolves any other relative link against the page's file", function resolvesRelative(): void {
    expect(mapPageLink("../about/team.pdf", GUIDES_INDEX).href).toBe(
      "https://example.org/pages/about/team.pdf",
    );
    expect(mapPageLink("notes.txt", GUIDES_INDEX).href).toBe(
      "https://example.org/pages/guides/notes.txt",
    );
    expect(mapPageLink("../about/index.md", GUIDES_INDEX).href).toBe(
      "https://example.org/pages/about/index.md",
    );
  });

  it("keeps a mail address as it is", function keepsMail(): void {
    expect(mapPageLink("mailto:team@example.org", GUIDES_INDEX)).toEqual({
      href: "mailto:team@example.org",
      isExternal: false,
    });
  });
});

describe("resolvePageImage", function describeResolvePageImage(): void {
  it("Image next to the page", function resolvesImage(): void {
    const aboutIndex: PageFile = {
      section: "about",
      url: "https://example.org/pages/about/index.md",
    };

    expect(resolvePageImage("./logo.svg", aboutIndex)).toBe(
      "https://example.org/pages/about/logo.svg",
    );
    expect(
      resolvePageImage("https://images.example.net/a.png", aboutIndex),
    ).toBe("https://images.example.net/a.png");
  });
});
