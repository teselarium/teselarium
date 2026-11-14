import { describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import {
  buildMethodContext,
  catchMethodError,
} from "../../../test/method_contexts.ts";
import { APP_BASE_URL } from "../../../test/sample_files.ts";
import { TEST_NPM_HOST } from "../../../test/sample_mods.ts";
import { readRequestedUrl } from "../../../test/test_files.ts";
import { SHIPPED_LIBRARY_NAMES } from "../../mod/index.ts";
import type { LoadedLibrary } from "../../mod/index.ts";
import { createLibraryFileCache } from "./library_files.ts";
import type { LibraryFileCache } from "./library_files.ts";
import {
  buildLibsMethods,
  LIBS_METHODS,
  SHIPPED_LIBRARIES,
} from "./libs_methods.ts";
import type { ShippedLibrary } from "./libs_methods.ts";
import { INVALID_PARAMS, LOAD_FAILED } from "./mod_messages.ts";
import type { ModMethodContext, ModMethodTable } from "./mod_methods.ts";

/** The answer of `libs.load` the engine sends to the frame loader. */
interface LoadedLibraryCode {
  name: string;
  version: string;
  code: string;
}

function loadLibrary(
  methods: ModMethodTable,
  params: object,
): Promise<unknown> {
  return methods["libs.load"](buildMethodContext([]), params as never);
}

function loadShippedLibrary(params: object): Promise<unknown> {
  return loadLibrary(LIBS_METHODS, params);
}

function loadFakeCode(): Promise<string> {
  return Promise.resolve("globalThis.fake = {};");
}

function failFakeCode(): Promise<string> {
  return Promise.reject(new Error("the chunk could not be fetched"));
}

/** A library table with one library, `fake` at major version `2`, whose code loader is a spy. */
function buildFakeLibraries(loadCode: () => Promise<string>): {
  libraries: Record<string, ShippedLibrary>;
  loadCodeSpy: ReturnType<typeof vi.fn<() => Promise<string>>>;
} {
  const loadCodeSpy = vi.fn<() => Promise<string>>(loadCode);
  const libraries: Record<string, ShippedLibrary> = {
    fake: { major: "2", version: "2.4.1", loadCode: loadCodeSpy },
  };
  const fakeLibraries = { libraries, loadCodeSpy };
  return fakeLibraries;
}

describe("SHIPPED_LIBRARIES", function describeShippedLibraries(): void {
  it("ships mermaid at major version 12", function shipsMermaid(): void {
    expect(Object.keys(SHIPPED_LIBRARIES)).toEqual(["mermaid"]);
    expect(SHIPPED_LIBRARIES.mermaid.major).toBe("12");
    expect(SHIPPED_LIBRARIES.mermaid.version).toMatch(/^12\.\d+\.\d+$/);
  });

  it("has the names a mod file cannot declare", function matchesReservedNames(): void {
    expect(Object.keys(SHIPPED_LIBRARIES)).toEqual(SHIPPED_LIBRARY_NAMES);
  });
});

describe("libs.load", function describeLibsLoad(): void {
  it("Load mermaid", async function loadsMermaid(): Promise<void> {
    const result = (await loadShippedLibrary({
      name: "mermaid",
      version: "12",
    })) as LoadedLibraryCode;

    expect(result.name).toBe("mermaid");
    expect(result.version).toBe(SHIPPED_LIBRARIES.mermaid.version);
    expect(result.version).toMatch(/^12\./);
    expect(result.code).toContain("mermaid");
    expect(result.code.length).toBeGreaterThan(1_000_000);
  });

  it("Unknown library", async function rejectsUnknownLibrary(): Promise<void> {
    const error = await catchMethodError(
      loadShippedLibrary.bind(undefined, { name: "katex", version: "0" }),
    );

    expect(error.code).toBe(INVALID_PARAMS);
    expect(error.message).toBe(
      'libs.load: the app has no library "katex" (it has mermaid), and the mod declares none of that name',
    );
  });

  it("Other major version", async function rejectsOtherMajor(): Promise<void> {
    const error = await catchMethodError(
      loadShippedLibrary.bind(undefined, { name: "mermaid", version: "11" }),
    );

    expect(error.code).toBe(INVALID_PARAMS);
    expect(error.message).toBe(
      'libs.load: the app has mermaid 12, not mermaid "11"',
    );
  });

  it("rejects a full version in place of a major version", async function rejectsFullVersion(): Promise<void> {
    const error = await catchMethodError(
      loadShippedLibrary.bind(undefined, {
        name: "mermaid",
        version: "12.0.0",
      }),
    );

    expect(error.code).toBe(INVALID_PARAMS);
    expect(error.message).toBe(
      'libs.load: the app has mermaid 12, not mermaid "12.0.0"',
    );
  });

  it("rejects a version that is not a string", async function rejectsNumberVersion(): Promise<void> {
    for (const version of [12, undefined, null, ["12"]]) {
      const error = await catchMethodError(
        loadShippedLibrary.bind(undefined, { name: "mermaid", version }),
      );

      expect(error.code).toBe(INVALID_PARAMS);
      expect(error.message).toBe(
        'libs.load: "version" must be a string naming a major version, and the app has mermaid 12',
      );
    }
  });

  it("rejects a name that is not a string", async function rejectsNumberName(): Promise<void> {
    const error = await catchMethodError(
      loadShippedLibrary.bind(undefined, { name: 3, version: "12" }),
    );

    expect(error.code).toBe(INVALID_PARAMS);
    expect(error.message).toBe('libs.load: "name" must be a non-empty string');
  });

  it("does not load the code of a rejected request", async function loadsNothingOnError(): Promise<void> {
    const { libraries, loadCodeSpy } = buildFakeLibraries(loadFakeCode);
    const methods = buildLibsMethods(libraries, createLibraryFileCache());

    await catchMethodError(
      loadLibrary.bind(undefined, methods, { name: "fake", version: "1" }),
    );

    expect(loadCodeSpy).not.toHaveBeenCalled();
  });

  it("loads the code once for two requests", async function loadsCodeOnce(): Promise<void> {
    const { libraries, loadCodeSpy } = buildFakeLibraries(loadFakeCode);
    const methods = buildLibsMethods(libraries, createLibraryFileCache());
    const params = { name: "fake", version: "2" };

    const results = await Promise.all([
      loadLibrary(methods, params),
      loadLibrary(methods, params),
    ]);
    const laterResult = await loadLibrary(methods, params);

    expect(loadCodeSpy).toHaveBeenCalledOnce();
    expect(results[0]).toEqual({
      name: "fake",
      version: "2.4.1",
      code: "globalThis.fake = {};",
    });
    expect(results[1]).toEqual(results[0]);
    expect(laterResult).toEqual(results[0]);
  });

  it("loads the code again after a failed load", async function retriesFailedLoad(): Promise<void> {
    const { libraries, loadCodeSpy } = buildFakeLibraries(failFakeCode);
    const methods = buildLibsMethods(libraries, createLibraryFileCache());
    const params = { name: "fake", version: "2" };

    await expect(loadLibrary(methods, params)).rejects.toThrow(
      "the chunk could not be fetched",
    );
    loadCodeSpy.mockImplementation(loadFakeCode);
    const result = await loadLibrary(methods, params);

    expect(loadCodeSpy).toHaveBeenCalledTimes(2);
    expect(result).toEqual({
      name: "fake",
      version: "2.4.1",
      code: "globalThis.fake = {};",
    });
  });
});

const LEAFLET_SCRIPT = `${TEST_NPM_HOST}leaflet@1.9.4/dist/leaflet.js`;
const LEAFLET_STYLE = `${TEST_NPM_HOST}leaflet@1.9.4/dist/leaflet.css`;
const WORLD_ATLAS_DATA = `${TEST_NPM_HOST}world-atlas@2.0.2/countries-110m.json`;
const HELPER_SCRIPT = `${APP_BASE_URL}default_mods/mod_explorer/vendor/helper.js`;
const MISSING_VERSION_SCRIPT = `${TEST_NPM_HOST}leaflet@9.9.9/dist/leaflet.js`;
const MISSING_VERSION_TEXT =
  "Couldn't find the requested release version 9.9.9.";

/** What the test npm host and the mod's site answer for a file. */
interface HostFile {
  status: number;
  statusText: string;
  contentType: string;
  text: string;
}

function buildFoundFile(text: string): HostFile {
  const file: HostFile = {
    status: 200,
    statusText: "OK",
    contentType: "application/javascript",
    text,
  };
  return file;
}

function buildMissingFile(contentType: string, text: string): HostFile {
  const file: HostFile = {
    status: 404,
    statusText: "Not Found",
    contentType,
    text,
  };
  return file;
}

/** The files of the test host, by address. Others answer 404 with no plain text. */
const HOST_FILES = new Map<string, HostFile>([
  [LEAFLET_SCRIPT, buildFoundFile("globalThis.L = { map() {} };")],
  [LEAFLET_STYLE, buildFoundFile(".leaflet-container { overflow: hidden; }")],
  [WORLD_ATLAS_DATA, buildFoundFile('{"type":"Topology"}')],
  [HELPER_SCRIPT, buildFoundFile("globalThis.helper = {};")],
  [
    MISSING_VERSION_SCRIPT,
    buildMissingFile("text/plain; charset=utf-8", MISSING_VERSION_TEXT),
  ],
]);

const UNKNOWN_FILE = buildMissingFile("text/html", "<h1>Not Found</h1>");

function answerHostFile(input: RequestInfo | URL): Promise<Response> {
  const file = HOST_FILES.get(readRequestedUrl(input)) ?? UNKNOWN_FILE;
  const response = new Response(file.text, {
    status: file.status,
    statusText: file.statusText,
    headers: { "content-type": file.contentType },
  });
  return Promise.resolve(response);
}

/** Answers 404 with plain text longer than a library error quotes. */
function answerLongPlainText(): Promise<Response> {
  const response = new Response("x".repeat(201), {
    status: 404,
    headers: { "content-type": "text/plain" },
  });
  return Promise.resolve(response);
}

function failHostRequest(): Promise<Response> {
  return Promise.reject(new TypeError("Failed to fetch"));
}

const LEAFLET: LoadedLibrary = {
  name: "leaflet",
  package: "leaflet",
  version: "1.9.4",
  files: [
    { path: "dist/leaflet.js", source: LEAFLET_SCRIPT, kind: "script" },
    { path: "dist/leaflet.css", source: LEAFLET_STYLE, kind: "style" },
  ],
};

const WORLD_ATLAS: LoadedLibrary = {
  name: "world_atlas",
  package: "world-atlas",
  version: "2.0.2",
  files: [
    { path: "countries-110m.json", source: WORLD_ATLAS_DATA, kind: "data" },
  ],
};

const HELPER: LoadedLibrary = {
  name: "helper",
  package: null,
  version: null,
  files: [
    { path: "./vendor/helper.js", source: HELPER_SCRIPT, kind: "script" },
  ],
};

const MISSING_LEAFLET: LoadedLibrary = {
  name: "leaflet",
  package: "leaflet",
  version: "9.9.9",
  files: [
    {
      path: "dist/leaflet.js",
      source: MISSING_VERSION_SCRIPT,
      kind: "script",
    },
  ],
};

/** A requesting mod that declares `libraries`, whose requests go to a `fetch` spy on the test host. */
function buildDeclaringContext(
  libraries: LoadedLibrary[],
  fetchSpy: Mock<typeof fetch>,
): ModMethodContext {
  const context = buildMethodContext([]);
  context.mod.libraries = structuredClone(libraries);
  context.fetchOptions = { ...context.fetchOptions, fetch: fetchSpy };
  return context;
}

function createHostFetch(): Mock<typeof fetch> {
  const fetchSpy = vi.fn<typeof fetch>(answerHostFile);
  return fetchSpy;
}

/** Declared-library methods with a cache of their own, so tests never share fetched files. */
function buildDeclaredMethods(
  cache: LibraryFileCache = createLibraryFileCache(),
): ModMethodTable {
  return buildLibsMethods(SHIPPED_LIBRARIES, cache);
}

function sendLoad(
  methods: ModMethodTable,
  context: ModMethodContext,
  params: object,
): Promise<unknown> {
  return methods["libs.load"](context, params as never);
}

function listFetchedUrls(fetchSpy: Mock<typeof fetch>): string[] {
  const urls: string[] = [];
  for (const call of fetchSpy.mock.calls) {
    urls.push(readRequestedUrl(call[0]));
  }
  return urls;
}

describe("libs.load of a declared library", function describeDeclared(): void {
  it("Load a declared npm library", async function loadsNpmLibrary(): Promise<void> {
    const fetchSpy = createHostFetch();
    const context = buildDeclaringContext([LEAFLET], fetchSpy);

    const result = await sendLoad(buildDeclaredMethods(), context, {
      name: "leaflet",
    });

    expect(result).toEqual({
      name: "leaflet",
      version: "1.9.4",
      files: [
        {
          path: "dist/leaflet.js",
          kind: "script",
          text: "globalThis.L = { map() {} };",
        },
        {
          path: "dist/leaflet.css",
          kind: "style",
          text: ".leaflet-container { overflow: hidden; }",
        },
      ],
    });
    expect(listFetchedUrls(fetchSpy)).toEqual([LEAFLET_SCRIPT, LEAFLET_STYLE]);
  });

  it("Data file", async function loadsDataFile(): Promise<void> {
    const context = buildDeclaringContext([WORLD_ATLAS], createHostFetch());

    const result = await sendLoad(buildDeclaredMethods(), context, {
      name: "world_atlas",
    });

    expect(result).toEqual({
      name: "world_atlas",
      version: "2.0.2",
      files: [
        {
          path: "countries-110m.json",
          kind: "data",
          text: '{"type":"Topology"}',
        },
      ],
    });
  });

  it("Files next to the mod", async function loadsLocalFiles(): Promise<void> {
    const fetchSpy = createHostFetch();
    const context = buildDeclaringContext([HELPER], fetchSpy);

    const result = await sendLoad(buildDeclaredMethods(), context, {
      name: "helper",
    });

    expect(listFetchedUrls(fetchSpy)).toEqual([HELPER_SCRIPT]);
    expect(result).toEqual({
      name: "helper",
      version: null,
      files: [
        {
          path: "./vendor/helper.js",
          kind: "script",
          text: "globalThis.helper = {};",
        },
      ],
    });
  });

  it("Scripts run in order", async function keepsFileOrder(): Promise<void> {
    const reversed: LoadedLibrary = {
      ...LEAFLET,
      files: [LEAFLET.files[1], LEAFLET.files[0]],
    };
    const context = buildDeclaringContext([reversed], createHostFetch());

    const result = (await sendLoad(buildDeclaredMethods(), context, {
      name: "leaflet",
    })) as { files: { path: string }[] };

    expect(result.files[0].path).toBe("dist/leaflet.css");
    expect(result.files[1].path).toBe("dist/leaflet.js");
  });

  it("answers a shipped library as before for a mod that declares libraries", async function keepsShippedAnswer(): Promise<void> {
    const { libraries } = buildFakeLibraries(loadFakeCode);
    const methods = buildLibsMethods(libraries, createLibraryFileCache());
    const context = buildDeclaringContext([LEAFLET], createHostFetch());

    const result = await sendLoad(methods, context, {
      name: "fake",
      version: "2",
    });

    expect(result).toEqual({
      name: "fake",
      version: "2.4.1",
      code: "globalThis.fake = {};",
    });
  });
});

describe("Version of a declared library", function describeDeclaredVersion(): void {
  it("Declared version", async function acceptsDeclaredVersion(): Promise<void> {
    const context = buildDeclaringContext([LEAFLET], createHostFetch());

    const result = (await sendLoad(buildDeclaredMethods(), context, {
      name: "leaflet",
      version: "1.9.4",
    })) as { version: string };

    expect(result.version).toBe("1.9.4");
  });

  it("accepts a null version", async function acceptsNullVersion(): Promise<void> {
    const context = buildDeclaringContext([LEAFLET, HELPER], createHostFetch());
    const methods = buildDeclaredMethods();

    const leaflet = (await sendLoad(methods, context, {
      name: "leaflet",
      version: null,
    })) as { version: string };
    const helper = (await sendLoad(methods, context, {
      name: "helper",
      version: null,
    })) as { version: string | null };

    expect(leaflet.version).toBe("1.9.4");
    expect(helper.version).toBeNull();
  });

  it("Other version", async function rejectsOtherVersion(): Promise<void> {
    const fetchSpy = createHostFetch();
    const context = buildDeclaringContext([LEAFLET], fetchSpy);

    const error = await catchMethodError(
      sendLoad.bind(undefined, buildDeclaredMethods(), context, {
        name: "leaflet",
        version: "1",
      }),
    );

    expect(error.code).toBe(INVALID_PARAMS);
    expect(error.message).toBe(
      'libs.load: the mod declares leaflet 1.9.4, not leaflet "1"',
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejects a version that is not a string", async function rejectsNumberVersion(): Promise<void> {
    const context = buildDeclaringContext([LEAFLET], createHostFetch());

    const error = await catchMethodError(
      sendLoad.bind(undefined, buildDeclaredMethods(), context, {
        name: "leaflet",
        version: 1.9,
      }),
    );

    expect(error.code).toBe(INVALID_PARAMS);
    expect(error.message).toBe(
      "libs.load: the mod declares leaflet 1.9.4, not leaflet 1.9",
    );
  });

  it("rejects a version of a library without npm", async function rejectsLocalVersion(): Promise<void> {
    const context = buildDeclaringContext([HELPER], createHostFetch());

    const error = await catchMethodError(
      sendLoad.bind(undefined, buildDeclaredMethods(), context, {
        name: "helper",
        version: "1.0.0",
      }),
    );

    expect(error.code).toBe(INVALID_PARAMS);
    expect(error.message).toBe(
      'libs.load: the library "helper" has no npm version, so "version" must be absent or null, not "1.0.0"',
    );
  });
});

describe("Declared files are fetched once per page and only when needed", function describeFetchOnce(): void {
  it("Not downloaded before a request", async function fetchesOnlyRequested(): Promise<void> {
    const fetchSpy = createHostFetch();
    const context = buildDeclaringContext([LEAFLET, HELPER], fetchSpy);

    await sendLoad(buildDeclaredMethods(), context, { name: "helper" });

    expect(listFetchedUrls(fetchSpy)).toEqual([HELPER_SCRIPT]);
  });

  it("Two mods, one download", async function sharesFiles(): Promise<void> {
    const firstFetch = createHostFetch();
    const secondFetch = createHostFetch();
    const firstContext = buildDeclaringContext([LEAFLET], firstFetch);
    const secondContext = buildDeclaringContext([LEAFLET], secondFetch);
    const methods = buildDeclaredMethods();

    const results = await Promise.all([
      sendLoad(methods, firstContext, { name: "leaflet" }),
      sendLoad(methods, secondContext, { name: "leaflet", version: "1.9.4" }),
    ]);
    const laterResult = await sendLoad(methods, firstContext, {
      name: "leaflet",
    });

    expect(listFetchedUrls(firstFetch)).toEqual([
      LEAFLET_SCRIPT,
      LEAFLET_STYLE,
    ]);
    expect(secondFetch).not.toHaveBeenCalled();
    expect(results[1]).toEqual(results[0]);
    expect(laterResult).toEqual(results[0]);
  });

  it("shares one file between two libraries that declare it", async function sharesFileAddress(): Promise<void> {
    const fetchSpy = createHostFetch();
    const scriptOnly: LoadedLibrary = {
      ...LEAFLET,
      name: "leaflet_script",
      files: [LEAFLET.files[0]],
    };
    const context = buildDeclaringContext([LEAFLET, scriptOnly], fetchSpy);
    const methods = buildDeclaredMethods();

    await sendLoad(methods, context, { name: "leaflet" });
    await sendLoad(methods, context, { name: "leaflet_script" });

    expect(listFetchedUrls(fetchSpy)).toEqual([LEAFLET_SCRIPT, LEAFLET_STYLE]);
  });
});

describe("Declared files that cannot be fetched", function describeFetchFailures(): void {
  it("Version that does not exist", async function rejectsMissingVersion(): Promise<void> {
    const context = buildDeclaringContext([MISSING_LEAFLET], createHostFetch());

    const error = await catchMethodError(
      sendLoad.bind(undefined, buildDeclaredMethods(), context, {
        name: "leaflet",
      }),
    );

    expect(error.code).toBe(LOAD_FAILED);
    expect(error.message).toBe(
      `libs.load: the library "leaflet" could not be loaded: Cannot load file "${MISSING_VERSION_SCRIPT}": HTTP 404 Not Found: ${MISSING_VERSION_TEXT}`,
    );
  });

  it("leaves out an answer that is not short plain text", async function skipsOtherAnswers(): Promise<void> {
    const missingStyle: LoadedLibrary = {
      ...LEAFLET,
      files: [
        LEAFLET.files[0],
        {
          path: "dist/missing.css",
          source: `${TEST_NPM_HOST}leaflet@1.9.4/dist/missing.css`,
          kind: "style",
        },
      ],
    };
    const context = buildDeclaringContext([missingStyle], createHostFetch());

    const error = await catchMethodError(
      sendLoad.bind(undefined, buildDeclaredMethods(), context, {
        name: "leaflet",
      }),
    );

    expect(error.code).toBe(LOAD_FAILED);
    expect(error.message).toBe(
      `libs.load: the library "leaflet" could not be loaded: Cannot load file "${TEST_NPM_HOST}leaflet@1.9.4/dist/missing.css": HTTP 404 Not Found`,
    );
  });

  it("leaves out a plain text answer longer than 200 characters", async function skipsLongText(): Promise<void> {
    const fetchSpy = vi.fn<typeof fetch>(answerLongPlainText);
    const context = buildDeclaringContext([HELPER], fetchSpy);

    const error = await catchMethodError(
      sendLoad.bind(undefined, buildDeclaredMethods(), context, {
        name: "helper",
      }),
    );

    expect(error.message).toBe(
      `libs.load: the library "helper" could not be loaded: Cannot load file "${HELPER_SCRIPT}": HTTP 404`,
    );
  });

  it("Later request after a failure", async function retriesAfterFailure(): Promise<void> {
    const fetchSpy = vi.fn<typeof fetch>(failHostRequest);
    const context = buildDeclaringContext([LEAFLET], fetchSpy);
    const methods = buildDeclaredMethods();

    const error = await catchMethodError(
      sendLoad.bind(undefined, methods, context, { name: "leaflet" }),
    );
    fetchSpy.mockImplementation(answerHostFile);
    const result = (await sendLoad(methods, context, {
      name: "leaflet",
    })) as { name: string };

    expect(error.code).toBe(LOAD_FAILED);
    expect(error.message).toBe(
      `libs.load: the library "leaflet" could not be loaded: Cannot load file "${LEAFLET_SCRIPT}": the request failed: Failed to fetch`,
    );
    expect(result.name).toBe("leaflet");
    expect(fetchSpy).toHaveBeenCalledTimes(4);
  });

  it("fetches again only the file that failed", async function keepsFetchedFiles(): Promise<void> {
    const fetchSpy = createHostFetch();
    fetchSpy.mockImplementationOnce(answerHostFile);
    fetchSpy.mockImplementationOnce(failHostRequest);
    const context = buildDeclaringContext([LEAFLET], fetchSpy);
    const methods = buildDeclaredMethods();

    await catchMethodError(
      sendLoad.bind(undefined, methods, context, { name: "leaflet" }),
    );
    await sendLoad(methods, context, { name: "leaflet" });

    expect(listFetchedUrls(fetchSpy)).toEqual([
      LEAFLET_SCRIPT,
      LEAFLET_STYLE,
      LEAFLET_STYLE,
    ]);
  });
});

describe("Unknown libraries and versions", function describeUnknownLibraries(): void {
  it("Unknown library of a mod that declares libraries", async function rejectsUndeclared(): Promise<void> {
    const fetchSpy = createHostFetch();
    const context = buildDeclaringContext([LEAFLET, HELPER], fetchSpy);

    const error = await catchMethodError(
      sendLoad.bind(undefined, buildDeclaredMethods(), context, {
        name: "katex",
        version: "0",
      }),
    );

    expect(error.code).toBe(INVALID_PARAMS);
    expect(error.message).toBe(
      'libs.load: the app has no library "katex" (it has mermaid), and the mod declares none of that name (it declares leaflet, helper)',
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("Library declared by another mod", async function rejectsOtherModLibrary(): Promise<void> {
    const fetchSpy = createHostFetch();
    const declaringContext = buildDeclaringContext([LEAFLET], fetchSpy);
    const otherContext = buildDeclaringContext([], fetchSpy);
    const methods = buildDeclaredMethods();

    await sendLoad(methods, declaringContext, { name: "leaflet" });
    const error = await catchMethodError(
      sendLoad.bind(undefined, methods, otherContext, { name: "leaflet" }),
    );

    expect(error.code).toBe(INVALID_PARAMS);
    expect(error.message).toContain('the app has no library "leaflet"');
    expect(error.message).toContain("the mod declares none of that name");
  });
});
