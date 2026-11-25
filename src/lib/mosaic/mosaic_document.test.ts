import { describe, expect, it } from "vitest";
import {
  applyMosaicEdits,
  buildNewDraft,
  makeCopyDraft,
  MosaicEditError,
  readDraftFields,
} from "./index.ts";
import type { MosaicEdits } from "./index.ts";

/** Builds a mosaic file from its lines, each ending with a line break. */
function buildText(lines: string[]): string {
  const text = `${lines.join("\n")}\n`;
  return text;
}

const COMMENTED_MOSAIC = buildText([
  "mosaic:",
  '  title: "Laureates on the map"',
  '  mod: "../mods/country_map"',
  '  collection: "../tiles/literature_nobel_laureates"',
  "  # Closer than the mod's default zoom.",
  "  config:",
  "    map:",
  "      zoom: 3",
]);

/** The lines of `after` that differ from the line at the same place in `before`. */
function listChangedLines(before: string, after: string): string[] {
  const beforeLines = before.split("\n");
  const afterLines = after.split("\n");
  const changedLines: string[] = [];
  for (const [index, line] of afterLines.entries()) {
    if (beforeLines[index] !== line) {
      changedLines.push(line);
    }
  }
  return changedLines;
}

function readEditError(content: string, edits: MosaicEdits): MosaicEditError {
  try {
    applyMosaicEdits(content, edits);
  } catch (error) {
    if (error instanceof MosaicEditError) {
      return error;
    }
    throw error;
  }
  throw new Error("Expected the edits to be refused, but they were applied");
}

describe("applyMosaicEdits", function describeApplyMosaicEdits(): void {
  it("Title changed in the form", function changesTitleLine(): void {
    const edited = applyMosaicEdits(COMMENTED_MOSAIC, {
      title: "Laureates, my way",
    });

    expect(listChangedLines(COMMENTED_MOSAIC, edited)).toEqual([
      '  title: "Laureates, my way"',
    ]);
    expect(edited).toContain("  # Closer than the mod's default zoom.\n");
  });

  it("Alias added", function addsAliases(): void {
    const edited = applyMosaicEdits(COMMENTED_MOSAIC, {
      aliases: { country: ["birth_country"] },
    });

    expect(edited).toBe(
      buildText([
        "mosaic:",
        '  title: "Laureates on the map"',
        '  mod: "../mods/country_map"',
        '  collection: "../tiles/literature_nobel_laureates"',
        "  # Closer than the mod's default zoom.",
        "  config:",
        "    map:",
        "      zoom: 3",
        "  aliases:",
        '    country: ["birth_country"]',
      ]),
    );
  });

  it("keeps the untouched fields of the aliases", function keepsAliasFields(): void {
    const content = buildText([
      "mosaic:",
      '  title: "Laureates"',
      '  mod: "country_map"',
      "  aliases:",
      "    # The laureate's name.",
      '    title: ["name"]',
      '    country: ["country_of_birth"]',
    ]);

    const edited = applyMosaicEdits(content, {
      aliases: { title: ["name"], country: ["birth_country"] },
    });

    expect(listChangedLines(content, edited)).toEqual([
      '    country: ["birth_country"]',
    ]);
  });

  it("removes the aliases when none are left", function removesAliases(): void {
    const content = buildText([
      "mosaic:",
      '  title: "Laureates"',
      '  mod: "country_map"',
      "  aliases:",
      '    title: ["name"]',
    ]);

    const edited = applyMosaicEdits(content, { aliases: {} });

    expect(edited).toBe(
      buildText(["mosaic:", '  title: "Laureates"', '  mod: "country_map"']),
    );
  });

  it("replaces the show lines", function replacesShowLines(): void {
    const content = buildText([
      "mosaic:",
      '  title: "Books"',
      '  mod: "../mods/book_list"',
      "  permissions:",
      "    show:",
      '      - host: "https://upload.wikimedia.org"',
      '        reason: "Shows the book covers"',
      '      - host: "https://archive.org"',
      '        reason: "Shows the book covers"',
    ]);

    const edited = applyMosaicEdits(content, {
      show: [
        {
          host: "https://upload.wikimedia.org",
          reason: "Shows the book covers",
        },
        { host: "https://covers.openlibrary.org", reason: "Shows the covers" },
      ],
    });

    expect(edited).toBe(
      buildText([
        "mosaic:",
        '  title: "Books"',
        '  mod: "../mods/book_list"',
        "  permissions:",
        "    show:",
        '      - host: "https://upload.wikimedia.org"',
        '        reason: "Shows the book covers"',
        '      - host: "https://covers.openlibrary.org"',
        '        reason: "Shows the covers"',
      ]),
    );
  });

  it("removes the permissions with the last show line", function removesPermissions(): void {
    const content = buildText([
      "mosaic:",
      '  title: "Books"',
      '  mod: "../mods/book_list"',
      "  permissions:",
      "    show:",
      '      - host: "https://archive.org"',
      '        reason: "Shows the book covers"',
    ]);

    const edited = applyMosaicEdits(content, { show: [] });

    expect(edited).toBe(
      buildText(["mosaic:", '  title: "Books"', '  mod: "../mods/book_list"']),
    );
  });

  it("removes a description set to null", function removesDescription(): void {
    const content = buildText([
      "mosaic:",
      '  title: "Clock"',
      '  description: "A clock."',
      '  mod: "./clock"',
    ]);

    const edited = applyMosaicEdits(content, { description: null });

    expect(edited).toBe(
      buildText(["mosaic:", '  title: "Clock"', '  mod: "./clock"']),
    );
  });

  it("adds a key in the mosaic's order", function addsKeyInOrder(): void {
    const content = buildText([
      "mosaic:",
      '  title: "Clock"',
      '  mod: "./clock"',
      "  config:",
      "    hours: 24",
    ]);

    const edited = applyMosaicEdits(content, {
      description: "A clock.",
      collection: "https://example.org/tiles/hours",
    });

    expect(edited).toBe(
      buildText([
        "mosaic:",
        '  title: "Clock"',
        '  description: "A clock."',
        '  mod: "./clock"',
        '  collection: "https://example.org/tiles/hours"',
        "  config:",
        "    hours: 24",
      ]),
    );
  });

  it("keeps quoted, unquoted and date-like strings", function keepsStrings(): void {
    const content = buildText([
      "mosaic:",
      "  title: Clock",
      '  description: "Since 1999"',
      "  mod: './clock'",
      "  config:",
      "    since: 2024-01-31",
      "    label: 'yes'",
    ]);

    const edited = applyMosaicEdits(content, { title: "2024-02-01" });

    expect(listChangedLines(content, edited)).toEqual(["  title: 2024-02-01"]);
  });

  it("quotes a new title that would read as another type", function quotesNewTitle(): void {
    const content = buildText([
      "mosaic:",
      "  title: Clock",
      '  mod: "./clock"',
    ]);

    const edited = applyMosaicEdits(content, { title: "true" });

    expect(listChangedLines(content, edited)).toEqual(['  title: "true"']);
  });

  it("leaves an anchor untouched", function keepsAnchor(): void {
    const content = buildText([
      "mosaic:",
      '  title: "Clock"',
      '  mod: "./clock"',
      "  config:",
      "    day: &colors",
      '      hand: "black"',
      "    night: *colors",
    ]);

    const edited = applyMosaicEdits(content, { title: "Clock at night" });

    expect(listChangedLines(content, edited)).toEqual([
      '  title: "Clock at night"',
    ]);
  });

  it("refuses an unknown edit", function refusesUnknownEdit(): void {
    const unknownEdits = { colour: "red" } as unknown as MosaicEdits;

    const error = readEditError(COMMENTED_MOSAIC, unknownEdits);

    expect(error.reason).toBe('"edits.colour" is not a draft edit');
  });

  it("refuses an edit of the wrong type", function refusesWrongType(): void {
    const wrongEdits = {
      aliases: { country: "birth_country" },
    } as unknown as MosaicEdits;

    const error = readEditError(COMMENTED_MOSAIC, wrongEdits);

    expect(error.reason).toBe(
      '"edits.aliases.country" must be a list of strings',
    );
  });

  it("refuses a draft that does not parse", function refusesBrokenText(): void {
    const brokenText = buildText([
      "mosaic:",
      '  title: "Clock',
      '  mod: "./clock"',
    ]);

    const error = readEditError(brokenText, { title: "Clock" });

    expect(error.reason).toMatch(/^the draft cannot be read: /);
  });

  it("refuses an edit the loader would refuse", function refusesInvalidResult(): void {
    const error = readEditError(COMMENTED_MOSAIC, {
      show: [{ host: "upload.wikimedia.org", reason: "Shows the portraits" }],
    });

    expect(error.reason).toMatch(/^the edits make the mosaic invalid: /);
    expect(error.reason).toContain('host "upload.wikimedia.org"');
  });

  it("applies an edit to a draft the loader already refuses", function editsInvalidDraft(): void {
    const draftWithoutMod = buildText(["mosaic:", '  title: "Clock"']);

    const edited = applyMosaicEdits(draftWithoutMod, {
      title: "Clock at noon",
    });

    expect(edited).toBe(buildText(["mosaic:", '  title: "Clock at noon"']));
  });
});

const BOOKS_LIST_SOURCE =
  "https://example.org/samples/mosaics/nobel_books_list.yaml";

/** A copy of the text of `public/samples/mosaics/nobel_books_list.yaml`. */
const BOOKS_LIST_TEXT = buildText([
  "mosaic:",
  '  title: "Books by Nobel laureates"',
  '  description: "The book list with the books of the Nobel Prize in Literature laureates, eight per row."',
  '  mod: "../mods/book_list"',
  '  collection: "../tiles/literature_nobel_laureates_books"',
  "  config:",
  "    columns: 8",
  "  permissions:",
  "    show:",
  '      - host: "https://upload.wikimedia.org"',
  '        reason: "Shows the book covers"',
  '      - host: "https://covers.openlibrary.org"',
  '        reason: "Shows the book covers"',
  '      - host: "https://*.archive.org"',
  '        reason: "Shows the book covers"',
  '      - host: "https://archive.org"',
  '        reason: "Shows the book covers"',
]);

describe("makeCopyDraft", function describeMakeCopyDraft(): void {
  it("Copy of a sample mosaic", function copiesSample(): void {
    const copy = makeCopyDraft(BOOKS_LIST_TEXT, BOOKS_LIST_SOURCE);

    expect(listChangedLines(BOOKS_LIST_TEXT, copy)).toEqual([
      '  mod: "https://example.org/samples/mods/book_list"',
      '  collection: "https://example.org/samples/tiles/literature_nobel_laureates_books"',
    ]);
  });

  it("keeps absolute references and default mod names", function keepsAbsolute(): void {
    const content = buildText([
      "mosaic:",
      '  title: "Viewer"',
      '  mod: "mod_viewer"',
      '  collection: "https://tiles.example.net/books"',
    ]);

    const copy = makeCopyDraft(content, BOOKS_LIST_SOURCE);

    expect(copy).toBe(content);
  });
});

describe("buildNewDraft", function describeBuildNewDraft(): void {
  it("Flashcards with the laureates' books", function buildsDraft(): void {
    const draft = buildNewDraft(
      "https://example.org/samples/mods/flashcards/mod_conf.yaml",
      "https://example.org/samples/tiles/literature_nobel_laureates_books/collection.yaml",
      [{ host: "https://archive.org", reason: "Shows the book covers" }],
    );

    expect(draft).toBe(
      buildText([
        "mosaic:",
        '  title: "Untitled mosaic"',
        '  mod: "https://example.org/samples/mods/flashcards/mod_conf.yaml"',
        '  collection: "https://example.org/samples/tiles/literature_nobel_laureates_books/collection.yaml"',
        "  permissions:",
        "    show:",
        '      - host: "https://archive.org"',
        '        reason: "Shows the book covers"',
      ]),
    );
  });

  it("has no collection for None", function buildsWithoutCollection(): void {
    const draft = buildNewDraft(
      "https://example.org/default_mods/clock/mod_conf.yaml",
      null,
      [],
    );

    expect(draft).toBe(
      buildText([
        "mosaic:",
        '  title: "Untitled mosaic"',
        '  mod: "https://example.org/default_mods/clock/mod_conf.yaml"',
      ]),
    );
  });
});

describe("readDraftFields", function describeReadDraftFields(): void {
  it("reads the fields as written", function readsFields(): void {
    const fields = readDraftFields(
      buildText([
        "mosaic:",
        '  title: "Laureates"',
        '  mod: "../mods/country_map"',
        '  collection: "../tiles/laureates"',
        "  aliases:",
        '    title: ["name"]',
        "  permissions:",
        "    show:",
        '      - host: "https://upload.wikimedia.org"',
        '        reason: "Shows the portraits"',
      ]),
    );

    expect(fields).toEqual({
      title: "Laureates",
      description: null,
      mod: "../mods/country_map",
      collection: "../tiles/laureates",
      config: {},
      aliases: { title: ["name"] },
      show: [
        { host: "https://upload.wikimedia.org", reason: "Shows the portraits" },
      ],
    });
  });

  it("reports wrong values as none", function readsWrongValues(): void {
    const fields = readDraftFields(
      buildText([
        "mosaic:",
        "  title: 3",
        "  aliases:",
        '    title: "name"',
        '    country: ["birth_country", 4]',
        "  permissions:",
        "    show:",
        '      - host: "https://a.example.org"',
        "      - 5",
      ]),
    );

    expect(fields).toEqual({
      title: null,
      description: null,
      mod: null,
      collection: null,
      config: {},
      aliases: {},
      show: [],
    });
  });

  it("is null for a text that cannot be read", function readsBrokenText(): void {
    expect(readDraftFields('mosaic:\n  title: "Clock\n')).toBeNull();
    expect(readDraftFields("title: Clock\n")).toBeNull();
  });
});
