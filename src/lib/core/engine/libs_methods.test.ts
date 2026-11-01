import { describe, expect, it, vi } from "vitest";
import {
  buildMethodContext,
  catchMethodError,
} from "../../../test/method_contexts.ts";
import {
  buildLibsMethods,
  LIBS_METHODS,
  SHIPPED_LIBRARIES,
} from "./libs_methods.ts";
import type { ShippedLibrary } from "./libs_methods.ts";
import { INVALID_PARAMS } from "./mod_messages.ts";
import type { ModMethodTable } from "./mod_methods.ts";

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
      'libs.load: the app has no library "katex" (it has mermaid)',
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
    const methods = buildLibsMethods(libraries);

    await catchMethodError(
      loadLibrary.bind(undefined, methods, { name: "fake", version: "1" }),
    );

    expect(loadCodeSpy).not.toHaveBeenCalled();
  });

  it("loads the code once for two requests", async function loadsCodeOnce(): Promise<void> {
    const { libraries, loadCodeSpy } = buildFakeLibraries(loadFakeCode);
    const methods = buildLibsMethods(libraries);
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
    const methods = buildLibsMethods(libraries);
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
