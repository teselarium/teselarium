import { afterEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import {
  fetchFixture,
  readFixtureText,
  FIXTURES_BASE_URL,
} from "../../test/sample_files.ts";
import {
  fetchTestFile,
  readRequestedUrl,
  testTexts,
} from "../../test/test_files.ts";
import { FileFetchError, YamlParseError } from "../files/index.ts";
import * as modModule from "./index.ts";
import {
  loadMod,
  loadModCode,
  loadModFile,
  loadModTestCode,
  ModFormatError,
} from "./index.ts";
import type { LoadedMod, ModFile } from "./index.ts";

const SAMPLE_MOD_SOURCE = `${FIXTURES_BASE_URL}mods/book_list/mod_conf.yaml`;
const SAMPLE_ENTRYPOINT = `${FIXTURES_BASE_URL}mods/book_list/main.js`;
const SAMPLE_COLLECTION = `${FIXTURES_BASE_URL}tiles/books_collection.yaml`;
const BROKEN_MOD_SOURCE = "https://example.org/mods/broken/mod_conf.yaml";
const BROKEN_ENTRYPOINT = "https://example.org/mods/broken/main.js";
const MISSING_MOD_SOURCE = "https://example.org/mods/missing/mod_conf.yaml";
const CLOCK_MOD_SOURCE = "https://example.org/mods/clock/mod_conf.yaml";
const CLOCK_ENTRYPOINT = "https://example.org/mods/clock/main.js";
const CLOCK_TEST_SOURCE = "https://example.org/mods/clock/test.js";

const MINIMAL_MOD_TEXT = [
  "mod:",
  '  name: "minimal"',
  '  version: "0.1.0"',
  '  entrypoint: "./main.js"',
  '  author: "Alice"',
].join("\n");

const CLOCK_MOD_TEXT = [
  "mod:",
  '  name: "clock"',
  '  version: "0.1.0"',
  '  entrypoint: "./main.js"',
].join("\n");

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

function catchLoadError(
  loading: Promise<LoadedMod | ModFile>,
): Promise<unknown> {
  return loading.then(failOnLoadedMod, returnLoadError);
}

function failOnLoadedMod(mod: LoadedMod | ModFile): never {
  throw new Error(`Expected loading "${mod.source}" to fail, but it passed`);
}

function failOnTestCode(testCode: string): never {
  throw new Error(
    `Expected loading the test file to fail, but got "${testCode}"`,
  );
}

function returnLoadError(error: unknown): unknown {
  return error;
}

describe("loadMod", function describeLoadMod(): void {
  it("Load the sample book list mod", async function loadsSampleMod(): Promise<void> {
    const mod = await loadMod(SAMPLE_MOD_SOURCE, { fetch: fetchFixture });

    expect(mod.source).toBe(SAMPLE_MOD_SOURCE);
    expect(mod.name).toBe("book_list");
    expect(mod.title).toBe("Book List");
    expect(mod.version).toBe("1.0.0");
    expect(mod.description).toBe(
      "A very simple list of books with their covers.",
    );
    expect(mod.code).toBe(readFixtureText("mods/book_list/main.js"));
  });

  it("Relative mod path with a base URL", async function loadsRelativePath(): Promise<void> {
    const testFetch = createTestFetch();

    const mod = await loadMod("./mods/book_list/mod_conf.yaml", {
      baseUrl: FIXTURES_BASE_URL,
      fetch: testFetch,
    });

    expect(listRequestedUrls(testFetch)[0]).toBe(SAMPLE_MOD_SOURCE);
    expect(mod.source).toBe(SAMPLE_MOD_SOURCE);
  });

  it("loads a default mod name from the default mods folder", async function loadsDefaultName(): Promise<void> {
    const mod = await loadModFile("book_list", {
      defaultModsFolder: `${FIXTURES_BASE_URL}mods/`,
      fetch: fetchFixture,
    });

    expect(mod.source).toBe(SAMPLE_MOD_SOURCE);
  });

  it("Entrypoint next to the mod file", async function resolvesEntrypoint(): Promise<void> {
    const testFetch = createTestFetch();

    const mod = await loadMod(SAMPLE_MOD_SOURCE, { fetch: testFetch });

    expect(listRequestedUrls(testFetch)).toEqual([
      SAMPLE_MOD_SOURCE,
      SAMPLE_ENTRYPOINT,
    ]);
    expect(mod.entrypoint).toBe(SAMPLE_ENTRYPOINT);
  });

  it("Tile type outside the mod folder", async function resolvesTypePath(): Promise<void> {
    const mod = await loadMod(SAMPLE_MOD_SOURCE, { fetch: fetchFixture });

    expect(mod.typeSource).toBe(`${FIXTURES_BASE_URL}types/book.md`);
  });

  it("Sample collection outside the mod folder", async function resolvesSampleCollection(): Promise<void> {
    const testFetch = createTestFetch();

    const mod = await loadMod(SAMPLE_MOD_SOURCE, { fetch: testFetch });

    expect(mod.sampleCollection).toBe(SAMPLE_COLLECTION);
    expect(listRequestedUrls(testFetch)).not.toContain(SAMPLE_COLLECTION);
  });

  it("Test file next to the mod file", async function resolvesTestPath(): Promise<void> {
    testTexts.set(
      CLOCK_MOD_SOURCE,
      `${CLOCK_MOD_TEXT}\n  test_path: "./test.js"`,
    );
    testTexts.set(CLOCK_ENTRYPOINT, "export default function mount() {}");
    const testFetch = createTestFetch();

    const mod = await loadMod(CLOCK_MOD_SOURCE, { fetch: testFetch });

    expect(mod.testSource).toBe(CLOCK_TEST_SOURCE);
    expect(listRequestedUrls(testFetch)).toEqual([
      CLOCK_MOD_SOURCE,
      CLOCK_ENTRYPOINT,
    ]);
  });

  it("No test file", async function readsNoTestPath(): Promise<void> {
    testTexts.set(BROKEN_MOD_SOURCE, MINIMAL_MOD_TEXT);

    const mod = await loadModFile(BROKEN_MOD_SOURCE, { fetch: fetchTestFile });

    expect(mod.testSource).toBeNull();
  });

  it("Empty test path", async function rejectsEmptyTestPath(): Promise<void> {
    testTexts.set(BROKEN_MOD_SOURCE, `${MINIMAL_MOD_TEXT}\n  test_path: ""`);

    const error = await catchLoadError(
      loadModFile(BROKEN_MOD_SOURCE, { fetch: fetchTestFile }),
    );

    expect(error).toBeInstanceOf(ModFormatError);
    expect((error as ModFormatError).message).toContain(
      '"test_path" must be a non-empty string',
    );
  });

  it("Mod without a tile type", async function readsNoTypePath(): Promise<void> {
    testTexts.set(BROKEN_MOD_SOURCE, MINIMAL_MOD_TEXT);
    testTexts.set(BROKEN_ENTRYPOINT, "export default function mount() {}");

    const mod = await loadMod(BROKEN_MOD_SOURCE, { fetch: fetchTestFile });

    expect(mod.typeSource).toBeNull();
  });

  it("Minimal mod file", async function loadsMinimalMod(): Promise<void> {
    testTexts.set(BROKEN_MOD_SOURCE, MINIMAL_MOD_TEXT);

    const mod = await loadModFile(BROKEN_MOD_SOURCE, { fetch: fetchTestFile });

    expect(mod.title).toBe("minimal");
    expect(mod.description).toBe("");
    expect(mod.typeSource).toBeNull();
    expect(mod.sampleCollection).toBeNull();
    expect(mod.config).toEqual({});
    expect(mod.permissions).toEqual([]);
  });

  it("No theme key", async function loadsDefaultTheme(): Promise<void> {
    testTexts.set(BROKEN_MOD_SOURCE, MINIMAL_MOD_TEXT);
    testTexts.set(BROKEN_ENTRYPOINT, "export default function mount() {}");

    const mod = await loadMod(BROKEN_MOD_SOURCE, { fetch: fetchTestFile });

    expect(mod.theme).toBe("default");
  });

  it("Opt out", async function loadsNoTheme(): Promise<void> {
    testTexts.set(BROKEN_MOD_SOURCE, `${MINIMAL_MOD_TEXT}\n  theme: "none"`);
    testTexts.set(BROKEN_ENTRYPOINT, "export default function mount() {}");

    const mod = await loadMod(BROKEN_MOD_SOURCE, { fetch: fetchTestFile });

    expect(mod.theme).toBe("none");
  });

  it("Unknown keys are ignored", async function ignoresUnknownKeys(): Promise<void> {
    testTexts.set(BROKEN_MOD_SOURCE, MINIMAL_MOD_TEXT);

    const mod = await loadModFile(BROKEN_MOD_SOURCE, { fetch: fetchTestFile });

    expect(mod).not.toHaveProperty("author");
  });

  it("Caret range", async function loadsCaretRange(): Promise<void> {
    const mod = await loadMod(SAMPLE_MOD_SOURCE, { fetch: fetchFixture });

    expect(mod.api).toBe("^0.1.0");
  });

  it("No api key", async function loadsNoRange(): Promise<void> {
    testTexts.set(BROKEN_MOD_SOURCE, MINIMAL_MOD_TEXT);

    const mod = await loadModFile(BROKEN_MOD_SOURCE, { fetch: fetchTestFile });

    expect(mod.api).toBeNull();
  });

  it("Not a range", async function rejectsNonRange(): Promise<void> {
    testTexts.set(BROKEN_MOD_SOURCE, `${MINIMAL_MOD_TEXT}\n  api: "latest"`);

    const error = await catchLoadError(
      loadModFile(BROKEN_MOD_SOURCE, { fetch: fetchTestFile }),
    );

    expect(error).toBeInstanceOf(ModFormatError);
    expect((error as ModFormatError).message).toContain(
      '"api" must be a semver range',
    );
  });

  it("Range written as a number", async function rejectsRangeNumber(): Promise<void> {
    testTexts.set(BROKEN_MOD_SOURCE, `${MINIMAL_MOD_TEXT}\n  api: 0.1`);

    const error = await catchLoadError(
      loadModFile(BROKEN_MOD_SOURCE, { fetch: fetchTestFile }),
    );

    expect(error).toBeInstanceOf(ModFormatError);
    expect((error as ModFormatError).message).toContain(
      '"api" must be a semver range',
    );
  });

  it("Config is kept as plain data", async function keepsConfig(): Promise<void> {
    const mod = await loadMod(SAMPLE_MOD_SOURCE, { fetch: fetchFixture });

    expect(mod.config).toEqual({ show_covers: true });
  });

  it("Sample show permission", async function readsSamplePermission(): Promise<void> {
    const mod = await loadMod(SAMPLE_MOD_SOURCE, { fetch: fetchFixture });

    expect(mod.permissions).toEqual([
      {
        category: "show",
        host: "https://upload.wikimedia.org",
        reason: "Shows the book covers",
      },
    ]);
  });

  it("Invalid YAML", async function rejectsInvalidYaml(): Promise<void> {
    testTexts.set(BROKEN_MOD_SOURCE, "mod: [unclosed");

    const error = await catchLoadError(
      loadMod(BROKEN_MOD_SOURCE, { fetch: fetchTestFile }),
    );

    expect(error).toBeInstanceOf(YamlParseError);
    expect((error as YamlParseError).source).toBe(BROKEN_MOD_SOURCE);
  });

  it("Mod file HTTP 404", async function rejectsMissingModFile(): Promise<void> {
    const error = await catchLoadError(
      loadMod(MISSING_MOD_SOURCE, { fetch: fetchTestFile }),
    );

    expect(error).toBeInstanceOf(FileFetchError);
    expect((error as FileFetchError).source).toBe(MISSING_MOD_SOURCE);
    expect((error as FileFetchError).message).toContain("404");
  });

  it("Entrypoint HTTP 404", async function rejectsMissingEntrypoint(): Promise<void> {
    testTexts.set(BROKEN_MOD_SOURCE, MINIMAL_MOD_TEXT);

    const error = await catchLoadError(
      loadMod(BROKEN_MOD_SOURCE, { fetch: fetchTestFile }),
    );

    expect(error).toBeInstanceOf(FileFetchError);
    expect((error as FileFetchError).source).toBe(BROKEN_ENTRYPOINT);
  });

  it("Failure kinds are told apart", async function tellsFailuresApart(): Promise<void> {
    const wrongFormatSource = "https://example.org/mods/wrong/mod_conf.yaml";
    const invalidYamlSource = "https://example.org/mods/invalid/mod_conf.yaml";
    testTexts.set(wrongFormatSource, 'name: "no mod mapping"');
    testTexts.set(invalidYamlSource, "mod: [unclosed");
    const options = { fetch: fetchTestFile };

    const missingError = await catchLoadError(
      loadMod(MISSING_MOD_SOURCE, options),
    );
    const formatError = await catchLoadError(
      loadMod(wrongFormatSource, options),
    );
    const yamlError = await catchLoadError(loadMod(invalidYamlSource, options));

    expect(missingError).toBeInstanceOf(FileFetchError);
    expect(formatError).toBeInstanceOf(ModFormatError);
    expect((formatError as ModFormatError).source).toBe(wrongFormatSource);
    expect(yamlError).toBeInstanceOf(YamlParseError);
  });

  it("Structured clone of a loaded mod", async function clonesLoadedMod(): Promise<void> {
    const mod = await loadMod(SAMPLE_MOD_SOURCE, { fetch: fetchFixture });

    expect(structuredClone(mod)).toEqual(mod);
  });

  it("Independent loads", async function loadsIndependently(): Promise<void> {
    const firstMod = await loadMod(SAMPLE_MOD_SOURCE, { fetch: fetchFixture });
    const secondMod = await loadMod(SAMPLE_MOD_SOURCE, { fetch: fetchFixture });

    firstMod.config.show_covers = false;

    expect(secondMod.config).toEqual({ show_covers: true });
  });
});

describe("loadModFile", function describeLoadModFile(): void {
  it("does not request the entrypoint", async function skipsEntrypoint(): Promise<void> {
    const testFetch = createTestFetch();

    const modFile = await loadModFile(SAMPLE_MOD_SOURCE, { fetch: testFetch });

    expect(listRequestedUrls(testFetch)).toEqual([SAMPLE_MOD_SOURCE]);
    expect(modFile.entrypoint).toBe(SAMPLE_ENTRYPOINT);
    expect(modFile).not.toHaveProperty("code");
  });
});

describe("loadModCode", function describeLoadModCode(): void {
  it("fetches only the entrypoint of a loaded mod file", async function loadsCode(): Promise<void> {
    const modFile = await loadModFile(SAMPLE_MOD_SOURCE, {
      fetch: fetchFixture,
    });
    const testFetch = createTestFetch();

    const mod = await loadModCode(modFile, { fetch: testFetch });

    expect(listRequestedUrls(testFetch)).toEqual([SAMPLE_ENTRYPOINT]);
    expect(mod.code).toBe(readFixtureText("mods/book_list/main.js"));
  });

  it("Entrypoint HTTP 404", async function rejectsMissingEntrypoint(): Promise<void> {
    testTexts.set(BROKEN_MOD_SOURCE, MINIMAL_MOD_TEXT);
    const modFile = await loadModFile(BROKEN_MOD_SOURCE, {
      fetch: fetchTestFile,
    });

    const error = await catchLoadError(
      loadModCode(modFile, { fetch: fetchTestFile }),
    );

    expect(error).toBeInstanceOf(FileFetchError);
    expect((error as FileFetchError).source).toBe(BROKEN_ENTRYPOINT);
    expect((error as FileFetchError).message).toContain("404");
  });
});

describe("loadModTestCode", function describeLoadModTestCode(): void {
  it("fetches only the test file of a loaded mod file", async function loadsTestCode(): Promise<void> {
    testTexts.set(
      CLOCK_MOD_SOURCE,
      `${CLOCK_MOD_TEXT}\n  test_path: "./test.js"`,
    );
    testTexts.set(CLOCK_TEST_SOURCE, "export default function register() {}");
    const modFile = await loadModFile(CLOCK_MOD_SOURCE, {
      fetch: fetchTestFile,
    });
    const testFetch = createTestFetch();

    const testCode = await loadModTestCode(modFile, { fetch: testFetch });

    expect(listRequestedUrls(testFetch)).toEqual([CLOCK_TEST_SOURCE]);
    expect(testCode).toBe("export default function register() {}");
  });

  it("Test file HTTP 404", async function rejectsMissingTestFile(): Promise<void> {
    testTexts.set(
      CLOCK_MOD_SOURCE,
      `${CLOCK_MOD_TEXT}\n  test_path: "./test.js"`,
    );
    const modFile = await loadModFile(CLOCK_MOD_SOURCE, {
      fetch: fetchTestFile,
    });

    const error = await loadModTestCode(modFile, {
      fetch: fetchTestFile,
    }).then(failOnTestCode, returnLoadError);

    expect(error).toBeInstanceOf(FileFetchError);
    expect((error as FileFetchError).source).toBe(CLOCK_TEST_SOURCE);
    expect((error as FileFetchError).message).toContain("404");
  });
});

describe("mod module entry point", function describeEntryPoint(): void {
  it("exports the public API", function exportsPublicApi(): void {
    expect(Object.keys(modModule).sort()).toEqual([
      "MOD_FILE_KEYS",
      "ModFormatError",
      "PERMISSION_CATEGORIES",
      "loadMod",
      "loadModCode",
      "loadModFile",
      "loadModTestCode",
      "permissionHostCovers",
      "resolveModReference",
    ]);
  });
});
