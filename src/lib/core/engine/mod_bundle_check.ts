import type { FileFetchOptions } from "../../files/index.ts";
import { loadModCode, loadModFile } from "../../mod/index.ts";
import type { LoadedMod, ModFile } from "../../mod/index.ts";
import { buildTileValidator, loadTileCollection } from "../../tile/index.ts";
import type { TileIssue, TileValidator } from "../../tile/index.ts";
import { describeEngineError } from "./engine_errors.ts";
import {
  describeApiRangeMismatch,
  describeMissingApiRange,
  matchModApiRange,
} from "./mod_api_version.ts";
import type { ModCheckFinding } from "./mod_check_report.ts";
import { selectModTiles } from "./mod_launch.ts";
import type { ModTiles } from "./mod_launch.ts";

/** What the bundle check found, and what a mount check needs. */
export interface ModBundleCheck {
  /** The `bundle` findings, in the order of the steps. */
  findings: ModCheckFinding[];
  /** The mod with its code, or `null` when the mod file or the entrypoint failed. */
  mod: LoadedMod | null;
  /** The tiles to mount, or `null` without a collection or when it failed. */
  modTiles: ModTiles | null;
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
  options: FileFetchOptions,
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

/** Loads the collection and selects the mod's tiles from it. Its issues become findings. */
async function checkCollection(
  collectionLocation: string,
  tileValidator: TileValidator | null,
  options: FileFetchOptions,
): Promise<BundleStep<ModTiles>> {
  try {
    const collection = await loadTileCollection(collectionLocation, options);
    const modTiles = selectModTiles(collection, tileValidator);
    return buildPassedStep(modTiles, convertTileIssues(modTiles.issues));
  } catch (error) {
    return buildFailedStep(error, collectionLocation);
  }
}

/** The collection step: skipped without a location, or when the tile type failed and nothing could be validated. */
function checkCollectionStep(
  collectionLocation: string | null,
  tileTypeStep: BundleStep<TileValidator>,
  options: FileFetchOptions,
): Promise<BundleStep<ModTiles>> {
  if (collectionLocation === null || tileTypeStep.findings.length > 0) {
    const skippedStep = buildPassedStep<ModTiles>(null);
    return Promise.resolve(skippedStep);
  }
  return checkCollection(collectionLocation, tileTypeStep.value, options);
}

function buildBundleCheck(
  findings: ModCheckFinding[],
  mod: LoadedMod | null,
  modTiles: ModTiles | null,
): ModBundleCheck {
  const bundleCheck: ModBundleCheck = { findings, mod, modTiles };
  return bundleCheck;
}

/**
 * Checks the files of the mod at `source` (a resolved mod file address):
 * the mod file, its `api` range, its entrypoint, its tile type and the
 * collection at `collectionLocation`, or else the mod's sample collection.
 * Never throws for a file: each failing file is an error finding. Needs no DOM.
 */
export async function checkModBundle(
  source: string,
  collectionLocation: string | null,
  options: FileFetchOptions = {},
): Promise<ModBundleCheck> {
  const modFileStep = await checkModFile(source, options);
  if (modFileStep.value === null) {
    return buildBundleCheck(modFileStep.findings, null, null);
  }
  const modFile = modFileStep.value;
  const entrypointStep = await checkEntrypoint(modFile, options);
  const tileTypeStep = await checkTileType(modFile, options);
  const collectionStep = await checkCollectionStep(
    collectionLocation ?? modFile.sampleCollection,
    tileTypeStep,
    options,
  );
  const findings = [
    ...checkApiRange(modFile),
    ...entrypointStep.findings,
    ...tileTypeStep.findings,
    ...collectionStep.findings,
  ];
  const bundleCheck = buildBundleCheck(
    findings,
    entrypointStep.value,
    collectionStep.value,
  );
  return bundleCheck;
}
