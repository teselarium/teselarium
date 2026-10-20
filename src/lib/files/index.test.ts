import { describe, expect, it } from "vitest";
import * as filesModule from "./index.ts";

describe("files module", function describeFilesModule(): void {
  it("exports the public API", function exportsPublicApi(): void {
    expect(Object.keys(filesModule).sort()).toEqual([
      "FileFetchError",
      "MarkdownParseError",
      "YamlParseError",
      "describeYamlValue",
      "fetchFile",
      "indexLocalFiles",
      "isYamlMapping",
      "parseMarkdown",
      "parseYaml",
      "resolveLocation",
    ]);
  });
});
