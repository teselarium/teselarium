import matter from "@11ty/gray-matter";
import { CORE_SCHEMA, load } from "js-yaml";
import type { FetchedFile } from "./file_fetcher.ts";
import { describeErrorCause, MarkdownParseError } from "./tile_errors.ts";

/** A metadata value: plain data only, so tiles can be structured-cloned. */
export type MetadataValue =
  | string
  | number
  | boolean
  | null
  | MetadataValue[]
  | { [key: string]: MetadataValue };

/** The parsed frontmatter of a markdown file. */
export type Metadata = { [key: string]: MetadataValue };

/** A markdown file split into its frontmatter metadata and its unchanged body. */
export interface ParsedMarkdown {
  source: string;
  metadata: Metadata;
  body: string;
}

/** Opening and closing line of a frontmatter block (gray-matter's default). */
const FRONTMATTER_DELIMITER = "---";

/** gray-matter closes a block at the first line that starts with the delimiter. */
const FRONTMATTER_CLOSING = `\n${FRONTMATTER_DELIMITER}`;

/** Languages accepted after the opening delimiter. An empty name means YAML. */
const YAML_LANGUAGE_NAMES = new Set(["", "yaml", "yml"]);

function describeYamlValue(value: unknown): string {
  if (value === null) {
    return "an empty value";
  }
  if (Array.isArray(value)) {
    return "a list";
  }
  const description = `a single ${typeof value} value`;
  return description;
}

function isMapping(value: unknown): value is Metadata {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * gray-matter engine for YAML frontmatter. CORE_SCHEMA keeps metadata as plain
 * data: dates stay strings and tags such as `!!binary` or `!!js/*` are rejected.
 */
function parseFrontmatterYaml(text: string): Metadata {
  const frontmatter = load(text, { schema: CORE_SCHEMA });
  if (!isMapping(frontmatter)) {
    throw new Error(
      `frontmatter must be a mapping, found ${describeYamlValue(frontmatter)}`,
    );
  }
  return frontmatter;
}

/** Passing options also turns off gray-matter's shared cache, so results are never shared. */
const FRONTMATTER_OPTIONS = { engines: { yaml: parseFrontmatterYaml } };

/** Same opening rule as gray-matter: `---` at the very start, not followed by another `-`. */
function hasFrontmatter(content: string): boolean {
  const startsWithDelimiter = content.startsWith(FRONTMATTER_DELIMITER);
  const nextCharacter = content.charAt(FRONTMATTER_DELIMITER.length);
  return startsWithDelimiter && nextCharacter !== "-";
}

function checkFrontmatterIsYaml(file: FetchedFile): void {
  const languageName = matter.language(file.content).name.toLowerCase();
  if (!YAML_LANGUAGE_NAMES.has(languageName)) {
    throw new MarkdownParseError(
      file.source,
      `frontmatter must be YAML, found "${languageName}"`,
    );
  }
}

function checkFrontmatterIsClosed(file: FetchedFile): void {
  const closingIndex = file.content.indexOf(
    FRONTMATTER_CLOSING,
    FRONTMATTER_DELIMITER.length,
  );
  if (closingIndex === -1) {
    throw new MarkdownParseError(file.source, "frontmatter is not closed");
  }
}

function splitFrontmatter(file: FetchedFile): matter.GrayMatterFile<string> {
  try {
    const parsedFile = matter(file.content, FRONTMATTER_OPTIONS);
    return parsedFile;
  } catch (error) {
    throw new MarkdownParseError(file.source, describeErrorCause(error), {
      cause: error,
    });
  }
}

/**
 * Parses markdown with YAML frontmatter into metadata and the unchanged body.
 * A file without frontmatter gives empty metadata and its whole text as body.
 * Raises `MarkdownParseError` for frontmatter that is not closed, not YAML,
 * not valid YAML or not a mapping.
 */
export function parseMarkdown(file: FetchedFile): ParsedMarkdown {
  if (!hasFrontmatter(file.content)) {
    const plainMarkdown: ParsedMarkdown = {
      source: file.source,
      metadata: {},
      body: file.content,
    };
    return plainMarkdown;
  }
  checkFrontmatterIsYaml(file);
  checkFrontmatterIsClosed(file);
  const parsedFile = splitFrontmatter(file);
  const parsedMarkdown: ParsedMarkdown = {
    source: file.source,
    metadata: parsedFile.data,
    body: parsedFile.content,
  };
  return parsedMarkdown;
}
