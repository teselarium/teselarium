import { afterEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import {
  fetchTestFile,
  readRequestedUrl,
  testTexts,
} from "../../test/test_files.ts";
import { FileFetchError, YamlParseError } from "../files/index.ts";
import * as mosaicModule from "./index.ts";
import { loadMosaicFile, MosaicFormatError } from "./index.ts";
import type { LoadedMosaic, MosaicLoadOptions } from "./index.ts";

const APP_URL = "https://example.org/";
const MOSAIC_URL = "https://example.org/mosaics/nobel_map.yaml";
const MOSAIC_FOLDER_FILE_URL =
  "https://example.org/mosaics/nobel_map/mosaic.yaml";
const DEFAULT_MODS_FOLDER = "https://example.org/default_mods/";

function createTestFetch(): Mock<typeof fetch> {
  const testFetch = vi.fn<typeof fetch>(fetchTestFile);
  return testFetch;
}

function serveTestFile(url: string, text: string): void {
  testTexts.set(url, text);
}

/** Builds a mosaic file from the lines of its `mosaic` mapping. */
function buildMosaicText(mosaicLines: string[]): string {
  const lines = ["mosaic:"];
  for (const mosaicLine of mosaicLines) {
    lines.push(`  ${mosaicLine}`);
  }
  const mosaicText = `${lines.join("\n")}\n`;
  return mosaicText;
}

const MINIMAL_LINES = ['title: "Clock"', 'mod: "./clock"'];

function readRequestedUrls(testFetch: Mock<typeof fetch>): string[] {
  const requestedUrls: string[] = [];
  for (const call of testFetch.mock.calls) {
    requestedUrls.push(readRequestedUrl(call[0]));
  }
  return requestedUrls;
}

function failOnLoadedMosaic(loadedMosaic: LoadedMosaic): never {
  throw new Error(
    `Expected loading "${loadedMosaic.source}" to fail, but it passed`,
  );
}

function returnLoadError(error: unknown): unknown {
  return error;
}

/** Loads a mosaic served at `MOSAIC_URL` with the given lines, expecting the load to fail. */
function loadFailingMosaic(mosaicLines: string[]): Promise<unknown> {
  serveTestFile(MOSAIC_URL, buildMosaicText(mosaicLines));
  const loading = loadMosaicFile(MOSAIC_URL, { fetch: createTestFetch() });
  return loading.then(failOnLoadedMosaic, returnLoadError);
}

function loadServedMosaic(
  mosaicLines: string[],
  options: MosaicLoadOptions = {},
): Promise<LoadedMosaic> {
  serveTestFile(MOSAIC_URL, buildMosaicText(mosaicLines));
  return loadMosaicFile(MOSAIC_URL, { fetch: createTestFetch(), ...options });
}

afterEach(function clearTestTexts(): void {
  testTexts.clear();
});

describe("loadMosaicFile", function describeLoadMosaicFile(): void {
  describe("loading", function describeLoading(): void {
    it("Sample mosaic", async function loadsSampleMosaic(): Promise<void> {
      const testFetch = createTestFetch();
      serveTestFile(
        MOSAIC_URL,
        buildMosaicText([
          'title: "Laureates on the map"',
          'mod: "../mods/country_map"',
          'collection: "../tiles/literature_nobel_laureates"',
        ]),
      );

      const loadedMosaic = await loadMosaicFile("./mosaics/nobel_map.yaml", {
        baseUrl: APP_URL,
        fetch: testFetch,
      });

      expect(loadedMosaic.source).toBe(MOSAIC_URL);
      expect(readRequestedUrls(testFetch)).toEqual([MOSAIC_URL]);
    });
  });

  describe("references", function describeReferences(): void {
    it("Folder", async function loadsFolder(): Promise<void> {
      const testFetch = createTestFetch();
      serveTestFile(MOSAIC_FOLDER_FILE_URL, buildMosaicText(MINIMAL_LINES));

      await loadMosaicFile("./mosaics/nobel_map", {
        baseUrl: APP_URL,
        fetch: testFetch,
      });

      expect(readRequestedUrls(testFetch)).toEqual([MOSAIC_FOLDER_FILE_URL]);
    });

    it("Folder with a trailing slash", async function loadsFolderWithSlash(): Promise<void> {
      const testFetch = createTestFetch();
      serveTestFile(MOSAIC_FOLDER_FILE_URL, buildMosaicText(MINIMAL_LINES));

      await loadMosaicFile("./mosaics/nobel_map/", {
        baseUrl: APP_URL,
        fetch: testFetch,
      });

      expect(readRequestedUrls(testFetch)).toEqual([MOSAIC_FOLDER_FILE_URL]);
    });

    it("File with another name", async function loadsYmlFile(): Promise<void> {
      const testFetch = createTestFetch();
      const ymlUrl = "https://mosaics.example.net/maps/laureates.yml";
      serveTestFile(ymlUrl, buildMosaicText(MINIMAL_LINES));

      await loadMosaicFile(ymlUrl, { fetch: testFetch });

      expect(readRequestedUrls(testFetch)).toEqual([ymlUrl]);
    });

    it("Folder and file", async function sharesSource(): Promise<void> {
      serveTestFile(MOSAIC_FOLDER_FILE_URL, buildMosaicText(MINIMAL_LINES));
      const options: MosaicLoadOptions = {
        baseUrl: APP_URL,
        fetch: createTestFetch(),
      };

      const fromFolder = await loadMosaicFile("./mosaics/nobel_map", options);
      const fromFile = await loadMosaicFile(
        "./mosaics/nobel_map/mosaic.yaml",
        options,
      );

      expect(fromFolder.source).toBe(MOSAIC_FOLDER_FILE_URL);
      expect(fromFile.source).toBe(MOSAIC_FOLDER_FILE_URL);
    });
  });

  describe("format", function describeFormat(): void {
    it("Minimal mosaic", async function loadsMinimalMosaic(): Promise<void> {
      const loadedMosaic = await loadServedMosaic(MINIMAL_LINES);

      expect(loadedMosaic).toEqual({
        source: MOSAIC_URL,
        title: "Clock",
        description: "",
        mod: "https://example.org/mosaics/clock/mod_conf.yaml",
        collection: null,
        config: {},
        aliases: {},
        permissions: [],
      });
    });

    it("Unknown key", async function ignoresUnknownKey(): Promise<void> {
      const loadedMosaic = await loadServedMosaic([
        ...MINIMAL_LINES,
        'layout: "wide"',
      ]);

      expect(loadedMosaic).not.toHaveProperty("layout");
    });

    it("keeps the description and the config", async function readsDescriptionAndConfig(): Promise<void> {
      const loadedMosaic = await loadServedMosaic([
        ...MINIMAL_LINES,
        'description: "Where each laureate was born."',
        "config:",
        "  map:",
        "    zoom: 3",
      ]);

      expect(loadedMosaic.description).toBe("Where each laureate was born.");
      expect(loadedMosaic.config).toEqual({ map: { zoom: 3 } });
    });

    it("A null collection is none", async function readsNullCollection(): Promise<void> {
      const loadedMosaic = await loadServedMosaic([
        ...MINIMAL_LINES,
        "collection: null",
      ]);

      expect(loadedMosaic.collection).toBeNull();
    });
  });

  describe("format errors", function describeFormatErrors(): void {
    it("Missing title", async function rejectsMissingTitle(): Promise<void> {
      const error = await loadFailingMosaic(['mod: "./clock"']);

      expect(error).toBeInstanceOf(MosaicFormatError);
      expect(error).toMatchObject({ source: MOSAIC_URL });
      expect(String(error)).toContain('"title" must be a non-empty string');
    });

    it("Missing mod", async function rejectsMissingMod(): Promise<void> {
      const error = await loadFailingMosaic(['title: "Clock"']);

      expect(error).toBeInstanceOf(MosaicFormatError);
      expect(String(error)).toContain('"mod" must be a non-empty string');
    });

    it("Config that is not a mapping", async function rejectsConfigList(): Promise<void> {
      const error = await loadFailingMosaic([
        ...MINIMAL_LINES,
        "config: [1, 2]",
      ]);

      expect(error).toBeInstanceOf(MosaicFormatError);
      expect(String(error)).toContain('"config" must be a mapping');
    });

    it("Empty collection", async function rejectsEmptyCollection(): Promise<void> {
      const error = await loadFailingMosaic([
        ...MINIMAL_LINES,
        'collection: ""',
      ]);

      expect(error).toBeInstanceOf(MosaicFormatError);
      expect(String(error)).toContain(
        '"collection" must be a non-empty string',
      );
    });

    it("Description that is not a string", async function rejectsNumericDescription(): Promise<void> {
      const error = await loadFailingMosaic([
        ...MINIMAL_LINES,
        "description: 3",
      ]);

      expect(error).toBeInstanceOf(MosaicFormatError);
      expect(String(error)).toContain('"description" must be a string');
    });

    it("No mosaic mapping", async function rejectsMissingMosaic(): Promise<void> {
      serveTestFile(MOSAIC_URL, 'mod:\n  title: "Clock"\n');

      const error = await loadMosaicFile(MOSAIC_URL, {
        fetch: createTestFetch(),
      }).then(failOnLoadedMosaic, returnLoadError);

      expect(error).toBeInstanceOf(MosaicFormatError);
      expect(String(error)).toContain('"mosaic"');
    });
  });

  describe("mod and collection", function describeModAndCollection(): void {
    it("Paths next to the mosaic", async function resolvesAgainstMosaic(): Promise<void> {
      const testFetch = createTestFetch();
      const mosaicUrl = "https://example.org/samples/mosaics/nobel_map.yaml";
      serveTestFile(
        mosaicUrl,
        buildMosaicText([
          'title: "Laureates on the map"',
          'mod: "../mods/country_map"',
          'collection: "../tiles/literature_nobel_laureates"',
        ]),
      );

      const loadedMosaic = await loadMosaicFile(mosaicUrl, {
        baseUrl: "https://elsewhere.example.net/",
        fetch: testFetch,
      });

      expect(loadedMosaic.mod).toBe(
        "https://example.org/samples/mods/country_map/mod_conf.yaml",
      );
      expect(loadedMosaic.collection).toBe(
        "https://example.org/samples/tiles/literature_nobel_laureates/collection.yaml",
      );
    });

    it("Default mod name", async function resolvesDefaultModName(): Promise<void> {
      const loadedMosaic = await loadServedMosaic(
        ['title: "Books"', 'mod: "collection_viewer"'],
        { defaultModsFolder: DEFAULT_MODS_FOLDER },
      );

      expect(loadedMosaic.mod).toBe(
        "https://example.org/default_mods/collection_viewer/mod_conf.yaml",
      );
    });

    it("A default mod name without a default mods folder", async function rejectsDefaultNameWithoutFolder(): Promise<void> {
      const error = await loadFailingMosaic([
        'title: "Books"',
        'mod: "collection_viewer"',
      ]);

      expect(error).toBeInstanceOf(MosaicFormatError);
      expect(error).toMatchObject({ source: MOSAIC_URL });
      expect(String(error)).toContain('"mod" cannot be resolved');
    });
  });

  describe("aliases", function describeAliases(): void {
    it("Aliases of the laureates", async function readsAliases(): Promise<void> {
      const loadedMosaic = await loadServedMosaic([
        ...MINIMAL_LINES,
        "aliases:",
        '  title: ["name"]',
        '  country: ["birth_country"]',
      ]);

      expect(loadedMosaic.aliases).toEqual({
        title: ["name"],
        country: ["birth_country"],
      });
    });

    it("Empty list", async function rejectsEmptyList(): Promise<void> {
      const error = await loadFailingMosaic([
        ...MINIMAL_LINES,
        "aliases:",
        "  title: []",
      ]);

      expect(error).toBeInstanceOf(MosaicFormatError);
      expect(String(error)).toContain("aliases.title");
    });

    it("rejects a list with an empty name", async function rejectsEmptyName(): Promise<void> {
      const error = await loadFailingMosaic([
        ...MINIMAL_LINES,
        "aliases:",
        '  title: [""]',
      ]);

      expect(error).toBeInstanceOf(MosaicFormatError);
      expect(String(error)).toContain("aliases.title");
    });

    it("rejects aliases that are not a mapping", async function rejectsAliasList(): Promise<void> {
      const error = await loadFailingMosaic([
        ...MINIMAL_LINES,
        'aliases: ["name"]',
      ]);

      expect(error).toBeInstanceOf(MosaicFormatError);
      expect(String(error)).toContain('"aliases" must be a mapping');
    });

    it("A name listed twice", async function rejectsNameListedTwice(): Promise<void> {
      const error = await loadFailingMosaic([
        ...MINIMAL_LINES,
        "aliases:",
        '  title: ["name"]',
        '  label: ["name"]',
      ]);

      expect(error).toBeInstanceOf(MosaicFormatError);
      expect(String(error)).toContain('"name"');
    });

    it("A name that is also a field", async function rejectsNameThatIsField(): Promise<void> {
      const error = await loadFailingMosaic([
        ...MINIMAL_LINES,
        "aliases:",
        '  title: ["name"]',
        '  name: ["full_name"]',
      ]);

      expect(error).toBeInstanceOf(MosaicFormatError);
      expect(String(error)).toContain('"name"');
    });
  });

  describe("permissions", function describePermissions(): void {
    it("Cover hosts", async function readsShowLines(): Promise<void> {
      const loadedMosaic = await loadServedMosaic([
        ...MINIMAL_LINES,
        "permissions:",
        "  show:",
        '    - host: "https://covers.openlibrary.org"',
        '      reason: "Shows the book covers"',
        '    - host: "https://*.archive.org"',
        '      reason: "Open Library redirects covers to archive.org"',
      ]);

      expect(loadedMosaic.permissions).toEqual([
        {
          category: "show",
          host: "https://covers.openlibrary.org",
          reason: "Shows the book covers",
        },
        {
          category: "show",
          host: "https://*.archive.org",
          reason: "Open Library redirects covers to archive.org",
        },
      ]);
    });

    it("Connect in a mosaic", async function rejectsConnect(): Promise<void> {
      const error = await loadFailingMosaic([
        ...MINIMAL_LINES,
        "permissions:",
        "  connect:",
        '    - host: "https://api.example.net"',
        '      reason: "Reads the data"',
      ]);

      expect(error).toBeInstanceOf(MosaicFormatError);
      expect(String(error)).toContain(
        "a mosaic can only declare show permissions",
      );
    });

    it("Host with a path", async function rejectsHostWithPath(): Promise<void> {
      const error = await loadFailingMosaic([
        ...MINIMAL_LINES,
        "permissions:",
        "  show:",
        '    - host: "https://images.example.net/covers"',
        '      reason: "Shows the covers"',
      ]);

      expect(error).toBeInstanceOf(MosaicFormatError);
      expect(String(error)).toContain("https://images.example.net/covers");
    });

    it("rejects a line without a reason", async function rejectsMissingReason(): Promise<void> {
      const error = await loadFailingMosaic([
        ...MINIMAL_LINES,
        "permissions:",
        "  show:",
        '    - host: "https://images.example.net"',
      ]);

      expect(error).toBeInstanceOf(MosaicFormatError);
      expect(String(error)).toContain('"reason" must be a non-empty string');
    });
  });

  describe("plain YAML", function describePlainYaml(): void {
    it("Missing mosaic file", async function rejectsMissingFile(): Promise<void> {
      const error = await loadMosaicFile(MOSAIC_URL, {
        fetch: createTestFetch(),
      }).then(failOnLoadedMosaic, returnLoadError);

      expect(error).toBeInstanceOf(FileFetchError);
      expect(error).toMatchObject({ source: MOSAIC_URL });
      expect(String(error)).toContain("404");
    });

    it("Not YAML", async function rejectsInvalidYaml(): Promise<void> {
      serveTestFile(MOSAIC_URL, "mosaic: [\n");

      const error = await loadMosaicFile(MOSAIC_URL, {
        fetch: createTestFetch(),
      }).then(failOnLoadedMosaic, returnLoadError);

      expect(error).toBeInstanceOf(YamlParseError);
      expect(error).toMatchObject({ source: MOSAIC_URL });
    });
  });

  describe("plain data", function describePlainData(): void {
    it("Two loads", async function loadsIndependentMosaics(): Promise<void> {
      const lines = [...MINIMAL_LINES, "config:", "  map:", "    zoom: 3"];

      const firstMosaic = await loadServedMosaic(lines);
      const secondMosaic = await loadServedMosaic(lines);
      firstMosaic.config.map = null;

      expect(secondMosaic.config).toEqual({ map: { zoom: 3 } });
      expect(structuredClone(secondMosaic)).toEqual(secondMosaic);
    });
  });
});

/** The example of "Mosaic file format" in docs/modules/lib/mosaic/README.md. */
const README_MOSAIC_EXAMPLE = [
  "mosaic:",
  '  title: "Laureates on the map"',
  '  description: "Where each laureate was born."',
  '  mod: "../mods/country_map"',
  '  collection: "../tiles/literature_nobel_laureates"',
  "  config:",
  "    map:",
  "      zoom: 3",
  "  aliases:",
  '    title: ["name"]',
  '    country: ["birth_country"]',
  "  permissions:",
  "    show:",
  '      - host: "https://upload.wikimedia.org"',
  '        reason: "Shows the laureates\' portraits"',
  "",
].join("\n");

/** The example of "Mosaic" in docs/opentesela_spec.md, without its comments. */
const SPEC_MOSAIC_EXAMPLE = [
  "mosaic:",
  '  title: "Science Fiction Books Around the World"',
  '  description: "Classic science fiction novels placed on a map by country of origin."',
  '  mod: "../mods/country_markers_map"',
  '  collection: "./science_fiction_books.yaml"',
  "  config:",
  "    map:",
  "      center: [-34.6085, -58.3722]",
  "      zoom: 3",
  "    markers:",
  '      color: "#aa3333"',
  "    popup:",
  "      show_body: true",
  "  aliases:",
  "    title:",
  '      - "name"',
  '      - "book_name"',
  "    country:",
  '      - "origin"',
  '      - "pub_country"',
  "    date:",
  '      - "pub_date"',
  '      - "published"',
  "  permissions:",
  "    show:",
  '      - host: "https://covers.openlibrary.org"',
  '        reason: "Shows the book covers"',
  "",
].join("\n");

describe("mosaic module README", function describeReadme(): void {
  it("loads the example of the mosaic module README", async function loadsReadmeExample(): Promise<void> {
    const mosaicUrl = "https://example.org/samples/mosaics/nobel_map.yaml";
    serveTestFile(mosaicUrl, README_MOSAIC_EXAMPLE);

    const loadedMosaic = await loadMosaicFile(
      "./samples/mosaics/nobel_map.yaml",
      {
        baseUrl: APP_URL,
        fetch: createTestFetch(),
      },
    );

    expect(loadedMosaic).toEqual({
      source: mosaicUrl,
      title: "Laureates on the map",
      description: "Where each laureate was born.",
      mod: "https://example.org/samples/mods/country_map/mod_conf.yaml",
      collection:
        "https://example.org/samples/tiles/literature_nobel_laureates/collection.yaml",
      config: { map: { zoom: 3 } },
      aliases: { title: ["name"], country: ["birth_country"] },
      permissions: [
        {
          category: "show",
          host: "https://upload.wikimedia.org",
          reason: "Shows the laureates' portraits",
        },
      ],
    });
  });
});

describe("format specification", function describeFormatSpecification(): void {
  it("loads the mosaic example of the format specification", async function loadsSpecExample(): Promise<void> {
    serveTestFile(MOSAIC_URL, SPEC_MOSAIC_EXAMPLE);

    const loadedMosaic = await loadMosaicFile(MOSAIC_URL, {
      fetch: createTestFetch(),
    });

    expect(loadedMosaic.mod).toBe(
      "https://example.org/mods/country_markers_map/mod_conf.yaml",
    );
    expect(loadedMosaic.collection).toBe(
      "https://example.org/mosaics/science_fiction_books.yaml",
    );
    expect(Object.keys(loadedMosaic.aliases)).toEqual([
      "title",
      "country",
      "date",
    ]);
    expect(loadedMosaic.permissions).toHaveLength(1);
  });
});

describe("mosaic module entry point", function describeEntryPoint(): void {
  it("exports the public API", function exportsPublicApi(): void {
    expect(Object.keys(mosaicModule).sort()).toEqual([
      "MosaicFormatError",
      "applyMosaicAliases",
      "loadMosaicFile",
      "mergeMosaicConfig",
      "resolveMosaicReference",
    ]);
  });
});
