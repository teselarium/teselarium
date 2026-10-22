import type { YamlMapping } from "../../files/index.ts";
import { MAX_SAVE_BYTES } from "./app_actions.ts";
import type { SaveFileAction } from "./app_actions.ts";
import {
  askUser,
  readRequiredText,
  throwInvalidParams,
} from "./mod_methods.ts";
import type { ModMethodContext, ModMethodTable } from "./mod_methods.ts";

const MAX_NAME_LENGTH = 255;

const CONTROL_CHARACTER = /\p{Cc}/u;

/** Has a `/`, and no spaces or control characters. */
const MEDIA_TYPE = /^[^\s\p{Cc}]*\/[^\s\p{Cc}]*$/u;

const BASE64 = /^[A-Za-z0-9+/]*={0,2}$/;

function readFileName(params: YamlMapping): string {
  const name = readRequiredText(params, "name", "files.save");
  if (name.length > MAX_NAME_LENGTH) {
    throwInvalidParams(
      "files.save",
      `"name" must be at most ${MAX_NAME_LENGTH} characters long`,
    );
  }
  if (
    name === "." ||
    name === ".." ||
    name.includes("/") ||
    name.includes("\\")
  ) {
    throwInvalidParams(
      "files.save",
      '"name" must be a file name without a path',
    );
  }
  if (CONTROL_CHARACTER.test(name)) {
    throwInvalidParams("files.save", '"name" must not hold control characters');
  }
  return name;
}

function readEncoding(params: YamlMapping): "text" | "base64" {
  const encoding = params.encoding;
  if (encoding === undefined || encoding === "text") {
    return "text";
  }
  if (encoding !== "base64") {
    throwInvalidParams("files.save", '"encoding" must be "text" or "base64"');
  }
  return encoding;
}

function readFileType(
  params: YamlMapping,
  encoding: "text" | "base64",
): string {
  const type = params.type;
  if (type === undefined) {
    return encoding === "text" ? "text/plain" : "application/octet-stream";
  }
  if (typeof type !== "string" || !MEDIA_TYPE.test(type)) {
    throwInvalidParams(
      "files.save",
      '"type" must be a media type such as "text/csv"',
    );
  }
  return type;
}

function throwTooLarge(): never {
  throwInvalidParams("files.save", "the file is larger than 20 MB");
}

function encodeText(content: string): Uint8Array<ArrayBuffer> {
  // UTF-8 never takes fewer bytes than UTF-16 code units, so a longer string is too large.
  if (content.length > MAX_SAVE_BYTES) {
    throwTooLarge();
  }
  return new TextEncoder().encode(content);
}

function countPadding(content: string): number {
  if (content.endsWith("==")) {
    return 2;
  }
  if (content.endsWith("=")) {
    return 1;
  }
  return 0;
}

/** Decodes base64, checking the size before decoding. */
function decodeBase64(content: string): Uint8Array<ArrayBuffer> {
  if (!BASE64.test(content) || content.length % 4 !== 0) {
    throwInvalidParams("files.save", '"content" is not valid base64');
  }
  const byteCount = (content.length / 4) * 3 - countPadding(content);
  if (byteCount > MAX_SAVE_BYTES) {
    throwTooLarge();
  }
  const binary = atob(content);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function readFileBytes(
  params: YamlMapping,
  encoding: "text" | "base64",
): Uint8Array<ArrayBuffer> {
  const content = params.content;
  if (typeof content !== "string") {
    throwInvalidParams("files.save", '"content" must be a string');
  }
  const bytes =
    encoding === "text" ? encodeText(content) : decodeBase64(content);
  if (bytes.length > MAX_SAVE_BYTES) {
    throwTooLarge();
  }
  return bytes;
}

/**
 * Reads the params of `files.save { name, content, encoding?, type? }` into
 * a save action whose bytes are the file to download. Raises `INVALID_PARAMS`.
 */
export function readSaveFile(params: YamlMapping): SaveFileAction {
  const name = readFileName(params);
  const encoding = readEncoding(params);
  const type = readFileType(params, encoding);
  const action: SaveFileAction = {
    kind: "save",
    name,
    type,
    bytes: readFileBytes(params, encoding),
  };
  return action;
}

/**
 * `files.save { name, content, encoding?, type? }`: asks the user to save
 * the file, and answers whether the user saved it.
 */
async function saveFile(
  context: ModMethodContext,
  params: YamlMapping,
): Promise<boolean> {
  return askUser(context, "files.save", readSaveFile(params));
}

/** The `files.*` requests: files the app saves for the user. */
export const FILES_METHODS: ModMethodTable = {
  "files.save": saveFile,
};
