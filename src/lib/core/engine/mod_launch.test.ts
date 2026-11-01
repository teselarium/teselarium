import { afterEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import {
  APP_BASE_URL,
  FIXTURES_BASE_URL,
  FIXTURES_REFERENCE,
} from "../../../test/sample_files.ts";
import {
  APP_ORIGIN,
  buildSampleCoversDecision,
  COVER_BOOK_COLLECTION_SOURCE,
  COVER_BOOK_IMAGE_URL,
  FOUR_BOOKS_SOURCE,
  MISSING_MOD_REFERENCE,
  NO_COUNTRY_TILE_SOURCE,
  OTHER_API_MOD_SOURCE,
  OTHER_APP_ORIGIN,
  SAMPLE_COLLECTION_REFERENCE,
  SAMPLE_COLLECTION_SOURCE,
  SAMPLE_COVERS_PERMISSION,
  SAMPLE_MOD_REFERENCE,
  SAMPLE_MOD_SOURCE,
  SAMPLE_TILE_SOURCES,
  SAMPLE_TYPE_SOURCE,
  serveCoverBook,
  serveFourBooks,
  serveOtherApiMod,
  serveTestMod,
  serveUntypedMod,
  TEST_DEFAULTS,
  UNTYPED_MOD_SOURCE,
} from "../../../test/sample_mods.ts";
import {
  buildTypeText,
  fetchTestFile,
  readRequestedUrl,
  testTexts,
} from "../../../test/test_files.ts";
import { launchTestMod } from "../../../test/test_launches.ts";
import { FileFetchError, YamlParseError } from "../../files/index.ts";
import { ModFormatError } from "../../mod/index.ts";
import {
  buildTileValidator,
  CollectionFormatError,
  loadTileCollection,
  TileTypeError,
} from "../../tile/index.ts";
import type { Tile } from "../../tile/index.ts";
import { grantModPermissions } from "../permissions/index.ts";
import { resolveDefaultModSettings } from "./default_mod_settings.ts";
import { ModSwitchedOffError } from "./engine_errors.ts";
import { MOD_API_VERSION } from "./mod_api_version.ts";
import {
  buildSandboxDocument,
  SANDBOX_CASE_FINISHED_METHOD,
} from "../sandbox/index.ts";
import {
  buildModLaunch,
  buildModTestDocument,
  loadModLaunchInputs,
  loadModTiles,
  selectModTiles,
} from "./mod_launch.ts";
import type {
  ModLaunch,
  ModLaunchInputs,
  ModTiles,
  RunLink,
} from "./mod_launch.ts";

const SAMPLE_LINK: RunLink = {
  mod: SAMPLE_MOD_REFERENCE,
  collection: SAMPLE_COLLECTION_REFERENCE,
  params: {},
};

/** The covers of the sample tiles, sorted, which a mod gets as tile links when `show` is not granted. */
const SAMPLE_COVER_URLS = [
  "https://upload.wikimedia.org/wikipedia/en/a/ab/KallocainCover.jpg",
  "https://upload.wikimedia.org/wikipedia/en/a/ae/The_library_of_babel_-_bookcover.jpg",
  "https://upload.wikimedia.org/wikipedia/en/d/db/Fahrenheit_451_1st_ed_cover.jpg",
];

const LINKED_BOOK_COLLECTION_SOURCE = `${FIXTURES_BASE_URL}tiles/linked_book.yaml`;
const LINKED_BOOK_TILE_SOURCE = `${FIXTURES_BASE_URL}tiles/books/linked_book.md`;

/** Serves a collection with one book tile whose `image` and `logo` are the given URLs. */
function serveLinkedBook(image: string, logo: string): void {
  testTexts.set(
    LINKED_BOOK_COLLECTION_SOURCE,
    [
      "collection:",
      '  name: "Linked book"',
      "  tiles:",
      '    - path: "./books/linked_book.md"',
    ].join("\n"),
  );
  testTexts.set(
    LINKED_BOOK_TILE_SOURCE,
    buildTypeText([
      'title: "Linked book"',
      'date: "2001-01-01"',
      "authors:",
      '  - "Anonymous"',
      'country: "Sweden"',
      "genres:",
      '  - "Mystery"',
      `image: "${image}"`,
      `logo: "${logo}"`,
    ]),
  );
}

function readDirective(policy: string, name: string): string {
  for (const directive of policy.split("; ")) {
    if (directive.startsWith(`${name} `)) {
      return directive;
    }
  }
  return "";
}

afterEach(function clearTestTexts(): void {
  testTexts.clear();
});

function createTestFetch(): Mock<typeof fetch> {
  const testFetch = vi.fn<typeof fetch>(fetchTestFile);
  return testFetch;
}

function listRequestedUrls(testFetch: Mock<typeof fetch>): string[] {
  const requestedUrls: string[] = [];
  for (const call of testFetch.mock.calls) {
    requestedUrls.push(readRequestedUrl(call[0]));
  }
  return requestedUrls;
}

function launchMod(
  link: RunLink,
  appOrigin: string = APP_ORIGIN,
  testFetch: typeof fetch = fetchTestFile,
  loadsTileLinkedMedia = true,
): Promise<ModLaunch> {
  return launchTestMod(link, {
    appOrigin,
    loadsTileLinkedMedia,
    fetchOptions: { baseUrl: APP_BASE_URL, fetch: testFetch },
  });
}

function loadInputs(
  link: RunLink,
  testFetch: typeof fetch = fetchTestFile,
): Promise<ModLaunchInputs> {
  return loadModLaunchInputs(
    { link, defaults: TEST_DEFAULTS },
    { baseUrl: APP_BASE_URL, fetch: testFetch },
  );
}

function readModTiles(inputs: ModLaunchInputs): ModTiles {
  if (inputs.modTiles === null) {
    throw new Error(`The link to ${inputs.mod.source} names no collection.`);
  }
  return inputs.modTiles;
}

function listTileTypes(tiles: Tile[]): string[][] {
  const tileTypes: string[][] = [];
  for (const tile of tiles) {
    tileTypes.push(tile.types);
  }
  return tileTypes;
}

describe("loadModLaunchInputs", function describeLoadModLaunchInputs(): void {
  it("loads the mod, the link and its tiles", async function loadsInputs(): Promise<void> {
    const inputs = await loadInputs(SAMPLE_LINK);

    expect(inputs.mod.source).toBe(SAMPLE_MOD_SOURCE);
    expect(inputs.link).toEqual(SAMPLE_LINK);
    expect(readModTiles(inputs).collectionSource).toBe(
      SAMPLE_COLLECTION_SOURCE,
    );
    expect(listTileTypes(readModTiles(inputs).tiles)).toEqual([
      ["book"],
      ["book"],
      ["book"],
    ]);
  });

  it("Mod opened without a collection", async function loadsWithoutCollection(): Promise<void> {
    const testFetch = createTestFetch();

    const inputs = await loadInputs(
      { ...SAMPLE_LINK, collection: null },
      testFetch,
    );

    expect(inputs.modTiles).toBeNull();
    expect(listRequestedUrls(testFetch)).not.toContain(
      SAMPLE_COLLECTION_SOURCE,
    );
  });

  it("Tile of another type is left out", async function leavesOutOtherType(): Promise<void> {
    serveFourBooks();

    const inputs = await loadInputs({
      ...SAMPLE_LINK,
      collection: FOUR_BOOKS_SOURCE,
    });

    const tileSources: string[] = [];
    for (const tile of readModTiles(inputs).tiles) {
      tileSources.push(tile.source);
    }
    expect(tileSources).toEqual(SAMPLE_TILE_SOURCES);
    expect(readModTiles(inputs).issues).toHaveLength(1);
    expect(readModTiles(inputs).issues[0].level).toBe("warning");
    expect(readModTiles(inputs).issues[0].source).toBe(NO_COUNTRY_TILE_SOURCE);
  });

  it("Mod without a tile type", async function givesEveryTile(): Promise<void> {
    serveUntypedMod();

    const inputs = await loadInputs({
      ...SAMPLE_LINK,
      mod: UNTYPED_MOD_SOURCE,
    });

    expect(listTileTypes(readModTiles(inputs).tiles)).toEqual([[], [], []]);
  });

  it("Image next to the tile", async function resolvesTilePaths(): Promise<void> {
    serveCoverBook();

    const inputs = await loadInputs({
      ...SAMPLE_LINK,
      collection: COVER_BOOK_COLLECTION_SOURCE,
    });

    expect(readModTiles(inputs).tiles).toHaveLength(1);
    expect(readModTiles(inputs).tiles[0].metadata.image).toBe(
      COVER_BOOK_IMAGE_URL,
    );
  });

  it("refuses a switched-off mod before any request", async function refusesSwitchedOff(): Promise<void> {
    const testFetch = createTestFetch();
    const defaults = resolveDefaultModSettings(
      {
        folder: `${FIXTURES_REFERENCE}mods/`,
        switchedOff: ["book_list"],
      },
      APP_BASE_URL,
    );

    const launching = loadModLaunchInputs(
      { link: SAMPLE_LINK, defaults },
      { baseUrl: APP_BASE_URL, fetch: testFetch },
    );

    await expect(launching).rejects.toThrow(ModSwitchedOffError);
    await expect(launching).rejects.toThrow(
      'The default mod "book_list" is switched off.',
    );
    expect(testFetch).not.toHaveBeenCalled();
  });

  it("propagates mod file errors with their classes", async function propagatesModErrors(): Promise<void> {
    testTexts.set(
      `${FIXTURES_BASE_URL}mods/no_mod/mod_conf.yaml`,
      'name: "no mod mapping"',
    );
    testTexts.set(
      `${FIXTURES_BASE_URL}mods/bad_yaml/mod_conf.yaml`,
      "mod: [unclosed",
    );

    await expect(
      loadInputs({ ...SAMPLE_LINK, mod: MISSING_MOD_REFERENCE }),
    ).rejects.toThrow(FileFetchError);
    await expect(
      loadInputs({ ...SAMPLE_LINK, mod: `${FIXTURES_REFERENCE}mods/no_mod` }),
    ).rejects.toThrow(ModFormatError);
    await expect(
      loadInputs({ ...SAMPLE_LINK, mod: `${FIXTURES_REFERENCE}mods/bad_yaml` }),
    ).rejects.toThrow(YamlParseError);
  });

  it("propagates type file errors with their classes", async function propagatesTypeErrors(): Promise<void> {
    const brokenTypeSource = `${FIXTURES_BASE_URL}mods/broken_type/mod_conf.yaml`;
    serveTestMod(brokenTypeSource, [
      '  name: "broken_type"',
      '  version: "0.1.0"',
      '  entrypoint: "./main.js"',
      '  type_path: "./type.md"',
    ]);
    testTexts.set(
      `${FIXTURES_BASE_URL}mods/broken_type/type.md`,
      "---\ntitle: no schema\n---\n",
    );

    await expect(
      loadInputs({ ...SAMPLE_LINK, mod: brokenTypeSource }),
    ).rejects.toThrow(TileTypeError);
  });

  it("propagates collection errors with their classes", async function propagatesCollectionErrors(): Promise<void> {
    testTexts.set(
      `${FIXTURES_BASE_URL}tiles/not_a_collection.yaml`,
      'name: "no collection mapping"',
    );

    await expect(
      loadInputs({
        ...SAMPLE_LINK,
        collection: `${FIXTURES_REFERENCE}tiles/missing.yaml`,
      }),
    ).rejects.toThrow(
      `Cannot load file "${FIXTURES_BASE_URL}tiles/missing.yaml": HTTP 404`,
    );
    await expect(
      loadInputs({
        ...SAMPLE_LINK,
        collection: `${FIXTURES_REFERENCE}tiles/not_a_collection.yaml`,
      }),
    ).rejects.toThrow(CollectionFormatError);
  });
});

describe("buildModLaunch", function describeBuildModLaunch(): void {
  it("Sample mount context", async function buildsSampleContext(): Promise<void> {
    const launch = await launchMod(SAMPLE_LINK);

    expect(launch.context.mod).toEqual({
      source: SAMPLE_MOD_SOURCE,
      name: "book_list",
      title: "Book List",
      version: "1.0.0",
      description: "A very simple list of books with their covers.",
    });
    expect(launch.context.config).toEqual(launch.mod.config);
    expect(launch.context.params).toEqual({});
    expect(launch.context.permissions).toEqual({
      granted: [SAMPLE_COVERS_PERMISSION],
      denied: [],
    });
    expect(launch.contentHosts).toEqual(["https://example.org"]);
    expect(launch.collectionSource).toBe(SAMPLE_COLLECTION_SOURCE);
    expect(launch.issues).toEqual([]);
  });

  it("Sample tiles are books", async function givesBookTiles(): Promise<void> {
    const launch = await launchMod(SAMPLE_LINK);

    expect(listTileTypes(launch.context.tiles)).toEqual([
      ["book"],
      ["book"],
      ["book"],
    ]);
    expect(launch.context.issues).toEqual([]);
  });

  it("Foreign mod sees its denied permissions", async function deniesForeignMod(): Promise<void> {
    const launch = await launchMod(SAMPLE_LINK, OTHER_APP_ORIGIN);

    expect(launch.context.permissions).toEqual({
      granted: [],
      denied: [SAMPLE_COVERS_PERMISSION],
    });
    expect(launch.issues).toHaveLength(1);
    expect(launch.issues[0].level).toBe("warning");
    expect(launch.issues[0].source).toBe(SAMPLE_MOD_SOURCE);
    expect(launch.issues[0].message).toContain(
      'show content from https://upload.wikimedia.org ("Shows the book covers")',
    );
  });

  it("Foreign mod with an allowed permission", async function grantsAllowedForeignPermission(): Promise<void> {
    const inputs = await loadInputs(SAMPLE_LINK);
    const grants = grantModPermissions(inputs.mod, OTHER_APP_ORIGIN, [
      buildSampleCoversDecision(true),
    ]);

    const launch = buildModLaunch(
      inputs.mod,
      inputs.link,
      inputs.modTiles,
      grants,
      false,
    );

    expect(launch.context.permissions).toEqual({
      granted: [SAMPLE_COVERS_PERMISSION],
      denied: [],
    });
    expect(readDirective(launch.policy, "img-src")).toContain(
      "https://upload.wikimedia.org",
    );
    expect(launch.issues).toEqual([]);
  });

  it("Link parameters", async function copiesParams(): Promise<void> {
    const params = { target: SAMPLE_MOD_SOURCE };

    const launch = await launchMod({ ...SAMPLE_LINK, params });

    expect(launch.context.params).toEqual(params);
    expect(launch.context.params).not.toBe(params);
  });

  it("names the covers host in the policy only when granted", async function buildsPolicy(): Promise<void> {
    const grantedLaunch = await launchMod(SAMPLE_LINK);
    const deniedLaunch = await launchMod(
      SAMPLE_LINK,
      OTHER_APP_ORIGIN,
      fetchTestFile,
      false,
    );

    expect(grantedLaunch.sandboxDocument).toContain(
      "https://upload.wikimedia.org",
    );
    expect(deniedLaunch.sandboxDocument).not.toContain(
      "https://upload.wikimedia.org",
    );
    expect(deniedLaunch.sandboxDocument).toContain(
      "img-src data: blob: https://example.org;",
    );
  });

  it("keeps the policy of the frame document", async function keepsPolicy(): Promise<void> {
    const launch = await launchMod(SAMPLE_LINK);

    expect(launch.policy).toContain("https://upload.wikimedia.org");
    expect(launch.sandboxDocument).toBe(
      buildSandboxDocument(launch.policy, launch.mod.theme),
    );
  });

  it("builds a test document with the policy of the frame document and the runner", async function buildsTestDocument(): Promise<void> {
    const launch = await launchMod(SAMPLE_LINK, OTHER_APP_ORIGIN);

    const testDocument = buildModTestDocument(launch);

    expect(testDocument).toContain(`content="${launch.policy}">`);
    expect(launch.sandboxDocument).toContain(`content="${launch.policy}">`);
    expect(testDocument).toContain("<style>");
    expect(testDocument).toContain(`"${SANDBOX_CASE_FINISHED_METHOD}"`);
    expect(launch.sandboxDocument).not.toContain(
      `"${SANDBOX_CASE_FINISHED_METHOD}"`,
    );
    expect(testDocument).toBe(
      buildSandboxDocument(launch.policy, "default", { testRunner: true }),
    );
  });

  it("builds the frame document with the mod's theme setting", async function passesTheme(): Promise<void> {
    const plainSource = `${APP_BASE_URL}mods/plain/mod_conf.yaml`;
    serveTestMod(plainSource, [
      '  name: "plain"',
      '  version: "0.1.0"',
      '  entrypoint: "./main.js"',
      '  theme: "none"',
    ]);

    const sampleLaunch = await launchMod(SAMPLE_LINK);
    const plainLaunch = await launchMod({
      mod: plainSource,
      collection: null,
      params: {},
    });

    expect(sampleLaunch.sandboxDocument).toContain("<style>");
    expect(plainLaunch.sandboxDocument).not.toContain("<style");
  });

  it("Structured clone of the mount context", async function clonesContext(): Promise<void> {
    const launch = await launchMod(SAMPLE_LINK);

    expect(structuredClone(launch.context)).toEqual(launch.context);
    expect(structuredClone(launch)).toEqual(launch);
  });

  it("Sample mod reads the version", async function givesApiVersion(): Promise<void> {
    const launch = await launchMod(SAMPLE_LINK);

    expect(launch.context.api).toEqual({ version: MOD_API_VERSION });
    expect(Object.keys(launch.context.api)).toEqual(["version"]);
  });

  it("Mod without a range reads the version", async function givesApiVersionWithoutRange(): Promise<void> {
    serveUntypedMod(null);

    const launch = await launchMod({ ...SAMPLE_LINK, mod: UNTYPED_MOD_SOURCE });

    expect(launch.context.api.version).toBe(MOD_API_VERSION);
  });

  it("Plain data", async function clonesApi(): Promise<void> {
    const launch = await launchMod(SAMPLE_LINK);

    expect(structuredClone(launch.context.api)).toEqual(launch.context.api);
  });

  it("matches the sample mod's range with no file issue", async function matchesSampleRange(): Promise<void> {
    const launch = await launchMod(SAMPLE_LINK);

    expect(launch.apiCompatible).toBe(true);
    expect(launch.fileIssues).toEqual([]);
  });

  it("Mods for 0.1.0 still match", async function matchesFirstVersionRange(): Promise<void> {
    serveUntypedMod("^0.1.0");

    const launch = await launchMod({ ...SAMPLE_LINK, mod: UNTYPED_MOD_SOURCE });

    expect(launch.apiCompatible).toBe(true);
    expect(launch.fileIssues).toEqual([]);
  });

  it("Mod without a range", async function warnsWithoutRange(): Promise<void> {
    serveUntypedMod(null);

    const launch = await launchMod({ ...SAMPLE_LINK, mod: UNTYPED_MOD_SOURCE });

    expect(launch.apiCompatible).toBeNull();
    expect(launch.fileIssues).toHaveLength(1);
    expect(launch.fileIssues[0].level).toBe("warning");
    expect(launch.fileIssues[0].source).toBe(UNTYPED_MOD_SOURCE);
    expect(launch.fileIssues[0].message).toContain('"api"');
    expect(launch.fileIssues[0].message).toContain(MOD_API_VERSION);
    expect(launch.issues).toEqual([]);
  });

  it("gives a mod for another API no file issue", async function refusesOtherApi(): Promise<void> {
    serveOtherApiMod();

    const launch = await launchMod({
      ...SAMPLE_LINK,
      mod: OTHER_API_MOD_SOURCE,
    });

    expect(launch.apiCompatible).toBe(false);
    expect(launch.fileIssues).toEqual([]);
  });
});

describe("Media linked by tiles", function describeTileLinkedMedia(): void {
  it("adds no source for links a granted show host covers", async function skipsCoveredLinks(): Promise<void> {
    const onLaunch = await launchMod(SAMPLE_LINK);
    const offLaunch = await launchMod(
      SAMPLE_LINK,
      APP_ORIGIN,
      fetchTestFile,
      false,
    );

    expect(onLaunch.tileLinks).toEqual({ sources: [], issues: [] });
    expect(onLaunch.policy).toBe(offLaunch.policy);
  });

  it("Mod from another origin", async function givesLinksToForeignMod(): Promise<void> {
    const launch = await launchMod(SAMPLE_LINK, OTHER_APP_ORIGIN);

    expect(launch.tileLinks).toEqual({
      sources: SAMPLE_COVER_URLS,
      issues: [],
    });
    const linkSources = SAMPLE_COVER_URLS.join(" ");
    expect(readDirective(launch.policy, "img-src")).toBe(
      `img-src data: blob: https://example.org ${linkSources}`,
    );
    expect(readDirective(launch.policy, "media-src")).toBe(
      `media-src data: blob: https://example.org ${linkSources}`,
    );
    expect(readDirective(launch.policy, "style-src")).not.toContain(
      "upload.wikimedia.org",
    );
    expect(readDirective(launch.policy, "connect-src")).toBe(
      "connect-src 'none'",
    );
    expect(launch.sandboxDocument).toBe(
      buildSandboxDocument(launch.policy, launch.mod.theme),
    );
  });

  it("Setting switched off", async function collectsNothingWhenOff(): Promise<void> {
    const launch = await launchMod(
      SAMPLE_LINK,
      OTHER_APP_ORIGIN,
      fetchTestFile,
      false,
    );

    expect(launch.tileLinks).toBeNull();
    expect(launch.policy).not.toContain("upload.wikimedia.org");
  });

  it("collects nothing without a collection", async function collectsWithoutCollection(): Promise<void> {
    const launch = await launchMod({ ...SAMPLE_LINK, collection: null });

    expect(launch.tileLinks).toEqual({ sources: [], issues: [] });
  });

  it("keeps the left-out links out of the other issues", async function keepsLeftOutIssuesApart(): Promise<void> {
    serveLinkedBook(
      "https://media.example.net/covers/linked.jpg",
      "http://192.168.1.1/logo.png",
    );

    const launch = await launchMod({
      ...SAMPLE_LINK,
      collection: LINKED_BOOK_COLLECTION_SOURCE,
    });

    expect(launch.tileLinks).toEqual({
      sources: ["https://media.example.net/covers/linked.jpg"],
      issues: [
        {
          level: "warning",
          source: LINKED_BOOK_TILE_SOURCE,
          message:
            "Not loading http://192.168.1.1/logo.png: tiles from other sites cannot link addresses on your computer or network.",
        },
      ],
    });
    expect(launch.issues).toEqual([]);
    expect(launch.fileIssues).toEqual([]);
    expect(launch.context.issues).toEqual([]);
  });

  it("does not change the mount context", async function keepsMountContext(): Promise<void> {
    serveLinkedBook(
      "https://media.example.net/covers/linked.jpg",
      "http://192.168.1.1/logo.png",
    );
    const link = { ...SAMPLE_LINK, collection: LINKED_BOOK_COLLECTION_SOURCE };

    const onLaunch = await launchMod(link, OTHER_APP_ORIGIN);
    const offLaunch = await launchMod(
      link,
      OTHER_APP_ORIGIN,
      fetchTestFile,
      false,
    );

    expect(onLaunch.context).toEqual(offLaunch.context);
    expect(Object.keys(onLaunch.context).sort()).toEqual([
      "api",
      "config",
      "issues",
      "mod",
      "params",
      "permissions",
      "tiles",
    ]);
  });
});

describe("loadModTiles", function describeLoadModTiles(): void {
  it("gives the same tiles when called again", async function reloadsTiles(): Promise<void> {
    const launch = await launchMod(SAMPLE_LINK);
    const options = { baseUrl: APP_BASE_URL, fetch: fetchTestFile };

    const firstTiles = await loadModTiles(
      launch.mod,
      SAMPLE_COLLECTION_SOURCE,
      options,
    );
    const secondTiles = await loadModTiles(
      launch.mod,
      SAMPLE_COLLECTION_SOURCE,
      options,
    );

    expect(firstTiles).toEqual(secondTiles);
    expect(firstTiles.collectionSource).toBe(SAMPLE_COLLECTION_SOURCE);
    expect(firstTiles.tiles).toEqual(launch.context.tiles);
    expect(firstTiles.issues).toEqual([]);
  });
});

describe("selectModTiles", function describeSelectModTiles(): void {
  it("Loaded tile keeps the path as written", async function keepsLoadedTile(): Promise<void> {
    serveCoverBook();
    const options = { baseUrl: APP_BASE_URL, fetch: fetchTestFile };
    const collection = await loadTileCollection(
      COVER_BOOK_COLLECTION_SOURCE,
      options,
    );
    const tileValidator = await buildTileValidator(SAMPLE_TYPE_SOURCE, options);

    const modTiles = selectModTiles(collection, tileValidator);

    expect(modTiles.tiles[0].metadata.image).toBe(COVER_BOOK_IMAGE_URL);
    expect(collection.tiles[0].metadata.image).toBe("./cover.jpg");
  });
});

/** The sample mod's launch, built with tiles whose bodies and metadata the test gives. */
async function launchWithTiles(
  tiles: Tile[],
  loadsTileLinkedMedia: boolean = true,
): Promise<ModLaunch> {
  const inputs = await loadInputs(SAMPLE_LINK);
  const modTiles: ModTiles = { ...readModTiles(inputs), tiles };
  const grants = grantModPermissions(inputs.mod, APP_ORIGIN, []);
  const launch = buildModLaunch(
    inputs.mod,
    inputs.link,
    modTiles,
    grants,
    loadsTileLinkedMedia,
  );
  return launch;
}

function buildLaunchTile(
  name: string,
  metadata: Tile["metadata"],
  body: string,
): Tile {
  const tile: Tile = {
    source: `https://tiles.example.net/books/${name}.md`,
    metadata,
    body,
    types: [],
  };
  return tile;
}

describe("Tile bodies at launch", function describeLaunchTileBodies(): void {
  it("holds the player addresses of a body iframe and of a metadata page link", async function collectsPlayerAddresses(): Promise<void> {
    const launch = await launchWithTiles([
      buildLaunchTile(
        "map",
        { title: "Map" },
        '<iframe src="https://maps.example.net/embed?id=7"></iframe>',
      ),
      buildLaunchTile(
        "film",
        {
          title: "Film",
          video: "https://www.youtube.com/watch?v=aqz-KE-bpKQ",
          homepage: "https://example.org/about",
        },
        "",
      ),
    ]);

    expect([...launch.tileBodies.playerAddresses.keys()]).toEqual([
      "https://maps.example.net/embed?id=7",
      "https://www.youtube.com/watch?v=aqz-KE-bpKQ",
    ]);
  });

  it("allows the media of the bodies in the policy", async function allowsBodyMedia(): Promise<void> {
    const launch = await launchWithTiles([
      buildLaunchTile(
        "still",
        { title: "Still" },
        "![Still](https://media.example.net/body.jpg)",
      ),
    ]);

    expect(readDirective(launch.policy, "img-src")).toContain(
      "https://media.example.net/body.jpg",
    );
  });

  it("reports the iframes a body leaves out with the tile links", async function reportsLeftOutIframes(): Promise<void> {
    const tile = buildLaunchTile(
      "router",
      { title: "Router" },
      '<iframe src="https://192.168.1.1/"></iframe>',
    );

    const launch = await launchWithTiles([tile]);
    const offLaunch = await launchWithTiles([tile], false);

    expect(launch.tileLinks?.issues).toEqual([
      {
        level: "warning",
        source: tile.source,
        message:
          "Not loading https://192.168.1.1/: tiles from other sites cannot link addresses on your computer or network.",
      },
    ]);
    expect(offLaunch.tileLinks).toBeNull();
    expect(offLaunch.tileBodies.playerAddresses.size).toBe(0);
  });

  it("skips the collection for bodies without HTML, images or addresses", async function skipsPlainBodies(): Promise<void> {
    const plainTile = buildLaunchTile("plain", { title: "Plain" }, "# Notes");
    const imageTile = buildLaunchTile(
      "image",
      { title: "Image" },
      "![A](./a.jpg)",
    );

    const launch = await launchWithTiles([plainTile, imageTile]);

    expect([...launch.tileBodies.renderedBodies.keys()]).toEqual([
      imageTile.source,
    ]);
    expect([...launch.tileBodies.tiles.keys()]).toEqual([
      plainTile.source,
      imageTile.source,
    ]);
  });
});
