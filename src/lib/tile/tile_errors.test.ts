import { describe, expect, it } from "vitest";
import {
  describeErrorCause,
  FileFetchError,
  MarkdownParseError,
} from "./tile_errors.ts";

const SOURCE = "https://example.org/samples/tiles/books/kallocain.md";

describe("describeErrorCause", function describeDescribeErrorCause(): void {
  it("uses the message of an Error", function usesErrorMessage(): void {
    const description = describeErrorCause(new TypeError("Failed to fetch"));

    expect(description).toBe("Failed to fetch");
  });

  it("converts any other value to a string", function convertsOtherValue(): void {
    const description = describeErrorCause("offline");

    expect(description).toBe("offline");
  });
});

describe("FileFetchError", function describeFileFetchError(): void {
  it("is an Error named after its class", function isNamedError(): void {
    const error = new FileFetchError(SOURCE, "HTTP 404 Not Found");

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(FileFetchError);
    expect(error.name).toBe("FileFetchError");
  });

  it("exposes the source", function exposesSource(): void {
    const error = new FileFetchError(SOURCE, "HTTP 404 Not Found");

    expect(error.source).toBe(SOURCE);
  });

  it("builds the message from the source and the reason", function buildsMessage(): void {
    const error = new FileFetchError(SOURCE, "HTTP 404 Not Found");

    expect(error.message).toBe(
      `Cannot load file "${SOURCE}": HTTP 404 Not Found`,
    );
  });

  it("keeps the cause when given", function keepsCause(): void {
    const networkError = new TypeError("Failed to fetch");

    const error = new FileFetchError(SOURCE, "request failed", {
      cause: networkError,
    });

    expect(error.cause).toBe(networkError);
  });
});

describe("MarkdownParseError", function describeMarkdownParseError(): void {
  it("is an Error named after its class", function isNamedError(): void {
    const error = new MarkdownParseError(SOURCE, "frontmatter is not closed");

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(MarkdownParseError);
    expect(error.name).toBe("MarkdownParseError");
  });

  it("exposes the source", function exposesSource(): void {
    const error = new MarkdownParseError(SOURCE, "frontmatter is not closed");

    expect(error.source).toBe(SOURCE);
  });

  it("builds the message from the source and the reason", function buildsMessage(): void {
    const error = new MarkdownParseError(SOURCE, "frontmatter is not closed");

    expect(error.message).toBe(
      `Cannot parse markdown "${SOURCE}": frontmatter is not closed`,
    );
  });

  it("keeps the cause when given", function keepsCause(): void {
    const yamlError = new Error("duplicated mapping key");

    const error = new MarkdownParseError(SOURCE, yamlError.message, {
      cause: yamlError,
    });

    expect(error.cause).toBe(yamlError);
  });

  it("is distinguishable from FileFetchError", function isDistinguishable(): void {
    const error = new MarkdownParseError(SOURCE, "frontmatter is not closed");

    expect(error).not.toBeInstanceOf(FileFetchError);
  });
});
