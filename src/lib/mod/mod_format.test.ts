import { describe, expect, it } from "vitest";
import { readFixtureText } from "../../test/sample_files.ts";
import { SAMPLE_MOD_SOURCE } from "../../test/sample_mods.ts";
import { parseYaml } from "../files/index.ts";
import type { ParsedYaml, YamlMapping, YamlValue } from "../files/index.ts";
import { ModFormatError } from "./mod_errors.ts";
import { readModFormat } from "./mod_format.ts";
import type {
  LibraryFileFormat,
  LibraryFileKind,
  LibraryFormat,
} from "./mod_libraries.ts";

const MOD_SOURCE = "https://example.org/mods/broken/mod_conf.yaml";

function buildModFile(content: YamlMapping): ParsedYaml {
  const parsedYaml: ParsedYaml = { source: MOD_SOURCE, content };
  return parsedYaml;
}

/** The fields of the "Minimal mod file" scenario, plus the given ones. */
function buildMinimalMod(fields: YamlMapping): ParsedYaml {
  const mod: YamlMapping = {
    title: "Minimal",
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
      source: SAMPLE_MOD_SOURCE,
      content: readFixtureText("mods/book_list/mod_conf.yaml"),
    });

    const modFormat = readModFormat(parsedYaml);

    expect(modFormat).toEqual({
      title: "Book List",
      version: "1.0.0",
      api: "^0.2.0",
      description: "A very simple list of books with their covers.",
      entrypoint: "./main.js",
      typePath: "../../types/book.md",
      defaultMosaic: "./mosaic.yaml",
      testPath: null,
      config: { show_covers: true },
      permissions: [
        {
          category: "show",
          host: "https://upload.wikimedia.org",
          reason: "Shows the book covers",
        },
      ],
      theme: "default",
      libraries: [],
    });
  });

  it("Minimal mod file", function readsMinimalMod(): void {
    const modFormat = readModFormat(buildMinimalMod({}));

    expect(modFormat).toEqual({
      title: "Minimal",
      version: "0.1.0",
      api: null,
      description: "",
      entrypoint: "./main.js",
      typePath: null,
      defaultMosaic: null,
      testPath: null,
      config: {},
      permissions: [],
      theme: "default",
      libraries: [],
    });
  });

  it("Unknown keys are ignored", function ignoresUnknownKeys(): void {
    const modFormat = readModFormat(buildMinimalMod({ author: "Alice" }));

    expect(modFormat).not.toHaveProperty("author");
  });

  it("Former keys are ignored", function ignoresFormerKeys(): void {
    const modFormat = readModFormat(
      buildMinimalMod({
        name: "book_list",
        sample_collection: "./books.yaml",
      }),
    );

    expect(modFormat).not.toHaveProperty("name");
    expect(modFormat).not.toHaveProperty("sampleCollection");
    expect(modFormat.defaultMosaic).toBeNull();
  });

  it("No mod mapping", function rejectsMissingMod(): void {
    const error = catchFormatError(buildModFile({ title: "Minimal" }));

    expect(error.source).toBe(MOD_SOURCE);
    expect(error.message).toBe(
      `Invalid mod "${MOD_SOURCE}": a "mod" mapping is required`,
    );
  });

  it("rejects a mod that is a list", function rejectsModList(): void {
    const error = catchFormatError(buildModFile({ mod: [] }));

    expect(error.message).toContain('a "mod" mapping is required');
  });

  it("Missing title", function rejectsMissingTitle(): void {
    const parsedYaml = buildModWithout("title");
    (parsedYaml.content.mod as YamlMapping).name = "clock";

    const error = catchFormatError(parsedYaml);

    expect(error.message).toContain('"title" must be a non-empty string');
  });

  it("rejects an empty title", function rejectsEmptyTitle(): void {
    const error = catchFormatError(buildMinimalMod({ title: "" }));

    expect(error.message).toContain('"title" must be a non-empty string');
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

    expect(error.message).toContain('"title" must be a non-empty string');
  });

  it("rejects a description that is not a string", function rejectsDescription(): void {
    const error = catchFormatError(buildMinimalMod({ description: 12 }));

    expect(error.message).toContain('"description" must be a string');
  });

  it("rejects an empty type path", function rejectsEmptyTypePath(): void {
    const error = catchFormatError(buildMinimalMod({ type_path: "" }));

    expect(error.message).toContain('"type_path" must be a non-empty string');
  });

  it("Empty sample collection", function ignoresEmptySampleCollection(): void {
    const modFormat = readModFormat(buildMinimalMod({ sample_collection: "" }));

    expect(modFormat.title).toBe("Minimal");
  });

  it("Empty default mosaic", function rejectsEmptyDefaultMosaic(): void {
    const error = catchFormatError(buildMinimalMod({ default_mosaic: "" }));

    expect(error.message).toContain(
      '"default_mosaic" must be a non-empty string',
    );
  });

  it("Test file next to the mod file", function readsTestPath(): void {
    const modFormat = readModFormat(
      buildMinimalMod({ test_path: "./test.js" }),
    );

    expect(modFormat.testPath).toBe("./test.js");
  });

  it("Empty test path", function rejectsEmptyTestPath(): void {
    const error = catchFormatError(buildMinimalMod({ test_path: "" }));

    expect(error.source).toBe(MOD_SOURCE);
    expect(error.message).toBe(
      `Invalid mod "${MOD_SOURCE}": "test_path" must be a non-empty string`,
    );
  });

  it("rejects a test path that is a number", function rejectsTestPathNumber(): void {
    const error = catchFormatError(buildMinimalMod({ test_path: 3 }));

    expect(error.message).toContain('"test_path" must be a non-empty string');
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

  it("Caret range", function readsCaretRange(): void {
    const modFormat = readModFormat(buildMinimalMod({ api: "^0.2.0" }));

    expect(modFormat.api).toBe("^0.2.0");
  });

  it("keeps the range as written", function keepsRangeText(): void {
    const modFormat = readModFormat(
      buildMinimalMod({ api: ">=0.1.0 <1.0.0 || 2.x" }),
    );

    expect(modFormat.api).toBe(">=0.1.0 <1.0.0 || 2.x");
  });

  it("No api key", function readsNoRange(): void {
    const modFormat = readModFormat(buildMinimalMod({}));

    expect(modFormat.api).toBeNull();
  });

  it("Not a range", function rejectsNonRange(): void {
    const error = catchFormatError(buildMinimalMod({ api: "latest" }));

    expect(error.source).toBe(MOD_SOURCE);
    expect(error.message).toBe(
      `Invalid mod "${MOD_SOURCE}": "api" must be a semver range, such as "^0.1.0"`,
    );
  });

  it("Range written as a number", function rejectsRangeNumber(): void {
    const error = catchFormatError(buildMinimalMod({ api: 0.1 }));

    expect(error.message).toContain('"api" must be a semver range');
  });

  it("rejects an empty range", function rejectsEmptyRange(): void {
    const error = catchFormatError(buildMinimalMod({ api: "" }));

    expect(error.message).toContain('"api" must be a semver range');
  });

  it("rejects a blank range", function rejectsBlankRange(): void {
    const error = catchFormatError(buildMinimalMod({ api: "  " }));

    expect(error.message).toContain('"api" must be a semver range');
  });

  it("reads the permissions with the mod file's source", function readsPermissions(): void {
    const error = catchFormatError(
      buildMinimalMod({ permissions: { shows: [] } }),
    );

    expect(error.source).toBe(MOD_SOURCE);
    expect(error.message).toContain('"permissions.shows"');
  });
});

/** The example of "Library declarations" in docs/modules/lib/mod/README.md. */
const README_LIBRARIES_EXAMPLE = [
  "mod:",
  '  title: "country_map"',
  '  version: "0.1.0"',
  '  api: "^0.2.0"',
  '  entrypoint: "./main.js"',
  "  libraries:",
  "    leaflet:",
  '      npm: "leaflet@1.9.4"',
  '      files: ["dist/leaflet.js", "dist/leaflet.css"]',
  "    world_atlas:",
  '      npm: "world-atlas@2.0.2"',
  '      files: ["countries-110m.json"]',
  "    map_tools:",
  '      files: ["./vendor/map_tools.js"]',
].join("\n");

/** A minimal mod file whose `libraries` is the given value. */
function buildModWithLibraries(libraries: YamlValue): ParsedYaml {
  return buildMinimalMod({ libraries });
}

/** A minimal mod file with one library, `leaflet`, whose mapping is the given one. */
function buildModWithLibrary(library: YamlMapping): ParsedYaml {
  return buildModWithLibraries({ leaflet: library });
}

function readOnlyLibrary(parsedYaml: ParsedYaml): LibraryFormat {
  const libraries = readModFormat(parsedYaml).libraries;
  expect(libraries).toHaveLength(1);
  return libraries[0];
}

describe("readModFormat libraries", function describeLibraries(): void {
  it("reads the example of the mod module README", function readsReadmeExample(): void {
    const parsedYaml = parseYaml({
      source: MOD_SOURCE,
      content: README_LIBRARIES_EXAMPLE,
    });

    const modFormat = readModFormat(parsedYaml);

    expect(modFormat.libraries).toEqual([
      {
        name: "leaflet",
        package: "leaflet",
        version: "1.9.4",
        files: [
          { path: "dist/leaflet.js", kind: "script" },
          { path: "dist/leaflet.css", kind: "style" },
        ],
      },
      {
        name: "world_atlas",
        package: "world-atlas",
        version: "2.0.2",
        files: [{ path: "countries-110m.json", kind: "data" }],
      },
      {
        name: "map_tools",
        package: null,
        version: null,
        files: [{ path: "./vendor/map_tools.js", kind: "script" }],
      },
    ]);
  });

  it("No libraries key", function readsNoLibraries(): void {
    const modFormat = readModFormat(buildMinimalMod({}));

    expect(modFormat.libraries).toEqual([]);
  });

  it("Declared library", function readsDeclaredLibrary(): void {
    const library = readOnlyLibrary(
      buildModWithLibrary({
        npm: "leaflet@1.9.4",
        files: ["dist/leaflet.js", "dist/leaflet.css"],
      }),
    );

    expect(library).toEqual({
      name: "leaflet",
      package: "leaflet",
      version: "1.9.4",
      files: [
        { path: "dist/leaflet.js", kind: "script" },
        { path: "dist/leaflet.css", kind: "style" },
      ],
    });
  });

  it("keeps the order of the file", function keepsLibraryOrder(): void {
    const modFormat = readModFormat(
      buildModWithLibraries({
        zeta: { files: ["./zeta.js"] },
        alpha: { files: ["./alpha.js"] },
      }),
    );

    expect(modFormat.libraries.map(readLibraryName)).toEqual(["zeta", "alpha"]);
  });

  it("Unknown key in a library", function rejectsUnknownLibraryKey(): void {
    const error = catchFormatError(
      buildModWithLibrary({
        npm: "leaflet@1.9.4",
        files: ["dist/leaflet.js"],
        integrity: "sha384-abc",
      }),
    );

    expect(error.source).toBe(MOD_SOURCE);
    expect(error.message).toBe(
      `Invalid mod "${MOD_SOURCE}": "libraries.leaflet" has the key "integrity", but a library has only "npm" and "files"`,
    );
  });

  it("Name of a library the app ships", function rejectsShippedName(): void {
    const error = catchFormatError(
      buildModWithLibraries({ mermaid: { files: ["./mermaid.js"] } }),
    );

    expect(error.message).toContain(
      '"mermaid" is a library the app ships, so a mod cannot declare it',
    );
  });

  it("Name with capitals", function rejectsCapitalName(): void {
    const error = catchFormatError(
      buildModWithLibraries({ Leaflet: { files: ["./leaflet.js"] } }),
    );

    expect(error.message).toContain('"Leaflet"');
    expect(error.message).toContain(
      'a library name has only lowercase letters, digits and "_", and starts with a letter',
    );
  });

  it("accepts digits and underscores after the first letter", function readsSnakeName(): void {
    const library = readOnlyLibrary(
      buildModWithLibraries({ world_atlas2: { files: ["./world.json"] } }),
    );

    expect(library.name).toBe("world_atlas2");
  });

  it("rejects a name that starts with a digit", function rejectsDigitName(): void {
    const error = catchFormatError(
      buildModWithLibraries({ "3d": { files: ["./3d.js"] } }),
    );

    expect(error.message).toContain('and "3d" does not');
  });

  it("Libraries is a list", function rejectsLibraryList(): void {
    const error = catchFormatError(
      buildModWithLibraries([{ npm: "leaflet@1.9.4" }]),
    );

    expect(error.message).toBe(
      `Invalid mod "${MOD_SOURCE}": "libraries" must be a mapping`,
    );
  });

  it("rejects a library that is not a mapping", function rejectsLibraryText(): void {
    const error = catchFormatError(
      buildModWithLibraries({ leaflet: "leaflet@1.9.4" }),
    );

    expect(error.message).toContain(
      '"libraries.leaflet" must be a mapping with "files" and an optional "npm"',
    );
  });

  it("Scoped package", function readsScopedPackage(): void {
    const library = readOnlyLibrary(
      buildModWithLibrary({
        npm: "@turf/helpers@7.2.0",
        files: ["dist/turf-helpers.js"],
      }),
    );

    expect(library.package).toBe("@turf/helpers");
    expect(library.version).toBe("7.2.0");
  });

  it("reads a prerelease version", function readsPrerelease(): void {
    const library = readOnlyLibrary(
      buildModWithLibrary({
        npm: "leaflet@2.0.0-alpha.1",
        files: ["dist/leaflet.js"],
      }),
    );

    expect(library.version).toBe("2.0.0-alpha.1");
  });

  it("Range", function rejectsRange(): void {
    const error = catchFormatError(
      buildModWithLibrary({
        npm: "leaflet@^1.9.4",
        files: ["dist/leaflet.js"],
      }),
    );

    expect(error.message).toBe(
      `Invalid mod "${MOD_SOURCE}": "libraries.leaflet": "npm" needs an exact version of a package, such as "leaflet@1.9.4"`,
    );
  });

  it("Tag", function rejectsTag(): void {
    const error = catchFormatError(
      buildModWithLibrary({
        npm: "leaflet@latest",
        files: ["dist/leaflet.js"],
      }),
    );

    expect(error.message).toContain('"npm" needs an exact version');
  });

  it("No version", function rejectsNoVersion(): void {
    const error = catchFormatError(
      buildModWithLibrary({ npm: "leaflet", files: ["dist/leaflet.js"] }),
    );

    expect(error.message).toContain('"npm" needs an exact version');
  });

  it("rejects other npm values", function rejectsOtherNpmValues(): void {
    const npmValues: YamlValue[] = [
      "leaflet@v1.9.4",
      "leaflet@1.9",
      "@turf/helpers",
      "@turf@7.2.0",
      "Leaflet@1.9.4",
      "leaflet@",
      "",
      194,
      ["leaflet@1.9.4"],
    ];
    for (const npm of npmValues) {
      const error = catchFormatError(
        buildModWithLibrary({ npm, files: ["dist/leaflet.js"] }),
      );

      expect(error.message).toContain('"npm" needs an exact version');
    }
  });

  it("reads no package and no version without npm", function readsLocalLibrary(): void {
    const library = readOnlyLibrary(
      buildModWithLibrary({ files: ["./vendor/helper.js"] }),
    );

    expect(library.package).toBeNull();
    expect(library.version).toBeNull();
    expect(library.files).toEqual([
      { path: "./vendor/helper.js", kind: "script" },
    ]);
  });

  it("Path leaving the package", function rejectsPathLeavingPackage(): void {
    const error = catchFormatError(
      buildModWithLibrary({
        npm: "leaflet@1.9.4",
        files: ["../other/index.js"],
      }),
    );

    expect(error.message).toContain('"../other/index.js"');
    expect(error.message).toContain('"libraries.leaflet"');
  });

  it("rejects npm paths that are not inside the package", function rejectsOtherNpmPaths(): void {
    const paths = [
      "/dist/leaflet.js",
      "./dist/leaflet.js",
      "dist/../../leaflet.js",
      "dist/..",
      "dist\\leaflet.js",
      "dist/leaflet.js?raw",
      "dist/leaflet.js#top",
    ];
    for (const path of paths) {
      const error = catchFormatError(
        buildModWithLibrary({ npm: "leaflet@1.9.4", files: [path] }),
      );

      expect(error.message).toContain("must be a path inside the npm package");
    }
  });

  it("accepts dots that are not a segment of their own", function readsDottedPath(): void {
    const library = readOnlyLibrary(
      buildModWithLibrary({
        npm: "leaflet@1.9.4",
        files: ["dist/..leaflet.js", ".well/leaflet.js"],
      }),
    );

    expect(library.files).toHaveLength(2);
  });

  it("keeps relative paths of a library without npm", function readsParentPath(): void {
    const library = readOnlyLibrary(
      buildModWithLibrary({ files: ["../shared/helper.js"] }),
    );

    expect(library.files[0].path).toBe("../shared/helper.js");
  });

  it("No files", function rejectsNoFiles(): void {
    const error = catchFormatError(
      buildModWithLibrary({ npm: "leaflet@1.9.4", files: [] }),
    );

    expect(error.message).toContain('"files" must be a non-empty list');
  });

  it("rejects missing files and files that are not non-empty strings", function rejectsOtherFiles(): void {
    const libraries: YamlMapping[] = [
      { npm: "leaflet@1.9.4" },
      { files: "dist/leaflet.js" },
      { files: [""] },
      { files: [3] },
    ];
    for (const library of libraries) {
      const error = catchFormatError(buildModWithLibrary(library));

      expect(error.message).toContain(
        '"libraries.leaflet": "files" must be a non-empty list of non-empty strings',
      );
    }
  });

  it("Kinds", function readsKinds(): void {
    const library = readOnlyLibrary(
      buildModWithLibrary({
        npm: "leaflet@1.9.4",
        files: ["dist/leaflet.js", "dist/leaflet.css", "countries-110m.json"],
      }),
    );

    expect(library.files.map(readFileKind)).toEqual([
      "script",
      "style",
      "data",
    ]);
  });

  it("reads kinds ignoring case, and a file without extension as data", function readsOtherKinds(): void {
    const library = readOnlyLibrary(
      buildModWithLibrary({
        npm: "leaflet@1.9.4",
        files: [
          "dist/LEAFLET.JS",
          "dist/Leaflet.Css",
          "LICENSE",
          "dist.js/notes",
        ],
      }),
    );

    expect(library.files.map(readFileKind)).toEqual([
      "script",
      "style",
      "data",
      "data",
    ]);
  });

  it("ES module", function rejectsEsModule(): void {
    const error = catchFormatError(
      buildModWithLibrary({ npm: "leaflet@2.0.0", files: ["dist/index.mjs"] }),
    );

    expect(error.message).toContain('"dist/index.mjs"');
    expect(error.message).toContain("ES module libraries are not supported");
  });

  it("rejects an ES module whatever the case of its extension", function rejectsUpperEsModule(): void {
    const error = catchFormatError(
      buildModWithLibrary({ files: ["./vendor/index.MJS"] }),
    );

    expect(error.message).toContain("ES module libraries are not supported");
  });
});

function readLibraryName(library: LibraryFormat): string {
  return library.name;
}

function readFileKind(file: LibraryFileFormat): LibraryFileKind {
  return file.kind;
}
