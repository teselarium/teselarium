import { describe, expect, it, vi } from "vitest";
import { indexLocalFiles, readLocalFile } from "./local_files.ts";
import { FileFetchError } from "./tile_errors.ts";

const KALLOCAIN_URL = new URL("file:///library/books/kallocain.md");

describe("indexLocalFiles", function describeIndexLocalFiles(): void {
  it("keys a picked path as its file:/// URL", function keysPickedPath(): void {
    const content = new Blob(["Kallocain"]);

    const localFiles = indexLocalFiles([
      { path: "library/books/kallocain.md", content },
    ]);

    expect([...localFiles.keys()]).toEqual([
      "file:///library/books/kallocain.md",
    ]);
    expect(localFiles.get("file:///library/books/kallocain.md")).toBe(content);
  });

  it("Picked path with a leading slash", function keysLeadingSlash(): void {
    const content = new Blob(["Kallocain"]);

    const localFiles = indexLocalFiles([
      { path: "/library/books/kallocain.md", content },
    ]);

    expect(localFiles.get("file:///library/books/kallocain.md")).toBe(content);
  });

  it("Picked path with spaces", function keysPathWithSpaces(): void {
    const content = new Blob(["Kallocain"]);

    const localFiles = indexLocalFiles([
      { path: "library/my books/kallocain.md", content },
    ]);

    expect(localFiles.get("file:///library/my%20books/kallocain.md")).toBe(
      content,
    );
  });

  it("keeps the later file when a path repeats", function keepsLaterFile(): void {
    const earlierContent = new Blob(["earlier"]);
    const laterContent = new Blob(["later"]);

    const localFiles = indexLocalFiles([
      { path: "library/books/kallocain.md", content: earlierContent },
      { path: "/library/books/kallocain.md", content: laterContent },
    ]);

    expect(localFiles.size).toBe(1);
    expect(localFiles.get("file:///library/books/kallocain.md")).toBe(
      laterContent,
    );
  });
});

describe("readLocalFile", function describeReadLocalFile(): void {
  it("returns the text of a picked file", async function readsPickedFile(): Promise<void> {
    const localFiles = indexLocalFiles([
      { path: "library/books/kallocain.md", content: new Blob(["Kallocain"]) },
    ]);

    const text = await readLocalFile(KALLOCAIN_URL, localFiles);

    expect(text).toBe("Kallocain");
  });

  it("File was not picked", async function rejectsFileNotPicked(): Promise<void> {
    const localFiles = indexLocalFiles([
      { path: "library/books/kallocain.md", content: new Blob(["Kallocain"]) },
    ]);
    const missingUrl = new URL("file:///library/books/missing.md");

    const reading = readLocalFile(missingUrl, localFiles);

    await expect(reading).rejects.toBeInstanceOf(FileFetchError);
    await expect(reading).rejects.toMatchObject({
      source: "file:///library/books/missing.md",
      message: expect.stringContaining("not among the picked files"),
    });
  });

  it("No picked files", async function rejectsWithoutLocalFiles(): Promise<void> {
    const reading = readLocalFile(KALLOCAIN_URL, undefined);

    await expect(reading).rejects.toBeInstanceOf(FileFetchError);
    await expect(reading).rejects.toMatchObject({
      source: "file:///library/books/kallocain.md",
      message: expect.stringContaining("file:///library/books/kallocain.md"),
    });
  });

  it("Picked file can no longer be read", async function rejectsUnreadableFile(): Promise<void> {
    const readError = new DOMException("File was removed", "NotFoundError");
    const unreadableFile = {
      text: vi.fn<Blob["text"]>().mockRejectedValue(readError),
    };
    const localFiles = indexLocalFiles([
      {
        path: "library/books/kallocain.md",
        content: unreadableFile as unknown as Blob,
      },
    ]);

    const reading = readLocalFile(KALLOCAIN_URL, localFiles);

    await expect(reading).rejects.toBeInstanceOf(FileFetchError);
    await expect(reading).rejects.toMatchObject({
      source: "file:///library/books/kallocain.md",
      message: expect.stringContaining("file:///library/books/kallocain.md"),
      cause: readError,
    });
  });
});
