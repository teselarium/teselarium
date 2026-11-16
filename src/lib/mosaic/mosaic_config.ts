import { isYamlMapping } from "../files/index.ts";
import type { YamlMapping } from "../files/index.ts";

/** Merges two mappings that nothing else holds: the result may reuse their values. */
function mergeOwnedMappings(
  modConfig: YamlMapping,
  mosaicConfig: YamlMapping,
): YamlMapping {
  const mergedConfig: YamlMapping = { ...modConfig };
  for (const [key, mosaicValue] of Object.entries(mosaicConfig)) {
    const modValue = mergedConfig[key];
    if (isYamlMapping(modValue) && isYamlMapping(mosaicValue)) {
      mergedConfig[key] = mergeOwnedMappings(modValue, mosaicValue);
    } else {
      mergedConfig[key] = mosaicValue;
    }
  }
  return mergedConfig;
}

/**
 * Merges a mosaic's config into a mod's config. Where both have a mapping
 * under the same key, the mappings are merged the same way. Any other mosaic
 * value, a list, a scalar or `null`, replaces the mod's. Keys only the mod has
 * keep their values and their order, and keys only the mosaic has are added
 * after them. Returns a new mapping that shares no objects with the inputs,
 * and changes neither input.
 */
export function mergeMosaicConfig(
  modConfig: YamlMapping,
  mosaicConfig: YamlMapping,
): YamlMapping {
  const mergedConfig = mergeOwnedMappings(
    structuredClone(modConfig),
    structuredClone(mosaicConfig),
  );
  return mergedConfig;
}
