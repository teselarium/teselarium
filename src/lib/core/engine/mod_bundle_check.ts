import type { FileFetchOptions } from "../../files/index.ts";
import { loadModCode, loadModFile } from "../../mod/index.ts";
import type {
  LoadedLibrary,
  LoadedMod,
  ModFile,
  ModLoadOptions,
} from "../../mod/index.ts";
import { aliasCollectionTiles, loadMosaicFile } from "../../mosaic/index.ts";
import type { LoadedMosaic, MosaicAliases } from "../../mosaic/index.ts";
import { buildTileValidator, loadTileCollection } from "../../tile/index.ts";
import type { TileIssue, TileValidator } from "../../tile/index.ts";
import { findSwitchedOffMod } from "./default_mod_settings.ts";
import type { ResolvedDefaultModSettings } from "./default_mod_settings.ts";
import { describeEngineError, ModSwitchedOffError } from "./engine_errors.ts";
import { fetchLibraryFile, PAGE_LIBRARY_FILES } from "./library_files.ts";
import type { LibraryFileCache } from "./library_files.ts";
import {
  describeApiRangeMismatch,
  describeMissingApiRange,
  matchModApiRange,
} from "./mod_api_version.ts";
import type { ModCheckFinding } from "./mod_check_report.ts";
import {
  expandMosaicRequest,
  readMosaicAliases,
  selectModTiles,
} from "./mod_launch.ts";
import type { ModTiles } from "./mod_launch.ts";
import { isMosaicCheckTarget } from "./mod_methods.ts";
import type { ModCheckRequest, ModCheckTarget } from "./mod_methods.ts";
import { checkMosaicAliases, checkMosaicConfig } from "./mosaic_findings.ts";

/** What the bundle check found, and what a mount check needs. */
export interface ModBundleCheck {
  /** The `bundle` findings, in the order of the steps. */
  findings: ModCheckFinding[];
  /** The checked mod file's address, or `null` when a mosaic failed before its mod was known. */
  source: string | null;
  /** The address of the mosaic file the check used, loaded or not, or `null` without a mosaic. */
  mosaicSource: string | null;
  /** The loaded mosaic whose config, aliases and grants the mount check uses, or `null`. */
  mosaic: LoadedMosaic | null;
  /** The collection the tiles were taken from, or `null` without one. */
  collection: string | null;
  /** The mod with its code, or `null` when the mod file or the entrypoint failed. */
  mod: LoadedMod | null;
  /** The tiles to mount, or `null` without a collection or when it failed. */
  modTiles: ModTiles | null;
}

/** The mosaic a check uses: its file's address, the loaded mosaic, and the findings of loading it. */
interface CheckedMosaic {
  source: string | null;
  step: BundleStep<LoadedMosaic>;
}

/** The outcome of one step: its value, or `null` when it failed or had nothing to load. */
interface BundleStep<Value> {
  value: Value | null;
  findings: ModCheckFinding[];
}

function buildPassedStep<Value>(
  value: Value | null,
  findings: ModCheckFinding[] = [],
): BundleStep<Value> {
  const step: BundleStep<Value> = { value, findings };
  return step;
}

/** The failing file of an engine error: its `source` when it has one, else `fallbackSource`. */
function readErrorSource(error: unknown, fallbackSource: string): string {
  if (
    error instanceof Error &&
    "source" in error &&
    typeof error.source === "string"
  ) {
    return error.source;
  }
  return fallbackSource;
}

function buildFailedStep<Value>(
  error: unknown,
  fallbackSource: string,
): BundleStep<Value> {
  const finding: ModCheckFinding = {
    step: "bundle",
    level: "error",
    source: readErrorSource(error, fallbackSource),
    message: describeEngineError(error),
  };
  const step: BundleStep<Value> = { value: null, findings: [finding] };
  return step;
}

function buildBundleWarning(source: string, message: string): ModCheckFinding {
  const finding: ModCheckFinding = {
    step: "bundle",
    level: "warning",
    source,
    message,
  };
  return finding;
}

async function checkModFile(
  source: string,
  options: ModLoadOptions,
): Promise<BundleStep<ModFile>> {
  try {
    const modFile = await loadModFile(source, options);
    return buildPassedStep(modFile);
  } catch (error) {
    return buildFailedStep(error, source);
  }
}

/** The range finding: a warning for a missing or mismatching `api` range, as the stage bar lists it. */
function checkApiRange(modFile: ModFile): ModCheckFinding[] {
  const findings: ModCheckFinding[] = [];
  const apiCompatible = matchModApiRange(modFile.api);
  if (modFile.api === null) {
    findings.push(
      buildBundleWarning(modFile.source, describeMissingApiRange()),
    );
  } else if (apiCompatible === false) {
    findings.push(
      buildBundleWarning(modFile.source, describeApiRangeMismatch(modFile.api)),
    );
  }
  return findings;
}

async function checkEntrypoint(
  modFile: ModFile,
  options: FileFetchOptions,
): Promise<BundleStep<LoadedMod>> {
  try {
    const mod = await loadModCode(modFile, options);
    return buildPassedStep(mod);
  } catch (error) {
    return buildFailedStep(error, modFile.entrypoint);
  }
}

/** One library file: no finding when it arrives, else an error whose source is the file. */
async function checkLibraryFile(
  libraryFiles: LibraryFileCache,
  library: LoadedLibrary,
  fileIndex: number,
  options: ModLoadOptions,
): Promise<ModCheckFinding[]> {
  try {
    await fetchLibraryFile(libraryFiles, library, fileIndex, options);
    const noFindings: ModCheckFinding[] = [];
    return noFindings;
  } catch (error) {
    const step = buildFailedStep(error, library.files[fileIndex].source);
    return step.findings;
  }
}

/**
 * Fetches every file of the mod's declared libraries through `libraryFiles`,
 * so the mount check's `libs.load` reuses them. The findings follow the
 * order of the declarations.
 */
async function checkLibraryFiles(
  modFile: ModFile,
  libraryFiles: LibraryFileCache,
  options: ModLoadOptions,
): Promise<ModCheckFinding[]> {
  const checks: Promise<ModCheckFinding[]>[] = [];
  for (const library of modFile.libraries) {
    for (let fileIndex = 0; fileIndex < library.files.length; fileIndex++) {
      checks.push(checkLibraryFile(libraryFiles, library, fileIndex, options));
    }
  }
  const fileFindings = await Promise.all(checks);
  return fileFindings.flat();
}

/** Builds the tile validator of the mod's type. Without a type, the step passes with no validator. */
async function checkTileType(
  modFile: ModFile,
  options: FileFetchOptions,
): Promise<BundleStep<TileValidator>> {
  if (modFile.typeSource === null) {
    return buildPassedStep<TileValidator>(null);
  }
  try {
    const tileValidator = await buildTileValidator(modFile.typeSource, options);
    return buildPassedStep(tileValidator);
  } catch (error) {
    return buildFailedStep(error, modFile.typeSource);
  }
}

function convertTileIssues(issues: TileIssue[]): ModCheckFinding[] {
  const findings: ModCheckFinding[] = [];
  for (const issue of issues) {
    findings.push({
      step: "bundle",
      level: issue.level,
      source: issue.source,
      message: issue.message,
    });
  }
  return findings;
}

/**
 * Loads the collection and selects the mod's tiles from it, after renaming
 * them by the mosaic's `aliases`. Its issues become findings.
 */
async function checkCollection(
  collectionLocation: string,
  tileValidator: TileValidator | null,
  aliases: MosaicAliases,
  options: FileFetchOptions,
): Promise<BundleStep<ModTiles>> {
  try {
    const collection = await loadTileCollection(collectionLocation, options);
    const modTiles = selectModTiles(
      aliasCollectionTiles(collection, aliases),
      tileValidator,
    );
    return buildPassedStep(modTiles, convertTileIssues(modTiles.issues));
  } catch (error) {
    return buildFailedStep(error, collectionLocation);
  }
}

/** The collection step: skipped without a location, or when the tile type failed and nothing could be validated. */
function checkCollectionStep(
  collectionLocation: string | null,
  tileTypeStep: BundleStep<TileValidator>,
  aliases: MosaicAliases,
  options: FileFetchOptions,
): Promise<BundleStep<ModTiles>> {
  if (collectionLocation === null || tileTypeStep.findings.length > 0) {
    const skippedStep = buildPassedStep<ModTiles>(null);
    return Promise.resolve(skippedStep);
  }
  return checkCollection(
    collectionLocation,
    tileTypeStep.value,
    aliases,
    options,
  );
}

/** The mosaic findings (`checkMosaicAliases`, `checkMosaicConfig`), none without a mosaic. */
function checkMosaicFindings(
  mosaic: LoadedMosaic | null,
  modFile: ModFile,
  tileTypeStep: BundleStep<TileValidator>,
): ModCheckFinding[] {
  if (mosaic === null) {
    const noFindings: ModCheckFinding[] = [];
    return noFindings;
  }
  const findings = [
    ...checkMosaicAliases(mosaic, tileTypeStep.value),
    ...checkMosaicConfig(mosaic, modFile.config),
  ];
  return findings;
}

/** A check that stopped before the mod's own files: only the findings so far, and what was known. */
function buildStoppedCheck(
  findings: ModCheckFinding[],
  source: string | null,
  mosaicSource: string | null,
): ModBundleCheck {
  const bundleCheck: ModBundleCheck = {
    findings,
    source,
    mosaicSource,
    mosaic: null,
    collection: null,
    mod: null,
    modTiles: null,
  };
  return bundleCheck;
}

const NO_MOSAIC: CheckedMosaic = {
  source: null,
  step: { value: null, findings: [] },
};

/** Loads a mosaic file, with its `mod` resolved as when it opens. A failure is an error finding. */
async function checkMosaicFile(
  mosaicSource: string,
  defaults: ResolvedDefaultModSettings,
  options: ModLoadOptions,
): Promise<CheckedMosaic> {
  try {
    const mosaic = await loadMosaicFile(mosaicSource, {
      ...options,
      defaultModsFolder: defaults.folder,
    });
    const checkedMosaic: CheckedMosaic = {
      source: mosaicSource,
      step: buildPassedStep(mosaic),
    };
    return checkedMosaic;
  } catch (error) {
    const checkedMosaic: CheckedMosaic = {
      source: mosaicSource,
      step: buildFailedStep(error, mosaicSource),
    };
    return checkedMosaic;
  }
}

function describeForeignDefaultMosaic(
  mosaic: LoadedMosaic,
  modSource: string,
): string {
  return `The default mosaic names the mod "${mosaic.mod}", but it is the default mosaic of "${modSource}".`;
}

/**
 * The default mosaic of a mod checked without a collection: loaded, and an
 * error when it names another mod, so the mount check does not run.
 */
async function checkDefaultMosaic(
  modFile: ModFile,
  defaults: ResolvedDefaultModSettings,
  options: ModLoadOptions,
): Promise<CheckedMosaic> {
  if (modFile.defaultMosaic === null) {
    return NO_MOSAIC;
  }
  const checkedMosaic = await checkMosaicFile(
    modFile.defaultMosaic,
    defaults,
    options,
  );
  const mosaic = checkedMosaic.step.value;
  if (mosaic === null || mosaic.mod === modFile.source) {
    return checkedMosaic;
  }
  const foreignMosaic: CheckedMosaic = {
    source: checkedMosaic.source,
    step: {
      value: null,
      findings: [
        {
          step: "bundle",
          level: "error",
          source: mosaic.source,
          message: describeForeignDefaultMosaic(mosaic, modFile.source),
        },
      ],
    },
  };
  return foreignMosaic;
}

/** The collection a mod target is checked with: the requested one, else the default mosaic's, else none. */
function readTargetCollection(
  target: ModCheckTarget,
  checkedMosaic: CheckedMosaic,
): string | null {
  if (target.collection !== null) {
    return target.collection;
  }
  return checkedMosaic.step.value?.collection ?? null;
}

/** What the mod's own files are checked with: the mosaic, the collection and the findings before the mod's. */
interface ModFilesInput {
  modFile: ModFile;
  checkedMosaic: CheckedMosaic;
  collection: string | null;
  /** The findings that come before the range finding, such as a mosaic's load error. */
  leadingFindings: ModCheckFinding[];
}

/**
 * Checks a loaded mod file's `api` range, its entrypoint, its libraries, its
 * tile type and the collection, then the mosaic findings. A default mosaic's
 * findings come right after the range finding.
 */
async function checkModFiles(
  input: ModFilesInput,
  defaultMosaicFindings: ModCheckFinding[],
  options: ModLoadOptions,
  libraryFiles: LibraryFileCache,
): Promise<ModBundleCheck> {
  const modFile = input.modFile;
  const mosaic = input.checkedMosaic.step.value;
  const entrypointStep = await checkEntrypoint(modFile, options);
  const libraryFindings = await checkLibraryFiles(
    modFile,
    libraryFiles,
    options,
  );
  const tileTypeStep = await checkTileType(modFile, options);
  const collectionStep = await checkCollectionStep(
    input.collection,
    tileTypeStep,
    readMosaicAliases(mosaic),
    options,
  );
  const findings = [
    ...input.leadingFindings,
    ...checkApiRange(modFile),
    ...defaultMosaicFindings,
    ...entrypointStep.findings,
    ...libraryFindings,
    ...tileTypeStep.findings,
    ...collectionStep.findings,
    ...checkMosaicFindings(mosaic, modFile, tileTypeStep),
  ];
  const bundleCheck: ModBundleCheck = {
    findings,
    source: modFile.source,
    mosaicSource: input.checkedMosaic.source,
    mosaic,
    collection: input.collection,
    mod: entrypointStep.value,
    modTiles: collectionStep.value,
  };
  return bundleCheck;
}

/** `mods.check`: the mod file, then, without a collection, its default mosaic, then the mod's files. */
async function checkModTarget(
  target: ModCheckTarget,
  defaults: ResolvedDefaultModSettings,
  options: ModLoadOptions,
  libraryFiles: LibraryFileCache,
): Promise<ModBundleCheck> {
  const modFileStep = await checkModFile(target.source, options);
  if (modFileStep.value === null) {
    return buildStoppedCheck(modFileStep.findings, target.source, null);
  }
  const modFile = modFileStep.value;
  const checkedMosaic =
    target.collection === null
      ? await checkDefaultMosaic(modFile, defaults, options)
      : NO_MOSAIC;
  const input: ModFilesInput = {
    modFile,
    checkedMosaic,
    collection: readTargetCollection(target, checkedMosaic),
    leadingFindings: [],
  };
  return checkModFiles(
    input,
    checkedMosaic.step.findings,
    options,
    libraryFiles,
  );
}

/** The mod a mosaic opens, resolved as a mosaic link resolves it (`expandMosaicRequest`). */
function readMosaicModSource(
  mosaic: LoadedMosaic,
  defaults: ResolvedDefaultModSettings,
): string {
  const mosaicRequest = {
    link: { mod: "", collection: null, mosaic: mosaic.source, params: {} },
    defaults,
  };
  return expandMosaicRequest(mosaicRequest, mosaic).link.mod;
}

/** `mosaics.check`: the mosaic file, its mod, refused when switched off, then the mod's files. */
async function checkMosaicTarget(
  mosaicSource: string,
  defaults: ResolvedDefaultModSettings,
  options: ModLoadOptions,
  libraryFiles: LibraryFileCache,
): Promise<ModBundleCheck> {
  const checkedMosaic = await checkMosaicFile(mosaicSource, defaults, options);
  const mosaic = checkedMosaic.step.value;
  if (mosaic === null) {
    return buildStoppedCheck(checkedMosaic.step.findings, null, mosaicSource);
  }
  const source = readMosaicModSource(mosaic, defaults);
  const switchedOffName = findSwitchedOffMod(source, defaults);
  if (switchedOffName !== null) {
    const switchedOffStep = buildFailedStep<LoadedMod>(
      new ModSwitchedOffError(switchedOffName, source),
      source,
    );
    return buildStoppedCheck(switchedOffStep.findings, source, mosaicSource);
  }
  const modFileStep = await checkModFile(source, options);
  if (modFileStep.value === null) {
    return buildStoppedCheck(modFileStep.findings, source, mosaicSource);
  }
  const input: ModFilesInput = {
    modFile: modFileStep.value,
    checkedMosaic,
    collection: mosaic.collection,
    leadingFindings: [],
  };
  return checkModFiles(input, [], options, libraryFiles);
}

/**
 * Checks the files of a check request's mod. A mod target (`mods.check`) is
 * checked with its collection or, without one, with its default mosaic; a
 * mosaic target (`mosaics.check`) with the mosaic's mod and collection. The
 * check loads the mosaic file when it uses one, the mod file, its `api`
 * range, its entrypoint, the files of its declared libraries, fetched
 * through `libraryFiles`, its tile type and the collection, whose tiles are
 * renamed by the mosaic's aliases before they are validated, then adds the
 * mosaic findings. Never throws for a file: each failing file is an error
 * finding. Needs no DOM.
 */
export async function checkModBundle(
  request: ModCheckRequest,
  defaults: ResolvedDefaultModSettings,
  options: ModLoadOptions = {},
  libraryFiles: LibraryFileCache = PAGE_LIBRARY_FILES,
): Promise<ModBundleCheck> {
  if (isMosaicCheckTarget(request)) {
    return checkMosaicTarget(request.mosaic, defaults, options, libraryFiles);
  }
  return checkModTarget(request, defaults, options, libraryFiles);
}
