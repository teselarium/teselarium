import matter from "@11ty/gray-matter";
import Ajv from "ajv/dist/jtd";
import { load } from "js-yaml";
import { describe, expect, it } from "vitest";
import { readFixtureText } from "../../test/sample_files.ts";

interface CollectionFile {
  collection: {
    name: string;
    tiles: { path: string }[];
  };
}

describe("tile module dependencies", function describeDependencies(): void {
  it("gray-matter parses a tile into metadata and body", function parsesTile(): void {
    const tile = matter(readFixtureText("tiles/books/kallocain.md"));

    expect(tile.data.title).toBe("Kallocain");
    expect(tile.content.trimStart()).toMatch(/^Kallocain is a 1940/);
  });

  it("js-yaml parses a collection file", function parsesCollection(): void {
    const collectionFile = load(
      readFixtureText("tiles/books_collection.yaml"),
    ) as CollectionFile;

    expect(collectionFile.collection.name).toBe("Science fiction books");
    expect(collectionFile.collection.tiles).toHaveLength(3);
  });

  it("Ajv JTD compiles a type schema and accepts tile metadata", function validatesTile(): void {
    const bookType = matter(readFixtureText("types/book.md"));
    const tile = matter(readFixtureText("tiles/books/kallocain.md"));
    const ajv = new Ajv();

    const validateBook = ajv.compile(bookType.data.schema);

    expect(validateBook(tile.data)).toBe(true);
  });
});
