import {
  fetchFile,
  FileFetchError,
  isYamlMapping,
  parseYaml,
} from "../files/index.ts";
import type {
  FileFetchOptions,
  ParsedYaml,
  YamlMapping,
  YamlValue,
} from "../files/index.ts";
import { resolveModReference } from "../mod/index.ts";
import type { ModPermission } from "../mod/index.ts";
import { resolveCollectionReference } from "../tile/index.ts";
import { readMosaicAliases } from "./mosaic_aliases.ts";
import type { MosaicAliases } from "./mosaic_aliases.ts";
import { MosaicFormatError } from "./mosaic_errors.ts";
import { readMosaicPermissions } from "./mosaic_permissions.ts";
import { resolveMosaicReference } from "./mosaic_reference.ts";

export type MosaicLoadOptions = FileFetchOptions & {
  /** Absolute URL of the default mods folder, needed for a `mod` that is a default mod name. */
  defaultModsFolder?: string;
};

/** A loaded mosaic file, as plain data. Its `mod` and `collection` are resolved. */
export interface LoadedMosaic {
  /** Resolved absolute URL of the mosaic file. */
  source: string;
  title: string;
  /** Empty when the file has none. */
  description: string;
  /** Resolved absolute URL of the mod file. */
  mod: string;
  /** Resolved absolute URL of the collection file, or `null`. */
  collection: string | null;
  /** The mosaic's own config, merged into the mod's when it opens. */
  config: YamlMapping;
  aliases: MosaicAliases;
  /** The `show` lines, in file order. */
  permissions: ModPermission[];
}

function readMosaicMapping(parsedYaml: ParsedYaml): YamlMapping {
  const mosaic = parsedYaml.content.mosaic;
  if (!isYamlMapping(mosaic)) {
    throw new MosaicFormatError(
      parsedYaml.source,
      'a "mosaic" mapping is required',
    );
  }
  return mosaic;
}

function readRequiredText(
  mosaic: YamlMapping,
  fieldName: string,
  source: string,
): string {
  const value = mosaic[fieldName];
  if (typeof value !== "string" || value === "") {
    throw new MosaicFormatError(
      source,
      `"${fieldName}" must be a non-empty string`,
    );
  }
  return value;
}

function readDescription(mosaic: YamlMapping, source: string): string {
  const description = mosaic.description;
  if (description === undefined) {
    return "";
  }
  if (typeof description !== "string") {
    throw new MosaicFormatError(source, '"description" must be a string');
  }
  return description;
}

function readCollectionReference(
  mosaic: YamlMapping,
  source: string,
): string | null {
  const collection: YamlValue | undefined = mosaic.collection;
  if (collection === undefined || collection === null) {
    return null;
  }
  return readRequiredText(mosaic, "collection", source);
}

function readMosaicConfig(mosaic: YamlMapping, source: string): YamlMapping {
  const config = mosaic.config;
  if (config === undefined) {
    const emptyConfig: YamlMapping = {};
    return emptyConfig;
  }
  if (!isYamlMapping(config)) {
    throw new MosaicFormatError(source, '"config" must be a mapping');
  }
  return config;
}

/** The format error of a reference the mosaic file holds that cannot be resolved. Rethrows any other error. */
function readReferenceError(
  fieldName: string,
  error: unknown,
  source: string,
): MosaicFormatError {
  if (!(error instanceof FileFetchError)) {
    throw error;
  }
  const formatError = new MosaicFormatError(
    source,
    `"${fieldName}" cannot be resolved: ${error.message}`,
    { cause: error },
  );
  return formatError;
}

/** `mod` follows the mod reference rules against the mosaic file, so a default mod name stays one. */
function resolveMosaicMod(
  reference: string,
  source: string,
  options: MosaicLoadOptions,
): string {
  try {
    return resolveModReference(reference, {
      baseUrl: source,
      defaultModsFolder: options.defaultModsFolder,
    });
  } catch (error) {
    throw readReferenceError("mod", error, source);
  }
}

function resolveMosaicCollection(
  reference: string | null,
  source: string,
): string | null {
  if (reference === null) {
    return null;
  }
  try {
    return resolveCollectionReference(reference, source);
  } catch (error) {
    throw readReferenceError("collection", error, source);
  }
}

/**
 * Reads a parsed mosaic file and resolves its `mod` and `collection` against
 * its source, requesting nothing. Raises `MosaicFormatError`.
 */
export function buildLoadedMosaic(
  parsedYaml: ParsedYaml,
  options: MosaicLoadOptions,
): LoadedMosaic {
  const source = parsedYaml.source;
  const mosaic = readMosaicMapping(parsedYaml);
  const title = readRequiredText(mosaic, "title", source);
  const modReference = readRequiredText(mosaic, "mod", source);
  const collectionReference = readCollectionReference(mosaic, source);
  const loadedMosaic: LoadedMosaic = {
    source,
    title,
    description: readDescription(mosaic, source),
    mod: resolveMosaicMod(modReference, source, options),
    collection: resolveMosaicCollection(collectionReference, source),
    config: readMosaicConfig(mosaic, source),
    aliases: readMosaicAliases(mosaic.aliases, source),
    permissions: readMosaicPermissions(mosaic.permissions, source),
  };
  return loadedMosaic;
}

/** A loaded mosaic with the text of its file, as it was read. */
export interface MosaicWithText {
  mosaic: LoadedMosaic;
  content: string;
}

/**
 * Loads a mosaic file as `loadMosaicFile` does, and also gives the file's
 * text, comments included.
 */
export async function loadMosaicWithText(
  reference: string,
  options: MosaicLoadOptions = {},
): Promise<MosaicWithText> {
  const source = resolveMosaicReference(reference, options.baseUrl);
  const fetchedFile = await fetchFile(source, options);
  const mosaicWithText: MosaicWithText = {
    mosaic: buildLoadedMosaic(parseYaml(fetchedFile), options),
    content: fetchedFile.content,
  };
  return mosaicWithText;
}

/**
 * Loads a mosaic file from a mosaic reference (the file or its folder),
 * requesting neither its mod nor its collection. Raises `FileFetchError` or
 * `YamlParseError`, whose source is the mosaic file, or `MosaicFormatError`.
 */
export async function loadMosaicFile(
  reference: string,
  options: MosaicLoadOptions = {},
): Promise<LoadedMosaic> {
  const mosaicWithText = await loadMosaicWithText(reference, options);
  return mosaicWithText.mosaic;
}
