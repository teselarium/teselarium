import { isYamlMapping, parseYaml, YamlParseError } from "../../files/index.ts";
import type { ParsedYaml, YamlMapping } from "../../files/index.ts";
import { loadModFile } from "../../mod/index.ts";
import type { ModFile, ModLoadOptions } from "../../mod/index.ts";
import {
  aliasCollectionTiles,
  buildLoadedMosaic,
  DRAFT_ADDRESS,
  listRelativeReferences,
  MosaicFormatError,
  readDraftFields,
} from "../../mosaic/index.ts";
import type { LoadedMosaic, MosaicDraftFields } from "../../mosaic/index.ts";
import { buildTileValidator, loadTileCollection } from "../../tile/index.ts";
import type { TileCollection, TileValidator } from "../../tile/index.ts";
import { countMatchingTiles } from "../combinations/index.ts";
import type { DraftLoadCache } from "./draft_load_cache.ts";
import { describeEngineError } from "./engine_errors.ts";
import type { ModCheckFinding } from "./mod_check_report.ts";
import { checkMosaicAliases, checkMosaicConfig } from "./mosaic_findings.ts";

/** An error or a warning of a draft, at its 1-based line, or `null` when it has none. */
export interface DraftProblem {
  message: string;
  line: number | null;
}

/** A field of the mod's tile type, as the alias hints show it. */
export interface DraftTypeField {
  name: string;
  required: boolean;
}

/** How many of the collection's tiles match the tile type after the draft's aliases. */
export interface DraftTileCount {
  matching: number;
  total: number;
}

/** What `mosaics.validate` answers: the problems of a draft, and the hints for its aliases. */
export interface DraftValidation {
  errors: DraftProblem[];
  warnings: DraftProblem[];
  typeFields: DraftTypeField[];
  /** The metadata keys the collection's tiles use, sorted. */
  collectionFields: string[];
  /** `null` without a collection, or with errors. */
  tiles: DraftTileCount | null;
  /** The fields the draft holds as written, or `null` when its text cannot be read. */
  draft: MosaicDraftFields | null;
}

/** What a draft's address names, for `checkAccess`. */
export type DraftSourceKind = "mod" | "collection";

export interface DraftValidationOptions {
  /** How the mod, its tile type and the collection are fetched. `defaultModsFolder` resolves a default mod name. */
  fetchOptions: ModLoadOptions;
  loads: DraftLoadCache;
  /**
   * Called with the mod's and the collection's addresses before anything is
   * loaded. It throws to refuse the validation, and its error propagates.
   */
  checkAccess?: (source: string, kind: DraftSourceKind) => void;
}

/** What a draft's text reads as: the loaded mosaic, or the errors that keep it from being read. */
interface DraftReading {
  mosaic: LoadedMosaic | null;
  errors: DraftProblem[];
}

/** The loads a draft's hints are built from, each `null` when it is absent or failed. */
interface DraftLoads {
  modFile: ModFile | null;
  validator: TileValidator | null;
  collection: TileCollection | null;
  errors: DraftProblem[];
}

function buildProblem(message: string, line: number | null): DraftProblem {
  const problem: DraftProblem = { message, line };
  return problem;
}

function buildReading(
  mosaic: LoadedMosaic | null,
  errors: DraftProblem[],
): DraftReading {
  const reading: DraftReading = { mosaic, errors };
  return reading;
}

/** The js-yaml mark of a parse error: its message without the snippet, and its 1-based line. */
function readParseProblem(error: YamlParseError): DraftProblem {
  const cause = error.cause as
    { reason?: unknown; mark?: { line?: unknown } } | undefined;
  const line = cause?.mark?.line;
  if (typeof line !== "number" || typeof cause?.reason !== "string") {
    return buildProblem(error.message, null);
  }
  return buildProblem(`YAML: ${cause.reason}`, line + 1);
}

function readNewDraftErrors(parsedYaml: ParsedYaml): DraftProblem[] {
  const errors: DraftProblem[] = [];
  const mosaic = parsedYaml.content.mosaic;
  if (!isYamlMapping(mosaic)) {
    return errors;
  }
  for (const key of listRelativeReferences(mosaic)) {
    errors.push(
      buildProblem(
        `"${key}" must be an absolute address in a new mosaic`,
        null,
      ),
    );
  }
  return errors;
}

/** Reads a draft's text as the loader reads a mosaic file, from `address` or `DRAFT_ADDRESS` for a new draft. */
function readDraft(
  content: string,
  address: string | null,
  options: DraftValidationOptions,
): DraftReading {
  let parsedYaml: ParsedYaml;
  try {
    parsedYaml = parseYaml({ source: address ?? DRAFT_ADDRESS, content });
  } catch (error) {
    if (!(error instanceof YamlParseError)) {
      throw error;
    }
    return buildReading(null, [readParseProblem(error)]);
  }
  if (address === null) {
    const newDraftErrors = readNewDraftErrors(parsedYaml);
    if (newDraftErrors.length > 0) {
      return buildReading(null, newDraftErrors);
    }
  }
  try {
    const mosaic = buildLoadedMosaic(parsedYaml, {
      defaultModsFolder: options.fetchOptions.defaultModsFolder,
    });
    return buildReading(mosaic, []);
  } catch (error) {
    if (!(error instanceof MosaicFormatError)) {
      throw error;
    }
    return buildReading(null, [buildProblem(error.message, null)]);
  }
}

/** Runs a load, giving `null` and an error naming what failed when it fails. */
async function loadOrReport<T>(
  loading: Promise<T>,
  errors: DraftProblem[],
): Promise<T | null> {
  try {
    const loaded = await loading;
    return loaded;
  } catch (error) {
    errors.push(buildProblem(describeEngineError(error), null));
    return null;
  }
}

function loadDraftMod(
  source: string,
  options: DraftValidationOptions,
): Promise<ModFile> {
  return options.loads.load(
    `mod:${source}`,
    loadModFile.bind(undefined, source, options.fetchOptions),
  );
}

function loadDraftValidator(
  typeSource: string,
  options: DraftValidationOptions,
): Promise<TileValidator> {
  return options.loads.load(
    `type:${typeSource}`,
    buildTileValidator.bind(undefined, typeSource, options.fetchOptions),
  );
}

function loadDraftCollection(
  source: string,
  options: DraftValidationOptions,
): Promise<TileCollection> {
  return options.loads.load(
    `collection:${source}`,
    loadTileCollection.bind(undefined, source, options.fetchOptions),
  );
}

async function loadModAndType(
  mosaic: LoadedMosaic,
  options: DraftValidationOptions,
  errors: DraftProblem[],
): Promise<[ModFile | null, TileValidator | null]> {
  const modFile = await loadOrReport(loadDraftMod(mosaic.mod, options), errors);
  if (modFile === null || modFile.typeSource === null) {
    const loaded: [ModFile | null, TileValidator | null] = [modFile, null];
    return loaded;
  }
  const validator = await loadOrReport(
    loadDraftValidator(modFile.typeSource, options),
    errors,
  );
  const loaded: [ModFile | null, TileValidator | null] = [modFile, validator];
  return loaded;
}

async function loadDraftFiles(
  mosaic: LoadedMosaic,
  options: DraftValidationOptions,
): Promise<DraftLoads> {
  const errors: DraftProblem[] = [];
  const collectionErrors: DraftProblem[] = [];
  let loadingCollection: Promise<TileCollection | null> = Promise.resolve(null);
  if (mosaic.collection !== null) {
    loadingCollection = loadOrReport(
      loadDraftCollection(mosaic.collection, options),
      collectionErrors,
    );
  }
  const [[modFile, validator], collection] = await Promise.all([
    loadModAndType(mosaic, options, errors),
    loadingCollection,
  ]);
  const loads: DraftLoads = {
    modFile,
    validator,
    collection,
    errors: [...errors, ...collectionErrors],
  };
  return loads;
}

function convertFindings(findings: ModCheckFinding[]): DraftProblem[] {
  const problems: DraftProblem[] = [];
  for (const finding of findings) {
    problems.push(buildProblem(finding.message, null));
  }
  return problems;
}

function listTypeFields(validator: TileValidator | null): DraftTypeField[] {
  const typeFields: DraftTypeField[] = [];
  if (validator === null) {
    return typeFields;
  }
  for (const name of validator.fieldNames) {
    typeFields.push({
      name,
      required: validator.requiredFieldNames.includes(name),
    });
  }
  return typeFields;
}

function listCollectionFields(collection: TileCollection | null): string[] {
  const fieldNames = new Set<string>();
  if (collection === null) {
    const noFields: string[] = [];
    return noFields;
  }
  for (const tile of collection.tiles) {
    for (const name of Object.keys(tile.metadata)) {
      fieldNames.add(name);
    }
  }
  const sortedNames = [...fieldNames].sort();
  return sortedNames;
}

function countDraftTiles(
  mosaic: LoadedMosaic,
  loads: DraftLoads,
): DraftTileCount | null {
  if (
    loads.collection === null ||
    loads.modFile === null ||
    loads.errors.length > 0
  ) {
    return null;
  }
  const total = loads.collection.tiles.length;
  if (loads.validator === null) {
    const untypedCount: DraftTileCount = { matching: total, total };
    return untypedCount;
  }
  const aliasedCollection = aliasCollectionTiles(
    loads.collection,
    mosaic.aliases,
  );
  const count = countMatchingTiles(aliasedCollection, loads.validator);
  const tileCount: DraftTileCount = { matching: count.matching, total };
  return tileCount;
}

function buildWarnings(
  mosaic: LoadedMosaic,
  loads: DraftLoads,
): DraftProblem[] {
  const warnings = convertFindings(checkMosaicAliases(mosaic, loads.validator));
  if (loads.modFile !== null) {
    const modConfig: YamlMapping = loads.modFile.config;
    warnings.push(...convertFindings(checkMosaicConfig(mosaic, modConfig)));
  }
  return warnings;
}

function buildUnreadValidation(
  errors: DraftProblem[],
  content: string,
): DraftValidation {
  const validation: DraftValidation = {
    errors,
    warnings: [],
    typeFields: [],
    collectionFields: [],
    tiles: null,
    draft: readDraftFields(content),
  };
  return validation;
}

/**
 * Validates a draft, the text of a mosaic file to be saved at `address`, or
 * `null` for a new mosaic, whose `mod` and `collection` must be absolute.
 * Reports the loader's errors, with the line of a YAML error, the mosaic
 * warnings of a check, the hints for its aliases, and its fields as written. A mod or collection
 * that cannot be loaded is an error, and the rest is still reported. Asks
 * nothing and opens nothing. Only `checkAccess` may throw.
 */
export async function validateMosaicDraft(
  content: string,
  address: string | null,
  options: DraftValidationOptions,
): Promise<DraftValidation> {
  const reading = readDraft(content, address, options);
  if (reading.mosaic === null) {
    return buildUnreadValidation(reading.errors, content);
  }
  const mosaic = reading.mosaic;
  options.checkAccess?.(mosaic.mod, "mod");
  if (mosaic.collection !== null) {
    options.checkAccess?.(mosaic.collection, "collection");
  }
  const loads = await loadDraftFiles(mosaic, options);
  const validation: DraftValidation = {
    errors: loads.errors,
    warnings: buildWarnings(mosaic, loads),
    typeFields: listTypeFields(loads.validator),
    collectionFields: listCollectionFields(loads.collection),
    tiles: countDraftTiles(mosaic, loads),
    draft: readDraftFields(content),
  };
  return validation;
}
