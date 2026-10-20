import { describe, expect, it } from "vitest";
import { FileFetchError } from "../files/index.ts";
import { resolveModReference } from "./mod_reference.ts";

const APP_URL = "https://example.org/";
const DEFAULT_MODS_FOLDER = "https://example.org/default_mods/";
const SAMPLE_MOD_SOURCE =
  "https://example.org/samples/mods/book_list/mod_conf.yaml";

describe("resolveModReference", function describeResolveModReference(): void {
  it("Default mod name", function resolvesDefaultName(): void {
    const source = resolveModReference("mod_viewer", {
      defaultModsFolder: DEFAULT_MODS_FOLDER,
    });

    expect(source).toBe(
      "https://example.org/default_mods/mod_viewer/mod_conf.yaml",
    );
  });

  it("fails for a default mod name without a default mods folder", function failsWithoutFolder(): void {
    function resolveWithoutFolder(): string {
      return resolveModReference("mod_viewer", { baseUrl: APP_URL });
    }

    expect(resolveWithoutFolder).toThrow(FileFetchError);
    expect(resolveWithoutFolder).toThrow(
      'Cannot load file "mod_viewer": a default mod name needs a default mods folder',
    );
  });

  it("Folder without a trailing slash", function resolvesFolder(): void {
    const source = resolveModReference("./samples/mods/book_list", {
      baseUrl: APP_URL,
    });

    expect(source).toBe(SAMPLE_MOD_SOURCE);
  });

  it("Folder with a trailing slash", function resolvesFolderWithSlash(): void {
    const source = resolveModReference("https://mods.example.net/clock/", {});

    expect(source).toBe("https://mods.example.net/clock/mod_conf.yaml");
  });

  it("Mod file with another name", function resolvesYmlFile(): void {
    const source = resolveModReference(
      "https://mods.example.net/clock/clock.yml",
      {},
    );

    expect(source).toBe("https://mods.example.net/clock/clock.yml");
  });

  it("keeps a .yaml mod file", function resolvesYamlFile(): void {
    const source = resolveModReference(
      "./samples/mods/book_list/mod_conf.yaml",
      { baseUrl: APP_URL },
    );

    expect(source).toBe(SAMPLE_MOD_SOURCE);
  });

  it("Relative path without a slash", function readsNameLikeFolder(): void {
    const source = resolveModReference("Book-List", { baseUrl: APP_URL });

    expect(source).toBe("https://example.org/Book-List/mod_conf.yaml");
  });

  it("drops the query and fragment of a folder", function dropsQuery(): void {
    const source = resolveModReference("./samples/mods/book_list?v=2#top", {
      baseUrl: APP_URL,
    });

    expect(source).toBe(SAMPLE_MOD_SOURCE);
  });

  it("fails for a relative location without a base URL", function failsWithoutBase(): void {
    function resolveWithoutBase(): string {
      return resolveModReference("./samples/mods/book_list", {});
    }

    expect(resolveWithoutBase).toThrow(FileFetchError);
  });

  it("One mod, one source", function givesOneSource(): void {
    const references = [
      "./samples/mods/book_list",
      "./samples/mods/book_list/",
      "./samples/mods/book_list/mod_conf.yaml",
    ];

    const sources = new Set<string>();
    for (const reference of references) {
      sources.add(resolveModReference(reference, { baseUrl: APP_URL }));
    }

    expect([...sources]).toEqual([SAMPLE_MOD_SOURCE]);
  });
});
