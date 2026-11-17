import type { YamlMapping } from "../../files/index.ts";
import { loadModFile } from "../../mod/index.ts";
import type { LoadedLibrary, ModLoadOptions } from "../../mod/index.ts";
import { grantModPermissions } from "../permissions/index.ts";
import type { ModGrants, SiteDecision } from "../permissions/index.ts";
import { matchModApiRange } from "./mod_api_version.ts";

/** A mod's metadata, without running it. `permissions` are what it would get if it were opened. */
export interface ModInspection {
  source: string;
  title: string;
  version: string;
  description: string;
  /** The mod's `api` range, or `null` when it declares none. */
  api: string | null;
  /** Whether `api` matches the mod API version, `null` without a range. */
  apiCompatible: boolean | null;
  typeSource: string | null;
  /** The resolved address of the mod's default mosaic file, or `null`. It is not fetched. */
  defaultMosaic: string | null;
  /** The resolved address of the mod's test file, or `null`. It is not fetched. */
  testSource: string | null;
  config: YamlMapping;
  /** The declared libraries, with the address of each file. No file is fetched. */
  libraries: LoadedLibrary[];
  permissions: ModGrants;
}

/**
 * Loads the mod file at `source` without fetching its entrypoint or its
 * library files, and builds
 * its inspection, with the permissions granted by `decisions` as a launch
 * would grant them. Load errors propagate.
 */
export async function inspectMod(
  source: string,
  appOrigin: string,
  decisions: readonly SiteDecision[],
  options: ModLoadOptions,
): Promise<ModInspection> {
  const modFile = await loadModFile(source, options);
  const inspection: ModInspection = {
    source: modFile.source,
    title: modFile.title,
    version: modFile.version,
    description: modFile.description,
    api: modFile.api,
    apiCompatible: matchModApiRange(modFile.api),
    typeSource: modFile.typeSource,
    defaultMosaic: modFile.defaultMosaic,
    testSource: modFile.testSource,
    config: structuredClone(modFile.config),
    libraries: structuredClone(modFile.libraries),
    permissions: grantModPermissions(modFile, appOrigin, decisions),
  };
  return inspection;
}
