import type { FileFetchOptions, YamlMapping } from "../../files/index.ts";
import { loadModFile } from "../../mod/index.ts";
import { grantModPermissions } from "../permissions/index.ts";
import type { ModGrants } from "../permissions/index.ts";
import { matchModApiRange } from "./mod_api_version.ts";

/** A mod's metadata, without running it. `permissions` are what it would get if it were opened. */
export interface ModInspection {
  source: string;
  name: string;
  title: string;
  version: string;
  description: string;
  /** The mod's `api` range, or `null` when it declares none. */
  api: string | null;
  /** Whether `api` matches the mod API version, `null` without a range. */
  apiCompatible: boolean | null;
  typeSource: string | null;
  sampleCollection: string | null;
  /** The resolved address of the mod's test file, or `null`. It is not fetched. */
  testSource: string | null;
  config: YamlMapping;
  permissions: ModGrants;
}

/**
 * Loads the mod file at `source` without fetching its entrypoint, and builds
 * its inspection. Load errors propagate.
 */
export async function inspectMod(
  source: string,
  appOrigin: string,
  options: FileFetchOptions,
): Promise<ModInspection> {
  const modFile = await loadModFile(source, options);
  const inspection: ModInspection = {
    source: modFile.source,
    name: modFile.name,
    title: modFile.title,
    version: modFile.version,
    description: modFile.description,
    api: modFile.api,
    apiCompatible: matchModApiRange(modFile.api),
    typeSource: modFile.typeSource,
    sampleCollection: modFile.sampleCollection,
    testSource: modFile.testSource,
    config: structuredClone(modFile.config),
    permissions: grantModPermissions(modFile, appOrigin),
  };
  return inspection;
}
