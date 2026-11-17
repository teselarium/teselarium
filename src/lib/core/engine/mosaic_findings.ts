import { isYamlMapping } from "../../files/index.ts";
import type { YamlMapping } from "../../files/index.ts";
import type { LoadedMosaic } from "../../mosaic/index.ts";
import type { TileValidator } from "../../tile/index.ts";
import type { ModCheckFinding } from "./mod_check_report.ts";

function buildMosaicWarning(
  mosaic: LoadedMosaic,
  message: string,
): ModCheckFinding {
  const finding: ModCheckFinding = {
    step: "bundle",
    level: "warning",
    source: mosaic.source,
    message,
  };
  return finding;
}

/**
 * A warning for each field of the mosaic's `aliases` that the tile type's
 * `ref` definition does not declare. Without a tile type, every field is
 * accepted, so there is none.
 */
export function checkMosaicAliases(
  mosaic: LoadedMosaic,
  tileValidator: TileValidator | null,
): ModCheckFinding[] {
  const findings: ModCheckFinding[] = [];
  if (tileValidator === null) {
    return findings;
  }
  for (const field of Object.keys(mosaic.aliases)) {
    if (!tileValidator.fieldNames.includes(field)) {
      findings.push(
        buildMosaicWarning(
          mosaic,
          `The mosaic gives aliases for "${field}", a field the tile type "${tileValidator.typeName}" does not declare.`,
        ),
      );
    }
  }
  return findings;
}

/**
 * The key paths, such as `config.map.zom`, of the mosaic's config that the
 * mod's config does not have at the same path. The walk descends only where
 * both values are mappings: any other mosaic value replaces the mod's.
 */
function listUnknownConfigPaths(
  modConfig: YamlMapping,
  mosaicConfig: YamlMapping,
  path: string,
): string[] {
  const unknownPaths: string[] = [];
  for (const [key, mosaicValue] of Object.entries(mosaicConfig)) {
    const keyPath = `${path}.${key}`;
    if (!Object.hasOwn(modConfig, key)) {
      unknownPaths.push(keyPath);
      continue;
    }
    const modValue = modConfig[key];
    if (isYamlMapping(modValue) && isYamlMapping(mosaicValue)) {
      unknownPaths.push(
        ...listUnknownConfigPaths(modValue, mosaicValue, keyPath),
      );
    }
  }
  return unknownPaths;
}

/** A warning for each key of the mosaic's config, at any depth, that the mod's config does not have. */
export function checkMosaicConfig(
  mosaic: LoadedMosaic,
  modConfig: YamlMapping,
): ModCheckFinding[] {
  const findings: ModCheckFinding[] = [];
  for (const keyPath of listUnknownConfigPaths(
    modConfig,
    mosaic.config,
    "config",
  )) {
    findings.push(
      buildMosaicWarning(
        mosaic,
        `The mosaic sets "${keyPath}", a key the mod's config does not have.`,
      ),
    );
  }
  return findings;
}
