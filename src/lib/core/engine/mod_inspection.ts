import type { FileFetchOptions, YamlMapping } from "../../files/index.ts";
import { loadModFile } from "../../mod/index.ts";
import { grantModPermissions } from "../permissions/index.ts";
import type { ModGrants } from "../permissions/index.ts";

/** A mod's metadata, without running it. `permissions` are what it would get if it were opened. */
export interface ModInspection {
  source: string;
  name: string;
  title: string;
  version: string;
  description: string;
  typeSource: string | null;
  sampleCollection: string | null;
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
    typeSource: modFile.typeSource,
    sampleCollection: modFile.sampleCollection,
    config: structuredClone(modFile.config),
    permissions: grantModPermissions(modFile, appOrigin),
  };
  return inspection;
}
