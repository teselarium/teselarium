import { describe, expect, it } from "vitest";
import {
  buildAskingContext,
  catchMethodError,
} from "../../../test/method_contexts.ts";
import { MAX_SAVE_BYTES } from "./app_actions.ts";
import type { SaveFileAction } from "./app_actions.ts";
import { FILES_METHODS, readSaveFile } from "./files_methods.ts";
import { INVALID_PARAMS, PERMISSION_DENIED } from "./mod_messages.ts";
import type { ModMethodContext } from "./mod_methods.ts";

function saveFile(context: ModMethodContext, params: object): Promise<unknown> {
  return FILES_METHODS["files.save"](context, params as never);
}

function readSave(params: object): SaveFileAction {
  return readSaveFile(params as never);
}

function catchSaveError(params: object): ReturnType<typeof catchMethodError> {
  return catchMethodError(readSave.bind(undefined, params));
}

describe("readSaveFile", function describeReadSaveFile(): void {
  it("Name with a path", async function rejectsPath(): Promise<void> {
    const error = await catchSaveError({ name: "../books.csv", content: "x" });

    expect(error.code).toBe(INVALID_PARAMS);
    expect(error.message).toBe(
      'files.save: "name" must be a file name without a path',
    );
  });

  it("File too large", async function rejectsLargeText(): Promise<void> {
    const error = await catchSaveError({
      name: "big.txt",
      content: "a".repeat(MAX_SAVE_BYTES + 1),
    });

    expect(error.code).toBe(INVALID_PARAMS);
    expect(error.message).toBe("files.save: the file is larger than 20 MB");
  });

  it("Broken base64", async function rejectsBrokenBase64(): Promise<void> {
    const error = await catchSaveError({
      name: "a.bin",
      content: "%%%",
      encoding: "base64",
    });

    expect(error.code).toBe(INVALID_PARAMS);
    expect(error.message).toBe('files.save: "content" is not valid base64');
  });

  it("rejects base64 whose length is not a multiple of 4", async function rejectsShortBase64(): Promise<void> {
    const error = await catchSaveError({
      name: "a.bin",
      content: "iVBORw0KGgo",
      encoding: "base64",
    });

    expect(error.message).toBe('files.save: "content" is not valid base64');
  });

  it("rejects text whose UTF-8 bytes are larger than 20 MB", async function rejectsLargeUtf8(): Promise<void> {
    const error = await catchSaveError({
      name: "big.txt",
      content: "é".repeat(MAX_SAVE_BYTES / 2 + 1),
    });

    expect(error.message).toBe("files.save: the file is larger than 20 MB");
  });

  it("rejects base64 that decodes to more than 20 MB", async function rejectsLargeBase64(): Promise<void> {
    const error = await catchSaveError({
      name: "big.bin",
      content: "AAAA".repeat(MAX_SAVE_BYTES / 3 + 1),
      encoding: "base64",
    });

    expect(error.message).toBe("files.save: the file is larger than 20 MB");
  });

  it("accepts a file of exactly 20 MB", function acceptsLimit(): void {
    const action = readSave({
      name: "big.txt",
      content: "a".repeat(MAX_SAVE_BYTES),
    });

    expect(action.bytes).toHaveLength(MAX_SAVE_BYTES);
  });

  it("rejects each name that is not a file name", async function rejectsNames(): Promise<void> {
    const names = ["", "a".repeat(256), ".", "..", "a\\b", "a/b", "a\u0001b"];
    for (const name of names) {
      const error = await catchSaveError({ name, content: "x" });

      expect(error.code).toBe(INVALID_PARAMS);
      expect(error.message).toMatch(/^files\.save: "name" must /);
    }
  });

  it("names the problem of each rejected name", async function describesNames(): Promise<void> {
    const messages = {
      "": 'files.save: "name" must be a non-empty string',
      ["a".repeat(256)]:
        'files.save: "name" must be at most 255 characters long',
      ".": 'files.save: "name" must be a file name without a path',
      "a\\b": 'files.save: "name" must be a file name without a path',
      "a\u007fb": 'files.save: "name" must not hold control characters',
    };
    for (const [name, message] of Object.entries(messages)) {
      const error = await catchSaveError({ name, content: "x" });

      expect(error.message).toBe(message);
    }
  });

  it("accepts a name of 255 characters", function acceptsLongName(): void {
    const name = "a".repeat(255);

    expect(readSave({ name, content: "x" }).name).toBe(name);
  });

  it("rejects content that is not a string", async function rejectsContent(): Promise<void> {
    const error = await catchSaveError({ name: "a.txt", content: [1, 2] });

    expect(error.code).toBe(INVALID_PARAMS);
    expect(error.message).toBe('files.save: "content" must be a string');
  });

  it("rejects a wrong encoding", async function rejectsEncoding(): Promise<void> {
    const error = await catchSaveError({
      name: "a.txt",
      content: "x",
      encoding: "utf-16",
    });

    expect(error.code).toBe(INVALID_PARAMS);
    expect(error.message).toBe(
      'files.save: "encoding" must be "text" or "base64"',
    );
  });

  it("rejects a wrong type", async function rejectsType(): Promise<void> {
    for (const type of [
      "csv",
      "text/csv; charset=utf 8",
      "text/\ncsv",
      3,
      "",
    ]) {
      const error = await catchSaveError({ name: "a.txt", content: "x", type });

      expect(error.code).toBe(INVALID_PARAMS);
      expect(error.message).toBe(
        'files.save: "type" must be a media type such as "text/csv"',
      );
    }
  });

  it("keeps a given type", function keepsType(): void {
    const action = readSave({
      name: "books.csv",
      content: "title\n",
      type: "text/csv;charset=utf-8",
    });

    expect(action.type).toBe("text/csv;charset=utf-8");
  });

  it("defaults the type to text/plain for text", function defaultsTextType(): void {
    expect(readSave({ name: "a.txt", content: "x" }).type).toBe("text/plain");
    expect(
      readSave({ name: "a.txt", content: "x", encoding: "text" }).type,
    ).toBe("text/plain");
  });

  it("defaults the type to application/octet-stream for base64", function defaultsBinaryType(): void {
    const action = readSave({
      name: "a.bin",
      content: "AAEC",
      encoding: "base64",
    });

    expect(action.type).toBe("application/octet-stream");
  });

  it("encodes text as UTF-8", function encodesUtf8(): void {
    const action = readSave({ name: "a.txt", content: "é\n" });

    expect(action).toEqual({
      kind: "save",
      name: "a.txt",
      type: "text/plain",
      bytes: new Uint8Array([0xc3, 0xa9, 0x0a]),
    });
  });

  it("decodes base64", function decodesBase64(): void {
    const action = readSave({
      name: "cover.png",
      content: "iVBORw0KGgo=",
      encoding: "base64",
      type: "image/png",
    });

    expect(action.bytes).toEqual(
      new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
  });

  it("accepts empty content", function acceptsEmpty(): void {
    expect(readSave({ name: "a.txt", content: "" }).bytes).toHaveLength(0);
    expect(
      readSave({ name: "a.bin", content: "", encoding: "base64" }).bytes,
    ).toHaveLength(0);
  });
});

describe("files.save", function describeFilesSave(): void {
  it("asks the user to save the decoded file", async function asksUser(): Promise<void> {
    const { context, requestSpy } = buildAskingContext(true);

    const result = await saveFile(context, {
      name: "books.csv",
      content: "title\nKallocain\n",
      type: "text/csv",
    });

    expect(result).toBe(true);
    expect(requestSpy).toHaveBeenCalledExactlyOnceWith({
      kind: "save",
      name: "books.csv",
      type: "text/csv",
      bytes: new TextEncoder().encode("title\nKallocain\n"),
    });
  });

  it("answers false when the user cancels", async function answersCancel(): Promise<void> {
    const { context } = buildAskingContext(false);

    const result = await saveFile(context, { name: "a.txt", content: "x" });

    expect(result).toBe(false);
  });

  it("answers -32002 for a hidden mod", async function refusesHidden(): Promise<void> {
    const { context } = buildAskingContext(null);

    const error = await catchMethodError(
      saveFile.bind(undefined, context, { name: "a.txt", content: "x" }),
    );

    expect(error.code).toBe(PERMISSION_DENIED);
    expect(error.message).toBe(
      "files.save: only the visible mod can ask the user",
    );
  });

  it("shows no dialog for wrong params", async function asksNothing(): Promise<void> {
    const { context, requestSpy } = buildAskingContext(true);

    await catchMethodError(
      saveFile.bind(undefined, context, { name: "../a.txt", content: "x" }),
    );

    expect(requestSpy).not.toHaveBeenCalled();
  });
});
