import { YAMLException } from "js-yaml";
import { afterEach, describe, expect, it } from "vitest";
import { readFixtureText } from "../../test/sample_files.ts";
import { MarkdownParseError } from "./file_errors.ts";
import type { FetchedFile } from "./file_fetcher.ts";
import { parseMarkdown } from "./markdown_parser.ts";

const TEST_SOURCE = "https://example.org/tiles/test.md";
const FAHRENHEIT_PATH = "tiles/books/farenheit_451.md";
const CODE_RAN_MARKER = "teselariumTileCodeRan";

function buildFetchedFile(content: string): FetchedFile {
  const fetchedFile: FetchedFile = { source: TEST_SOURCE, content };
  return fetchedFile;
}

function parseExpectingError(file: FetchedFile): MarkdownParseError {
  try {
    parseMarkdown(file);
  } catch (error) {
    if (error instanceof MarkdownParseError) {
      return error;
    }
    throw error;
  }
  throw new Error(`Expected parsing "${file.source}" to fail, but it passed`);
}

function readTextAfterFrontmatter(text: string): string {
  const closingLine = "\n---\n";
  const closingIndex = text.indexOf(closingLine, "---".length);
  const textAfterFrontmatter = text.slice(closingIndex + closingLine.length);
  return textAfterFrontmatter;
}

function hasCodeRan(): boolean {
  return Reflect.has(globalThis, CODE_RAN_MARKER);
}

describe("parseMarkdown", function describeParseMarkdown(): void {
  afterEach(function removeCodeRanMarker(): void {
    Reflect.deleteProperty(globalThis, CODE_RAN_MARKER);
  });

  describe("frontmatter", function describeFrontmatter(): void {
    it("Sample frontmatter", function parsesSampleFrontmatter(): void {
      const parsed = parseMarkdown(
        buildFetchedFile(readFixtureText(FAHRENHEIT_PATH)),
      );

      expect(parsed.metadata.title).toBe("Fahrenheit 451");
      expect(parsed.metadata.genres).toEqual(["Dystopian", "Science fiction"]);
      expect(parsed.metadata.pages).toBe(156);
    });

    it("keeps the source of the file", function keepsSource(): void {
      const parsed = parseMarkdown(buildFetchedFile('---\ntitle: "A"\n---\n'));

      expect(parsed.source).toBe(TEST_SOURCE);
    });

    it("CRLF line endings", function parsesCrlf(): void {
      const parsed = parseMarkdown(
        buildFetchedFile('---\r\ntitle: "A"\r\n---\r\nText\r\n'),
      );

      expect(parsed.metadata).toEqual({ title: "A" });
      expect(parsed.body).toBe("Text\r\n");
    });

    it("Empty frontmatter block", function parsesEmptyBlock(): void {
      const parsed = parseMarkdown(buildFetchedFile("---\n---\nText"));

      expect(parsed.metadata).toEqual({});
      expect(parsed.body).toBe("Text");
    });

    it("parses a comment-only block as empty metadata", function parsesCommentOnlyBlock(): void {
      const parsed = parseMarkdown(
        buildFetchedFile("---\n# only a comment\n---\nText"),
      );

      expect(parsed.metadata).toEqual({});
      expect(parsed.body).toBe("Text");
    });

    it("accepts a ---yaml opening line", function acceptsYamlLanguage(): void {
      const parsed = parseMarkdown(
        buildFetchedFile('---yaml\ntitle: "A"\n---\nText'),
      );

      expect(parsed.metadata).toEqual({ title: "A" });
      expect(parsed.body).toBe("Text");
    });

    it("accepts a ---yml opening line", function acceptsYmlLanguage(): void {
      const parsed = parseMarkdown(
        buildFetchedFile('---yml\ntitle: "A"\n---\nText'),
      );

      expect(parsed.metadata).toEqual({ title: "A" });
      expect(parsed.body).toBe("Text");
    });
  });

  describe("body", function describeBody(): void {
    it("Sample body", function keepsSampleBody(): void {
      const sampleText = readFixtureText(FAHRENHEIT_PATH);

      const parsed = parseMarkdown(buildFetchedFile(sampleText));

      expect(parsed.body).toBe(readTextAfterFrontmatter(sampleText));
      expect(
        parsed.body.startsWith("\nFahrenheit 451 is a 1953 dystopian novel"),
      ).toBe(true);
    });

    it("Markdown syntax kept", function keepsMarkdownSyntax(): void {
      const body =
        "\n# Heading\n\nSee [source](https://example.org).  \n\n\nLast line  \n";

      const parsed = parseMarkdown(
        buildFetchedFile(`---\ntitle: "A"\n---\n${body}`),
      );

      expect(parsed.body).toBe(body);
    });
  });

  describe("files without frontmatter", function describeNoFrontmatter(): void {
    it("Plain markdown file", function parsesPlainMarkdown(): void {
      const parsed = parseMarkdown(buildFetchedFile("# Just text\n"));

      expect(parsed.metadata).toEqual({});
      expect(parsed.body).toBe("# Just text\n");
    });

    it("Delimiter not on the first line", function ignoresLaterDelimiter(): void {
      const content = '\n---\ntitle: "A"\n---\nText';

      const parsed = parseMarkdown(buildFetchedFile(content));

      expect(parsed.metadata).toEqual({});
      expect(parsed.body).toBe(content);
    });

    it("Empty file", function parsesEmptyFile(): void {
      const parsed = parseMarkdown(buildFetchedFile(""));

      expect(parsed.metadata).toEqual({});
      expect(parsed.body).toBe("");
    });

    it("does not open a block with a ---- first line", function ignoresFourDashes(): void {
      const content = '----\ntitle: "A"\n----\nText';

      const parsed = parseMarkdown(buildFetchedFile(content));

      expect(parsed.metadata).toEqual({});
      expect(parsed.body).toBe(content);
    });
  });

  describe("plain data metadata", function describePlainData(): void {
    it("Unquoted date stays a string", function keepsDateString(): void {
      const parsed = parseMarkdown(
        buildFetchedFile("---\ndate: 1953-10-19\n---\n"),
      );

      expect(parsed.metadata.date).toBe("1953-10-19");
    });

    it("Tag for another value type", function rejectsBinaryTag(): void {
      const error = parseExpectingError(
        buildFetchedFile("---\ncover: !!binary aGk=\n---\n"),
      );

      expect(error).toBeInstanceOf(MarkdownParseError);
    });

    it("Code tag is never run", function rejectsFunctionTag(): void {
      const content = `---\ntitle: !!js/function "function () { globalThis.${CODE_RAN_MARKER} = true; }"\n---\n`;

      const error = parseExpectingError(buildFetchedFile(content));

      expect(error).toBeInstanceOf(MarkdownParseError);
      expect(hasCodeRan()).toBe(false);
    });
  });

  describe("frontmatter language", function describeFrontmatterLanguage(): void {
    it("JavaScript frontmatter", function rejectsJavaScript(): void {
      const content = `---js\n{ title: (function () { globalThis.${CODE_RAN_MARKER} = true; return "x"; })() }\n---\nText`;

      const error = parseExpectingError(buildFetchedFile(content));

      expect(error).toBeInstanceOf(MarkdownParseError);
      expect(error.message).toContain("must be YAML");
      expect(hasCodeRan()).toBe(false);
    });

    it("JSON frontmatter", function rejectsJson(): void {
      const error = parseExpectingError(
        buildFetchedFile('---json\n{"title": "A"}\n---\nText'),
      );

      expect(error).toBeInstanceOf(MarkdownParseError);
      expect(error.message).toContain("frontmatter must be YAML");
      expect(error.message).toContain("json");
    });
  });

  describe("malformed frontmatter", function describeMalformedFrontmatter(): void {
    it("Invalid YAML", function rejectsInvalidYaml(): void {
      const badSource = "https://example.org/bad.md";

      const error = parseExpectingError({
        source: badSource,
        content: '---\ntitle: "unterminated\n---\nText',
      });

      expect(error).toBeInstanceOf(MarkdownParseError);
      expect(error.source).toBe(badSource);
      expect(error.message).toContain(badSource);
      expect(error.cause).toBeInstanceOf(YAMLException);
    });

    it("Frontmatter is a list", function rejectsList(): void {
      const error = parseExpectingError(
        buildFetchedFile("---\n- a\n- b\n---\nText"),
      );

      expect(error.message).toContain("frontmatter must be a mapping");
    });

    it("rejects a single value as frontmatter", function rejectsScalar(): void {
      const error = parseExpectingError(
        buildFetchedFile("---\njust a value\n---\nText"),
      );

      expect(error.message).toContain("frontmatter must be a mapping");
    });

    it("Frontmatter not closed", function rejectsUnclosedBlock(): void {
      const error = parseExpectingError(
        buildFetchedFile('---\ntitle: "A"\n\nSome text'),
      );

      expect(error.source).toBe(TEST_SOURCE);
      expect(error.message).toContain("frontmatter is not closed");
    });

    it("Repeated key", function rejectsRepeatedKey(): void {
      const error = parseExpectingError(
        buildFetchedFile('---\ntitle: "A"\ntitle: "B"\n---\nText'),
      );

      expect(error).toBeInstanceOf(MarkdownParseError);
    });
  });

  describe("independent results", function describeIndependentResults(): void {
    it("gives independent metadata for the same content", function parsesIndependently(): void {
      const fetchedFile = buildFetchedFile(readFixtureText(FAHRENHEIT_PATH));

      const firstParsed = parseMarkdown(fetchedFile);
      const secondParsed = parseMarkdown(fetchedFile);
      firstParsed.metadata.title = "Changed";

      expect(secondParsed.metadata).not.toBe(firstParsed.metadata);
      expect(secondParsed.metadata.genres).not.toBe(
        firstParsed.metadata.genres,
      );
      expect(secondParsed.metadata.title).toBe("Fahrenheit 451");
    });
  });
});
