import { describe, expect, it } from "vitest";
import { readFixtureText } from "../../test/sample_files.ts";
import { parseYaml } from "../files/index.ts";
import type { ParsedYaml, YamlMapping } from "../files/index.ts";
import { ModFormatError } from "./mod_errors.ts";
import { readModFormat } from "./mod_format.ts";

const MOD_SOURCE = "https://example.org/mods/broken/mod_conf.yaml";

function buildModFile(content: YamlMapping): ParsedYaml {
  const parsedYaml: ParsedYaml = { source: MOD_SOURCE, content };
  return parsedYaml;
}

/** The fields of the "Minimal mod file" scenario, plus the given ones. */
function buildMinimalMod(fields: YamlMapping): ParsedYaml {
  const mod: YamlMapping = {
    name: "minimal",
    version: "0.1.0",
    entrypoint: "./main.js",
    ...fields,
  };
  return buildModFile({ mod });
}

function buildModWithout(fieldName: string): ParsedYaml {
  const parsedYaml = buildMinimalMod({});
  const mod = parsedYaml.content.mod as YamlMapping;
  delete mod[fieldName];
  return parsedYaml;
}

function catchFormatError(parsedYaml: ParsedYaml): ModFormatError {
  try {
    readModFormat(parsedYaml);
  } catch (error) {
    if (error instanceof ModFormatError) {
      return error;
    }
    throw error;
  }
  throw new Error("Expected the mod file to be rejected, but it passed");
}

describe("readModFormat", function describeReadModFormat(): void {
  it("reads the sample book list mod", function readsSampleMod(): void {
    const parsedYaml = parseYaml({
      source: "https://example.org/fixtures/mods/book_list/mod_conf.yaml",
      content: readFixtureText("mods/book_list/mod_conf.yaml"),
    });

    const modFormat = readModFormat(parsedYaml);

    expect(modFormat).toEqual({
      name: "book_list",
      title: "Book List",
      version: "1.0.0",
      description: "A very simple list of books with their covers.",
      entrypoint: "./main.js",
      typePath: "../../types/book.md",
      sampleCollection: "../../tiles/books_collection.yaml",
      config: { show_covers: true },
      permissions: [
        {
          category: "show",
          host: "https://upload.wikimedia.org",
          reason: "Shows the book covers",
        },
      ],
      theme: "default",
    });
  });

  it("Minimal mod file", function readsMinimalMod(): void {
    const modFormat = readModFormat(buildMinimalMod({}));

    expect(modFormat).toEqual({
      name: "minimal",
      title: "minimal",
      version: "0.1.0",
      description: "",
      entrypoint: "./main.js",
      typePath: null,
      sampleCollection: null,
      config: {},
      permissions: [],
      theme: "default",
    });
  });

  it("Unknown keys are ignored", function ignoresUnknownKeys(): void {
    const modFormat = readModFormat(buildMinimalMod({ author: "Alice" }));

    expect(modFormat).not.toHaveProperty("author");
  });

  it("No mod mapping", function rejectsMissingMod(): void {
    const error = catchFormatError(buildModFile({ name: "minimal" }));

    expect(error.source).toBe(MOD_SOURCE);
    expect(error.message).toBe(
      `Invalid mod "${MOD_SOURCE}": a "mod" mapping is required`,
    );
  });

  it("rejects a mod that is a list", function rejectsModList(): void {
    const error = catchFormatError(buildModFile({ mod: [] }));

    expect(error.message).toContain('a "mod" mapping is required');
  });

  it("rejects a missing name", function rejectsMissingName(): void {
    const error = catchFormatError(buildModWithout("name"));

    expect(error.message).toContain('"name" must be a non-empty string');
  });

  it("rejects a name that is not a string", function rejectsNameNumber(): void {
    const error = catchFormatError(buildMinimalMod({ name: 3 }));

    expect(error.message).toContain('"name" must be a non-empty string');
  });

  it("rejects a missing version", function rejectsMissingVersion(): void {
    const error = catchFormatError(buildModWithout("version"));

    expect(error.message).toContain('"version" must be a non-empty string');
  });

  it("Version written as a number", function rejectsVersionNumber(): void {
    const error = catchFormatError(buildMinimalMod({ version: 1 }));

    expect(error.message).toContain('"version" must be a non-empty string');
  });

  it("Missing entrypoint", function rejectsMissingEntrypoint(): void {
    const error = catchFormatError(buildModWithout("entrypoint"));

    expect(error.message).toContain('"entrypoint" must be a non-empty string');
  });

  it("rejects an empty entrypoint", function rejectsEmptyEntrypoint(): void {
    const error = catchFormatError(buildMinimalMod({ entrypoint: "" }));

    expect(error.message).toContain('"entrypoint" must be a non-empty string');
  });

  it("rejects a title that is not a string", function rejectsTitleList(): void {
    const error = catchFormatError(buildMinimalMod({ title: ["Book"] }));

    expect(error.message).toContain('"title" must be a string');
  });

  it("rejects a description that is not a string", function rejectsDescription(): void {
    const error = catchFormatError(buildMinimalMod({ description: 12 }));

    expect(error.message).toContain('"description" must be a string');
  });

  it("rejects an empty type path", function rejectsEmptyTypePath(): void {
    const error = catchFormatError(buildMinimalMod({ type_path: "" }));

    expect(error.message).toContain('"type_path" must be a non-empty string');
  });

  it("Empty sample collection", function rejectsEmptySampleCollection(): void {
    const error = catchFormatError(buildMinimalMod({ sample_collection: "" }));

    expect(error.message).toContain(
      '"sample_collection" must be a non-empty string',
    );
  });

  it("Config is not a mapping", function rejectsConfigList(): void {
    const error = catchFormatError(buildMinimalMod({ config: ["a"] }));

    expect(error.message).toContain('"config" must be a mapping');
  });

  it("Inline schema", function rejectsInlineSchema(): void {
    const error = catchFormatError(
      buildMinimalMod({ schema: { definitions: {} } }),
    );

    expect(error.message).toContain(
      'inline "schema" is not supported yet, use "type_path" with the path of a tile type file',
    );
  });

  it("reads a missing theme as the default one", function readsDefaultTheme(): void {
    const modFormat = readModFormat(buildMinimalMod({}));

    expect(modFormat.theme).toBe("default");
  });

  it("keeps an explicit default theme", function readsExplicitDefault(): void {
    const modFormat = readModFormat(buildMinimalMod({ theme: "default" }));

    expect(modFormat.theme).toBe("default");
  });

  it("keeps the none theme", function readsNoTheme(): void {
    const modFormat = readModFormat(buildMinimalMod({ theme: "none" }));

    expect(modFormat.theme).toBe("none");
  });

  it("Unknown theme value", function rejectsUnknownTheme(): void {
    const error = catchFormatError(buildMinimalMod({ theme: "dark" }));

    expect(error.source).toBe(MOD_SOURCE);
    expect(error.message).toBe(
      `Invalid mod "${MOD_SOURCE}": "theme" must be "default" or "none"`,
    );
  });

  it("rejects a theme that is not a string", function rejectsThemeNumber(): void {
    const error = catchFormatError(buildMinimalMod({ theme: 0 }));

    expect(error.message).toContain('"theme" must be "default" or "none"');
  });

  it("reads the permissions with the mod file's source", function readsPermissions(): void {
    const error = catchFormatError(
      buildMinimalMod({ permissions: { shows: [] } }),
    );

    expect(error.source).toBe(MOD_SOURCE);
    expect(error.message).toContain('"permissions.shows"');
  });
});
