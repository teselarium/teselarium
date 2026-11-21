import { afterEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import {
  fetchFixture,
  readFixtureText,
  FIXTURES_BASE_URL,
} from "../../test/sample_files.ts";
import { FileFetchError } from "./file_errors.ts";
import { fetchFile, resolveLocation } from "./file_fetcher.ts";
import type { BrowserFileReader } from "./browser_files.ts";
import { indexLocalFiles } from "./local_files.ts";
import type { LocalFiles } from "./local_files.ts";

const KALLOCAIN_PATH = "tiles/books/kallocain.md";
const KALLOCAIN_URL = `${FIXTURES_BASE_URL}${KALLOCAIN_PATH}`;

const REJECTED_REQUEST_HINT =
  "The site may be unreachable or may not allow this app to read its files.";

function returnFetchError(error: unknown): unknown {
  return error;
}

function createSampleFetch(): Mock<typeof fetch> {
  const sampleFetch = vi.fn<typeof fetch>(fetchFixture);
  return sampleFetch;
}

function createTextFetch(text: string): Mock<typeof fetch> {
  const textFetch = vi.fn<typeof fetch>().mockResolvedValue(new Response(text));
  return textFetch;
}

function pickLibraryFolder(): LocalFiles {
  const kallocainContent = new Blob([readFixtureText(KALLOCAIN_PATH)]);
  const localFiles = indexLocalFiles([
    { path: "library/books/kallocain.md", content: kallocainContent },
    { path: "library/my books/kallocain.md", content: kallocainContent },
  ]);
  return localFiles;
}

const STORED_MOSAIC_ADDRESS = "opentesela-browser:///r1/maps/nobel_map.yaml";

async function readStoredText(
  storedFiles: ReadonlyMap<string, string>,
  address: string,
): Promise<string | null> {
  const text = storedFiles.get(address) ?? null;
  return text;
}

function createStoredFileReader(
  storedFiles: ReadonlyMap<string, string>,
): BrowserFileReader {
  const reader: BrowserFileReader = {
    readText: readStoredText.bind(undefined, storedFiles),
  };
  return reader;
}

function storeNobelMap(): BrowserFileReader {
  const storedFiles = new Map<string, string>([
    [STORED_MOSAIC_ADDRESS, "title: Nobel map\n"],
    ["opentesela-browser:///r1/tiles/laureates/collection.yaml", "title: L\n"],
  ]);
  const reader = createStoredFileReader(storedFiles);
  return reader;
}

describe("resolveLocation", function describeResolveLocation(): void {
  it("Relative path with a base URL", function resolvesRelativePath(): void {
    const url = resolveLocation(
      "./tiles/books/kallocain.md",
      FIXTURES_BASE_URL,
    );

    expect(url.href).toBe(KALLOCAIN_URL);
  });

  it("Path with dot segments", function removesDotSegments(): void {
    const url = resolveLocation(
      "./tiles/../tiles/books/kallocain.md",
      FIXTURES_BASE_URL,
    );

    expect(url.href).toBe(KALLOCAIN_URL);
  });

  it("Absolute URL ignores the base URL", function keepsAbsoluteUrl(): void {
    const url = resolveLocation(
      "https://other.example/books/kallocain.md",
      FIXTURES_BASE_URL,
    );

    expect(url.href).toBe("https://other.example/books/kallocain.md");
  });

  it("Relative path without any base", function rejectsMissingBase(): void {
    expect(function resolveWithoutBase(): URL {
      return resolveLocation("books/kallocain.md", undefined);
    }).toThrowError(FileFetchError);
    expect(function resolveWithoutBase(): URL {
      return resolveLocation("books/kallocain.md", undefined);
    }).toThrowError(/books\/kallocain\.md.*base URL is required/);
  });

  it("Invalid URL", function rejectsInvalidUrl(): void {
    expect(function resolveInvalidUrl(): URL {
      return resolveLocation("https://[bad/kallocain.md", FIXTURES_BASE_URL);
    }).toThrowError(FileFetchError);
    expect(function resolveInvalidUrl(): URL {
      return resolveLocation("https://[bad/kallocain.md", FIXTURES_BASE_URL);
    }).toThrowError("https://[bad/kallocain.md");
  });
});

describe("fetchFile", function describeFetchFile(): void {
  afterEach(function restoreGlobals(): void {
    vi.unstubAllGlobals();
  });

  it("Load a sample tile", async function fetchesSample(): Promise<void> {
    const sampleFetch = createSampleFetch();

    const fetchedFile = await fetchFile(KALLOCAIN_URL, { fetch: sampleFetch });

    expect(fetchedFile).toEqual({
      source: KALLOCAIN_URL,
      content: readFixtureText(KALLOCAIN_PATH),
    });
  });

  it("calls the fetch function as a plain function", async function callsFetchWithoutThis(): Promise<void> {
    const sampleFetch = createSampleFetch();

    await fetchFile(KALLOCAIN_URL, { fetch: sampleFetch });

    expect(sampleFetch.mock.contexts).toEqual([undefined]);
  });

  it("Relative path with a base URL", async function fetchesResolvedUrl(): Promise<void> {
    const sampleFetch = createSampleFetch();

    const fetchedFile = await fetchFile("./tiles/books/kallocain.md", {
      baseUrl: FIXTURES_BASE_URL,
      fetch: sampleFetch,
    });

    expect(sampleFetch).toHaveBeenCalledExactlyOnceWith(KALLOCAIN_URL);
    expect(fetchedFile.source).toBe(KALLOCAIN_URL);
  });

  it("Path with dot segments", async function fetchesNormalizedUrl(): Promise<void> {
    const sampleFetch = createSampleFetch();

    const fetchedFile = await fetchFile("./tiles/../tiles/books/kallocain.md", {
      baseUrl: FIXTURES_BASE_URL,
      fetch: sampleFetch,
    });

    expect(fetchedFile.source).toBe(KALLOCAIN_URL);
  });

  it("Absolute URL ignores the base URL", async function fetchesAbsoluteUrl(): Promise<void> {
    const textFetch = createTextFetch("# Kallocain\n");

    const fetchedFile = await fetchFile(
      "https://other.example/books/kallocain.md",
      { baseUrl: FIXTURES_BASE_URL, fetch: textFetch },
    );

    expect(textFetch).toHaveBeenCalledExactlyOnceWith(
      "https://other.example/books/kallocain.md",
    );
    expect(fetchedFile.source).toBe("https://other.example/books/kallocain.md");
  });

  it("No base URL in a page", async function usesDocumentBaseUrl(): Promise<void> {
    vi.stubGlobal("document", { baseURI: "https://example.org/app/" });
    const textFetch = createTextFetch("# Kallocain\n");

    const fetchedFile = await fetchFile("books/kallocain.md", {
      fetch: textFetch,
    });

    expect(textFetch).toHaveBeenCalledExactlyOnceWith(
      "https://example.org/app/books/kallocain.md",
    );
    expect(fetchedFile.source).toBe(
      "https://example.org/app/books/kallocain.md",
    );
  });

  it("Relative path without any base", async function rejectsMissingBase(): Promise<void> {
    const sampleFetch = createSampleFetch();

    const fetching = fetchFile("books/kallocain.md", { fetch: sampleFetch });

    await expect(fetching).rejects.toBeInstanceOf(FileFetchError);
    await expect(fetching).rejects.toThrowError(
      /books\/kallocain\.md.*base URL is required/,
    );
    expect(sampleFetch).not.toHaveBeenCalled();
  });

  it("Invalid URL", async function rejectsInvalidUrl(): Promise<void> {
    const sampleFetch = createSampleFetch();

    const fetching = fetchFile("https://[bad/kallocain.md", {
      fetch: sampleFetch,
    });

    await expect(fetching).rejects.toBeInstanceOf(FileFetchError);
    await expect(fetching).rejects.toThrowError("https://[bad/kallocain.md");
    expect(sampleFetch).not.toHaveBeenCalled();
  });

  it("HTTP 404", async function rejectsHttpError(): Promise<void> {
    const missingUrl = `${FIXTURES_BASE_URL}tiles/missing.md`;

    const fetching = fetchFile(missingUrl, { fetch: fetchFixture });

    await expect(fetching).rejects.toBeInstanceOf(FileFetchError);
    await expect(fetching).rejects.toMatchObject({
      source: missingUrl,
      message: expect.stringContaining(missingUrl),
    });
    await expect(fetching).rejects.toThrowError("404");
  });

  it("Network failure", async function rejectsNetworkFailure(): Promise<void> {
    const networkError = new TypeError("Failed to fetch");
    const failingFetch = vi.fn<typeof fetch>().mockRejectedValue(networkError);

    const fetching = fetchFile(KALLOCAIN_URL, { fetch: failingFetch });

    await expect(fetching).rejects.toBeInstanceOf(FileFetchError);
    await expect(fetching).rejects.toMatchObject({
      source: KALLOCAIN_URL,
      message: expect.stringContaining(KALLOCAIN_URL),
      cause: networkError,
    });
  });

  it("Hint for a rejected request", async function hintsRejectedRequest(): Promise<void> {
    const collectionUrl = "https://tiles.example.net/books.yaml";
    const corsError = new TypeError("Failed to fetch");
    const failingFetch = vi.fn<typeof fetch>().mockRejectedValue(corsError);

    const fetching = fetchFile(collectionUrl, { fetch: failingFetch });

    await expect(fetching).rejects.toThrowError(
      `Cannot load file "${collectionUrl}": the request failed: Failed to fetch. ${REJECTED_REQUEST_HINT}`,
    );
  });

  it("No hint for an HTTP status", async function omitsHintForHttpStatus(): Promise<void> {
    const missingUrl = `${FIXTURES_BASE_URL}tiles/missing.md`;

    const error = await fetchFile(missingUrl, { fetch: fetchFixture }).catch(
      returnFetchError,
    );

    expect(String(error)).toContain("404");
    expect(String(error)).not.toContain(
      "may not allow this app to read its files",
    );
  });

  it("wraps a failure while reading the response body", async function rejectsUnreadableBody(): Promise<void> {
    const readError = new TypeError("Body stream was aborted");
    const unreadableResponse = {
      ok: true,
      status: 200,
      statusText: "OK",
      text: vi.fn<Response["text"]>().mockRejectedValue(readError),
    };
    const unreadableFetch = vi
      .fn<typeof fetch>()
      .mockResolvedValue(unreadableResponse as unknown as Response);

    const fetching = fetchFile(KALLOCAIN_URL, { fetch: unreadableFetch });

    await expect(fetching).rejects.toBeInstanceOf(FileFetchError);
    await expect(fetching).rejects.toMatchObject({
      source: KALLOCAIN_URL,
      message: expect.stringContaining(KALLOCAIN_URL),
      cause: readError,
    });
  });

  it("Load from a picked folder", async function readsPickedFile(): Promise<void> {
    const sampleFetch = createSampleFetch();

    const fetchedFile = await fetchFile("file:///library/books/kallocain.md", {
      fetch: sampleFetch,
      localFiles: pickLibraryFolder(),
    });

    expect(fetchedFile).toEqual({
      source: "file:///library/books/kallocain.md",
      content: readFixtureText(KALLOCAIN_PATH),
    });
    expect(sampleFetch).not.toHaveBeenCalled();
  });

  it("Relative path inside the picked folder", async function resolvesInsidePickedFolder(): Promise<void> {
    const sampleFetch = createSampleFetch();

    const fetchedFile = await fetchFile("./books/kallocain.md", {
      baseUrl: "file:///library/",
      fetch: sampleFetch,
      localFiles: pickLibraryFolder(),
    });

    expect(fetchedFile.source).toBe("file:///library/books/kallocain.md");
    expect(sampleFetch).not.toHaveBeenCalled();
  });

  it("Picked path with spaces", async function resolvesPathWithSpaces(): Promise<void> {
    const sampleFetch = createSampleFetch();

    const fetchedFile = await fetchFile("./my books/kallocain.md", {
      baseUrl: "file:///library/",
      fetch: sampleFetch,
      localFiles: pickLibraryFolder(),
    });

    expect(fetchedFile.source).toBe("file:///library/my%20books/kallocain.md");
    expect(fetchedFile.content).toBe(readFixtureText(KALLOCAIN_PATH));
    expect(sampleFetch).not.toHaveBeenCalled();
  });

  it("File was not picked", async function rejectsFileNotPicked(): Promise<void> {
    const sampleFetch = createSampleFetch();

    const fetching = fetchFile("file:///library/books/missing.md", {
      fetch: sampleFetch,
      localFiles: pickLibraryFolder(),
    });

    await expect(fetching).rejects.toBeInstanceOf(FileFetchError);
    await expect(fetching).rejects.toMatchObject({
      source: "file:///library/books/missing.md",
      message: expect.stringContaining("not among the picked files"),
    });
    expect(sampleFetch).not.toHaveBeenCalled();
  });

  it("No picked files", async function rejectsWithoutPickedFiles(): Promise<void> {
    const sampleFetch = createSampleFetch();

    const fetching = fetchFile("file:///library/books/kallocain.md", {
      fetch: sampleFetch,
    });

    await expect(fetching).rejects.toBeInstanceOf(FileFetchError);
    await expect(fetching).rejects.toThrowError(
      "file:///library/books/kallocain.md",
    );
    expect(sampleFetch).not.toHaveBeenCalled();
  });

  it("Load a stored file", async function readsStoredFile(): Promise<void> {
    const sampleFetch = createSampleFetch();

    const fetchedFile = await fetchFile(STORED_MOSAIC_ADDRESS, {
      fetch: sampleFetch,
      browserFiles: storeNobelMap(),
    });

    expect(fetchedFile).toEqual({
      source: STORED_MOSAIC_ADDRESS,
      content: "title: Nobel map\n",
    });
    expect(sampleFetch).not.toHaveBeenCalled();
  });

  it("Relative path against a stored file", async function resolvesInsideStore(): Promise<void> {
    const sampleFetch = createSampleFetch();

    const fetchedFile = await fetchFile("../tiles/laureates/collection.yaml", {
      baseUrl: STORED_MOSAIC_ADDRESS,
      fetch: sampleFetch,
      browserFiles: storeNobelMap(),
    });

    expect(fetchedFile.source).toBe(
      "opentesela-browser:///r1/tiles/laureates/collection.yaml",
    );
    expect(sampleFetch).not.toHaveBeenCalled();
  });

  it("File is not stored", async function rejectsMissingStoredFile(): Promise<void> {
    const sampleFetch = createSampleFetch();
    const missingAddress = "opentesela-browser:///r1/poets.yaml";

    const fetching = fetchFile(missingAddress, {
      fetch: sampleFetch,
      browserFiles: storeNobelMap(),
    });

    await expect(fetching).rejects.toBeInstanceOf(FileFetchError);
    await expect(fetching).rejects.toThrowError(
      `Cannot load file "${missingAddress}": it is not stored in this browser`,
    );
    expect(sampleFetch).not.toHaveBeenCalled();
  });

  it("No browser files reader", async function rejectsWithoutReader(): Promise<void> {
    const sampleFetch = createSampleFetch();

    const fetching = fetchFile(STORED_MOSAIC_ADDRESS, { fetch: sampleFetch });

    await expect(fetching).rejects.toMatchObject({
      source: STORED_MOSAIC_ADDRESS,
      message: expect.stringContaining("it is not stored in this browser"),
    });
    expect(sampleFetch).not.toHaveBeenCalled();
  });
});
