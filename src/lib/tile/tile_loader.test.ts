import { describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import {
  fetchSample,
  readSampleText,
  SAMPLES_BASE_URL,
} from "../../test/sample_files.ts";
import {
  FileFetchError,
  indexLocalFiles,
  MarkdownParseError,
} from "../files/index.ts";
import * as tileModule from "./index.ts";
import { loadTile } from "./index.ts";
import type { Tile } from "./index.ts";

const KALLOCAIN_PATH = "tiles/books/kallocain.md";
const KALLOCAIN_URL = `${SAMPLES_BASE_URL}${KALLOCAIN_PATH}`;

function createSampleFetch(): Mock<typeof fetch> {
  const sampleFetch = vi.fn<typeof fetch>(fetchSample);
  return sampleFetch;
}

function catchLoadError(loading: Promise<Tile>): Promise<unknown> {
  return loading.then(failOnLoadedTile, returnLoadError);
}

function failOnLoadedTile(tile: Tile): never {
  throw new Error(`Expected loading "${tile.source}" to fail, but it passed`);
}

function returnLoadError(error: unknown): unknown {
  return error;
}

describe("loadTile", function describeLoadTile(): void {
  it("Load a sample tile", async function loadsSampleTile(): Promise<void> {
    const tile = await loadTile(KALLOCAIN_URL, { fetch: fetchSample });

    expect(Object.keys(tile).sort()).toEqual([
      "body",
      "metadata",
      "source",
      "types",
    ]);
    expect(tile.source).toBe(KALLOCAIN_URL);
    expect(tile.metadata.title).toBe("Kallocain");
    expect(tile.metadata.authors).toEqual(["Karin Boye"]);
    expect(tile.metadata.pages).toBe(220);
    expect(tile.types).toEqual([]);
  });

  it("Relative path with a base URL", async function loadsRelativePath(): Promise<void> {
    const sampleFetch = createSampleFetch();

    const tile = await loadTile("./tiles/books/kallocain.md", {
      baseUrl: SAMPLES_BASE_URL,
      fetch: sampleFetch,
    });

    expect(sampleFetch).toHaveBeenCalledExactlyOnceWith(KALLOCAIN_URL);
    expect(tile.source).toBe(KALLOCAIN_URL);
  });

  it("Load from a picked folder", async function loadsPickedFile(): Promise<void> {
    const sampleFetch = createSampleFetch();
    const localFiles = indexLocalFiles([
      {
        path: "library/books/kallocain.md",
        content: new Blob([readSampleText(KALLOCAIN_PATH)]),
      },
    ]);

    const tile = await loadTile("file:///library/books/kallocain.md", {
      fetch: sampleFetch,
      localFiles,
    });

    expect(tile.source).toBe("file:///library/books/kallocain.md");
    expect(tile.metadata.title).toBe("Kallocain");
    expect(sampleFetch).not.toHaveBeenCalled();
  });

  it("Caller tells the failures apart", async function distinguishesFailures(): Promise<void> {
    const missingUrl = `${SAMPLES_BASE_URL}tiles/missing.md`;
    const badUrl = "https://example.org/bad.md";
    const badFetch = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('---\ntitle: "unterminated\n---\n'));

    const missingError = await catchLoadError(
      loadTile(missingUrl, { fetch: fetchSample }),
    );
    const badError = await catchLoadError(
      loadTile(badUrl, { fetch: badFetch }),
    );

    expect(missingError).toBeInstanceOf(FileFetchError);
    expect(missingError).not.toBeInstanceOf(MarkdownParseError);
    expect(missingError).toMatchObject({ source: missingUrl });
    expect(badError).toBeInstanceOf(MarkdownParseError);
    expect(badError).not.toBeInstanceOf(FileFetchError);
    expect(badError).toMatchObject({ source: badUrl });
  });

  it("Structured clone of a tile", async function clonesTile(): Promise<void> {
    const tile = await loadTile(KALLOCAIN_URL, { fetch: fetchSample });

    const clonedTile = structuredClone(tile);

    expect(clonedTile).toStrictEqual(tile);
  });

  it("Same file loaded twice", async function loadsIndependentTiles(): Promise<void> {
    const firstTile = await loadTile(KALLOCAIN_URL, { fetch: fetchSample });
    const secondTile = await loadTile(KALLOCAIN_URL, { fetch: fetchSample });

    firstTile.metadata.title = "Changed";

    expect(secondTile.metadata.title).toBe("Kallocain");
  });
});

describe("tile module entry point", function describeEntryPoint(): void {
  it("exports the public API", function exportsPublicApi(): void {
    expect(Object.keys(tileModule).sort()).toEqual([
      "CollectionFormatError",
      "TileTypeError",
      "TileValidationError",
      "buildTileValidator",
      "loadTile",
      "loadTileCollection",
      "validateTile",
      "validateTileCollection",
    ]);
  });
});
