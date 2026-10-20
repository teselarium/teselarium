import { describeErrorCause, YamlParseError } from "./file_errors.ts";
import { CORE_SCHEMA, load } from "js-yaml";
import type { FetchedFile } from "./file_fetcher.ts";

/** A YAML value: plain data only, so parsed files can be structured-cloned. */
export type YamlValue =
  string | number | boolean | null | YamlValue[] | { [key: string]: YamlValue };

/** A YAML mapping, the top level of every OpenTesela YAML file. */
export type YamlMapping = { [key: string]: YamlValue };

/** A YAML file parsed into its content. `source` is the file it was read from. */
export interface ParsedYaml {
  source: string;
  content: YamlMapping;
}

/**
 * Reads a single YAML document as plain data. CORE_SCHEMA keeps dates as
 * strings and rejects tags such as `!!binary` or `!!js/*`. js-yaml errors
 * are passed through unchanged.
 */
export function readPlainYaml(text: string): YamlValue {
  const value = load(text, { schema: CORE_SCHEMA }) as YamlValue;
  return value;
}

export function isYamlMapping(value: unknown): value is YamlMapping {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Describes a YAML value that is not a mapping, for error messages. */
export function describeYamlValue(value: unknown): string {
  if (value === null) {
    return "an empty value";
  }
  if (Array.isArray(value)) {
    return "a list";
  }
  const description = `a single ${typeof value} value`;
  return description;
}

function readYamlFile(file: FetchedFile): YamlValue {
  try {
    const value = readPlainYaml(file.content);
    return value;
  } catch (error) {
    throw new YamlParseError(file.source, describeErrorCause(error), {
      cause: error,
    });
  }
}

/**
 * Parses a YAML file whose top level is a mapping. Raises `YamlParseError` for
 * an empty file, invalid YAML, several documents, repeated keys, tags for other
 * value types or a top level that is not a mapping.
 */
export function parseYaml(file: FetchedFile): ParsedYaml {
  const content = readYamlFile(file);
  if (!isYamlMapping(content)) {
    throw new YamlParseError(
      file.source,
      `YAML must be a mapping, found ${describeYamlValue(content)}`,
    );
  }
  const parsedYaml: ParsedYaml = { source: file.source, content };
  return parsedYaml;
}
