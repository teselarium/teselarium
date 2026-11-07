import { describe, expect, it } from "vitest";
import { buildTestTile } from "../../../test/test_files.ts";
import type { ModIssue, ModPermission } from "../../mod/index.ts";
import type { Tile } from "../../tile/index.ts";
import { scanTileBody } from "../tile_bodies/index.ts";
import { collectTileLinks } from "./tile_links.ts";

const TILE_SOURCE = "https://tiles.example.net/books/kallocain.md";

const OTHER_TILE_SOURCE = "https://tiles.example.net/books/we.md";

const CONTENT_HOSTS = ["https://example.org", "https://tiles.example.net"];

const NO_BODY_MEDIA = new Map<string, string[]>();

function buildShowPermission(host: string): ModPermission {
  const permission: ModPermission = { category: "show", host, reason: "Test" };
  return permission;
}

function buildUnexpressibleIssue(source: string, url: string): ModIssue {
  const issue: ModIssue = {
    level: "warning",
    source,
    message: `Not loading ${url}: the sandbox cannot allow this address.`,
  };
  return issue;
}

function buildPrivateIssue(source: string, url: string): ModIssue {
  const issue: ModIssue = {
    level: "warning",
    source,
    message: `Not loading ${url}: tiles from other sites cannot link addresses on your computer or network.`,
  };
  return issue;
}

function collectImageLink(image: string): ReturnType<typeof collectTileLinks> {
  const tiles = [buildTestTile(TILE_SOURCE, { image })];
  const tileLinks = collectTileLinks(tiles, CONTENT_HOSTS, [], NO_BODY_MEDIA);
  return tileLinks;
}

/** The links of one tile with `body`, whose rendered body media are passed as the renderer collects them. */
function collectBodyLinks(body: string): ReturnType<typeof collectTileLinks> {
  const tile: Tile = {
    source: TILE_SOURCE,
    metadata: { title: "Kallocain" },
    body,
    types: [],
  };
  const bodyMedia = new Map([[tile.source, scanTileBody(tile).mediaUrls]]);
  const tileLinks = collectTileLinks([tile], CONTENT_HOSTS, [], bodyMedia);
  return tileLinks;
}

describe("Media linked by tiles", function describeMediaLinkedByTiles(): void {
  it("Image linked by a tile", function collectsImageLink(): void {
    const tileLinks = collectImageLink(
      "https://media.example.net/covers/kallocain.jpg",
    );

    expect(tileLinks).toEqual({
      sources: ["https://media.example.net/covers/kallocain.jpg"],
      issues: [],
    });
  });

  it("Audio linked by a tile", function collectsAudioLink(): void {
    const tiles = [
      buildTestTile(TILE_SOURCE, {
        audio: "https://media.example.net/sound/theme.mp3",
      }),
    ];

    const tileLinks = collectTileLinks(tiles, CONTENT_HOSTS, [], NO_BODY_MEDIA);

    expect(tileLinks.sources).toEqual([
      "https://media.example.net/sound/theme.mp3",
    ]);
  });

  it("URL inside a nested value", function collectsNestedLink(): void {
    const tiles = [
      buildTestTile(TILE_SOURCE, {
        gallery: [{ src: "https://media.example.net/a.jpg" }],
        credits: { photo: { link: "https://media.example.net/b.jpg" } },
      }),
    ];

    const tileLinks = collectTileLinks(tiles, CONTENT_HOSTS, [], NO_BODY_MEDIA);

    expect(tileLinks.sources).toEqual([
      "https://media.example.net/a.jpg",
      "https://media.example.net/b.jpg",
    ]);
  });

  it("URL with a query", function dropsQueryAndFragment(): void {
    const tileLinks = collectImageLink(
      "https://media.example.net/cover.jpg?size=large#top",
    );

    expect(tileLinks.sources).toEqual(["https://media.example.net/cover.jpg"]);
  });

  it("Image in the body", function collectsBodyImage(): void {
    const tileLinks = collectBodyLinks(
      "![Still](https://media.example.net/body.jpg)",
    );

    expect(tileLinks).toEqual({
      sources: ["https://media.example.net/body.jpg"],
      issues: [],
    });
  });

  it("Video and poster in the body", function collectsBodyVideo(): void {
    const tileLinks = collectBodyLinks(
      '<video src="https://media.example.net/trailer.mp4" poster="https://media.example.net/still.jpg"></video>',
    );

    expect(tileLinks.sources).toEqual([
      "https://media.example.net/still.jpg",
      "https://media.example.net/trailer.mp4",
    ]);
  });

  it("URL in the body", function ignoresBodyText(): void {
    const tileLinks = collectBodyLinks(
      "See https://media.example.net/text.jpg and [this](https://media.example.net/link.jpg).",
    );

    expect(tileLinks).toEqual({ sources: [], issues: [] });
  });

  it("collects the srcset candidates of a picture in the body", function collectsBodyPicture(): void {
    const tileLinks = collectBodyLinks(
      '<picture><source srcset="https://media.example.net/dark.png" media="(prefers-color-scheme: dark)"><img src="https://media.example.net/light.png"></picture>',
    );

    expect(tileLinks.sources).toEqual([
      "https://media.example.net/dark.png",
      "https://media.example.net/light.png",
    ]);
  });

  it("reports a private address of a body image with the guard's issue", function reportsPrivateBodyImage(): void {
    const tileLinks = collectBodyLinks(
      "![Router](http://192.168.1.1/logo.png)",
    );

    expect(tileLinks).toEqual({
      sources: [],
      issues: [buildPrivateIssue(TILE_SOURCE, "http://192.168.1.1/logo.png")],
    });
  });

  it("ignores keys", function ignoresKeys(): void {
    const tiles = [
      buildTestTile(TILE_SOURCE, {
        "https://media.example.net/key.jpg": "Key",
      }),
    ];

    const tileLinks = collectTileLinks(tiles, CONTENT_HOSTS, [], NO_BODY_MEDIA);

    expect(tileLinks.sources).toEqual([]);
  });

  it("skips values that are not http: or https: URLs", function skipsOtherValues(): void {
    const tiles = [
      buildTestTile(TILE_SOURCE, {
        title: "Kallocain",
        year: 1940,
        isRead: true,
        note: null,
        relative: "covers/kallocain.jpg",
        data: "data:image/png;base64,AAAA",
        file: "file:///books/kallocain.jpg",
        mail: "mailto:author@example.net",
      }),
    ];

    const tileLinks = collectTileLinks(tiles, CONTENT_HOSTS, [], NO_BODY_MEDIA);

    expect(tileLinks).toEqual({ sources: [], issues: [] });
  });

  it("sorts the sources without duplicates", function sortsSources(): void {
    const tiles = [
      buildTestTile(TILE_SOURCE, {
        image: "https://zeta.example.net/z.jpg",
        thumbnail: "https://alpha.example.net/a.jpg?small",
      }),
      buildTestTile(OTHER_TILE_SOURCE, {
        image: "https://alpha.example.net/a.jpg",
      }),
    ];

    const tileLinks = collectTileLinks(tiles, CONTENT_HOSTS, [], NO_BODY_MEDIA);

    expect(tileLinks.sources).toEqual([
      "https://alpha.example.net/a.jpg",
      "https://zeta.example.net/z.jpg",
    ]);
  });

  it("skips links that a content host covers", function skipsContentHostLinks(): void {
    const tileLinks = collectImageLink(
      "https://tiles.example.net/covers/kallocain.jpg",
    );

    expect(tileLinks).toEqual({ sources: [], issues: [] });
  });

  it("skips links that a granted show host covers", function skipsShowHostLinks(): void {
    const tiles = [
      buildTestTile(TILE_SOURCE, {
        image: "https://upload.wikimedia.org/a.jpg",
        cover: "https://ia601.us.archive.org/b.jpg",
      }),
    ];
    const granted = [
      buildShowPermission("https://upload.wikimedia.org"),
      buildShowPermission("https://*.us.archive.org"),
    ];

    const tileLinks = collectTileLinks(
      tiles,
      CONTENT_HOSTS,
      granted,
      NO_BODY_MEDIA,
    );

    expect(tileLinks).toEqual({ sources: [], issues: [] });
  });

  it("does not count hosts of other categories as covering", function ignoresOtherCategories(): void {
    const tiles = [
      buildTestTile(TILE_SOURCE, { image: "https://api.example.net/a.jpg" }),
    ];
    const granted: ModPermission[] = [
      { category: "connect", host: "https://api.example.net", reason: "Test" },
    ];

    const tileLinks = collectTileLinks(
      tiles,
      CONTENT_HOSTS,
      granted,
      NO_BODY_MEDIA,
    );

    expect(tileLinks.sources).toEqual(["https://api.example.net/a.jpg"]);
  });

  it("keeps the port of the link", function keepsPort(): void {
    const tileLinks = collectImageLink("https://media.example.net:8443/a.jpg");

    expect(tileLinks.sources).toEqual(["https://media.example.net:8443/a.jpg"]);
  });

  it("does not change the input tiles", function keepsInputTiles(): void {
    const tiles = [
      buildTestTile(TILE_SOURCE, {
        gallery: [{ src: "https://media.example.net/a.jpg?size=large" }],
      }),
    ];
    const tilesCopy = structuredClone(tiles);

    collectTileLinks(tiles, CONTENT_HOSTS, [], NO_BODY_MEDIA);

    expect(tiles).toEqual(tilesCopy);
  });
});

describe("A tile link allows only the linked file", function describeOnlyLinkedFile(): void {
  it("Other file of the same host", function allowsOnlyLinkedPath(): void {
    const tileLinks = collectImageLink(
      "https://media.example.net/covers/kallocain.jpg",
    );

    expect(tileLinks.sources).toEqual([
      "https://media.example.net/covers/kallocain.jpg",
    ]);
    expect(tileLinks.sources).not.toContain("https://media.example.net");
  });

  it("Link to a folder", function skipsFolderLink(): void {
    const tiles = [
      buildTestTile(TILE_SOURCE, {
        homepage: "https://media.example.net/covers/",
        site: "https://media.example.net",
      }),
    ];

    const tileLinks = collectTileLinks(tiles, CONTENT_HOSTS, [], NO_BODY_MEDIA);

    expect(tileLinks).toEqual({ sources: [], issues: [] });
  });

  it("Comma in the path", function allowsCommaPath(): void {
    const tileLinks = collectImageLink(
      "https://media.example.net/covers/chronicles,_volume_1.jpg",
    );

    expect(tileLinks).toEqual({
      sources: ["https://media.example.net/covers/chronicles%2C_volume_1.jpg"],
      issues: [],
    });
  });

  it("Brackets and vertical bar in the path", function allowsBracketsAndBarPath(): void {
    const tileLinks = collectImageLink("https://media.example.net/a[1]|b.jpg");

    expect(tileLinks).toEqual({
      sources: ["https://media.example.net/a%5B1%5D%7Cb.jpg"],
      issues: [],
    });
  });

  it("gives one source for a comma written as it is and as %2C", function mergesEncodedComma(): void {
    const tiles = [
      buildTestTile(TILE_SOURCE, {
        image: "https://media.example.net/a,b.jpg",
        thumbnail: "https://media.example.net/a%2Cb.jpg",
      }),
    ];

    const tileLinks = collectTileLinks(tiles, CONTENT_HOSTS, [], NO_BODY_MEDIA);

    expect(tileLinks).toEqual({
      sources: ["https://media.example.net/a%2Cb.jpg"],
      issues: [],
    });
  });

  it("gives one source for a vertical bar written as it is and as %7C", function mergesEncodedBar(): void {
    const tiles = [
      buildTestTile(TILE_SOURCE, {
        image: "https://media.example.net/a|b.jpg",
        thumbnail: "https://media.example.net/a%7Cb.jpg",
      }),
    ];

    const tileLinks = collectTileLinks(tiles, CONTENT_HOSTS, [], NO_BODY_MEDIA);

    expect(tileLinks).toEqual({
      sources: ["https://media.example.net/a%7Cb.jpg"],
      issues: [],
    });
  });

  it("allows a body image with a comma in the path", function allowsCommaBodyImage(): void {
    const tileLinks = collectBodyLinks(
      "![Still](https://media.example.net/stills/scene,_part_1.jpg)",
    );

    expect(tileLinks).toEqual({
      sources: ["https://media.example.net/stills/scene%2C_part_1.jpg"],
      issues: [],
    });
  });
});

describe("Tile links the sandbox cannot express", function describeUnexpressibleLinks(): void {
  it("Link with a password", function reportsPasswordLink(): void {
    const url = "https://user:secret@media.example.net/cover.jpg";

    const tileLinks = collectImageLink(url);

    expect(tileLinks).toEqual({
      sources: [],
      issues: [buildUnexpressibleIssue(TILE_SOURCE, url)],
    });
  });

  it("reports a link with only a user name", function reportsUserNameLink(): void {
    const url = "https://user@media.example.net/cover.jpg";

    const tileLinks = collectImageLink(url);

    expect(tileLinks.issues).toEqual([
      buildUnexpressibleIssue(TILE_SOURCE, url),
    ]);
  });

  it("Link with an IPv6 address", function reportsIpv6Link(): void {
    const url = "https://[2001:db8::1]/cover.jpg";

    const tileLinks = collectImageLink(url);

    expect(tileLinks).toEqual({
      sources: [],
      issues: [buildUnexpressibleIssue(TILE_SOURCE, url)],
    });
  });

  it("reports a host name with an underscore", function reportsUnderscoreHost(): void {
    const url = "https://my_media.example.net/cover.jpg";

    const tileLinks = collectImageLink(url);

    expect(tileLinks.issues).toEqual([
      buildUnexpressibleIssue(TILE_SOURCE, url),
    ]);
  });

  it("Semicolon in the path", function allowsSemicolonPath(): void {
    const tileLinks = collectImageLink("https://media.example.net/a;b.jpg");

    expect(tileLinks).toEqual({
      sources: ["https://media.example.net/a%3Bb.jpg"],
      issues: [],
    });
  });

  it("allows the path characters a source can hold", function allowsSourcePathCharacters(): void {
    const tileLinks = collectImageLink(
      "https://media.example.net/a-b_c.d~e!f$g&h'i(j)k*l+m=n:o@p%20q.jpg",
    );

    expect(tileLinks).toEqual({
      sources: [
        "https://media.example.net/a-b_c.d~e!f$g&h'i(j)k*l+m=n:o@p%20q.jpg",
      ],
      issues: [],
    });
  });

  it("allows a path the URL parser percent-encodes", function allowsEncodedPath(): void {
    const tileLinks = collectImageLink(
      "https://media.example.net/covers/the cover.jpg",
    );

    expect(tileLinks.sources).toEqual([
      "https://media.example.net/covers/the%20cover.jpg",
    ]);
  });

  it("Same link twice in one tile", function reportsLinkOncePerTile(): void {
    const url = "https://[2001:db8::1]/cover.jpg";
    const tiles = [buildTestTile(TILE_SOURCE, { image: url, thumbnail: url })];

    const tileLinks = collectTileLinks(tiles, CONTENT_HOSTS, [], NO_BODY_MEDIA);

    expect(tileLinks.issues).toEqual([
      buildUnexpressibleIssue(TILE_SOURCE, url),
    ]);
  });

  it("reports the same link in two tiles once for each tile", function reportsLinkForEachTile(): void {
    const url = "https://[2001:db8::1]/cover.jpg";
    const tiles = [
      buildTestTile(TILE_SOURCE, { image: url }),
      buildTestTile(OTHER_TILE_SOURCE, { image: url }),
    ];

    const tileLinks = collectTileLinks(tiles, CONTENT_HOSTS, [], NO_BODY_MEDIA);

    expect(tileLinks.issues).toEqual([
      buildUnexpressibleIssue(TILE_SOURCE, url),
      buildUnexpressibleIssue(OTHER_TILE_SOURCE, url),
    ]);
  });
});

describe("Private network guard", function describePrivateNetworkGuard(): void {
  it("Router address in a tile from the web", function reportsRouterLink(): void {
    const url = "http://192.168.1.1/logo.png";

    const tileLinks = collectImageLink(url);

    expect(tileLinks).toEqual({
      sources: [],
      issues: [buildPrivateIssue(TILE_SOURCE, url)],
    });
  });

  it("Tile from a private host", function allowsLinkFromPrivateTile(): void {
    const tileSource = "http://localhost:8080/books/kallocain.md";
    const tiles = [
      buildTestTile(tileSource, { image: "http://192.168.1.20/cover.png" }),
    ];

    const tileLinks = collectTileLinks(
      tiles,
      ["http://localhost:8080"],
      [],
      NO_BODY_MEDIA,
    );

    expect(tileLinks).toEqual({
      sources: ["http://192.168.1.20/cover.png"],
      issues: [],
    });
  });

  it("Tile picked from the user's computer", function guardsPickedTile(): void {
    const tileSource = "file:///books/kallocain.md";
    const url = "http://localhost:3000/cover.png";
    const tiles = [buildTestTile(tileSource, { image: url })];

    const tileLinks = collectTileLinks(tiles, [], [], NO_BODY_MEDIA);

    expect(tileLinks).toEqual({
      sources: [],
      issues: [buildPrivateIssue(tileSource, url)],
    });
  });

  it("reports a private link once per tile", function reportsPrivateLinkOnce(): void {
    const url = "http://192.168.1.1/logo.png";
    const tiles = [buildTestTile(TILE_SOURCE, { logo: url, icon: [url] })];

    const tileLinks = collectTileLinks(tiles, CONTENT_HOSTS, [], NO_BODY_MEDIA);

    expect(tileLinks.issues).toEqual([buildPrivateIssue(TILE_SOURCE, url)]);
  });

  it("skips a private link that a content host covers", function skipsCoveredPrivateLink(): void {
    const tiles = [
      buildTestTile(TILE_SOURCE, { image: "http://localhost:5173/a.png" }),
    ];

    const tileLinks = collectTileLinks(
      tiles,
      [...CONTENT_HOSTS, "http://localhost:5173"],
      [],
      NO_BODY_MEDIA,
    );

    expect(tileLinks).toEqual({ sources: [], issues: [] });
  });
});
