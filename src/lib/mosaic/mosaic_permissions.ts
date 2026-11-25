import { describeYamlValue, isYamlMapping } from "../files/index.ts";
import type { YamlMapping, YamlValue } from "../files/index.ts";
import { isShowHost } from "../mod/index.ts";
import type { ModPermission } from "../mod/index.ts";
import { MosaicFormatError } from "./mosaic_errors.ts";

/** The only category a mosaic can declare. */
const MOSAIC_PERMISSION_CATEGORY = "show";

function readPermissionsMapping(
  value: YamlValue | undefined,
  source: string,
): YamlMapping {
  if (value === undefined) {
    const noPermissions: YamlMapping = {};
    return noPermissions;
  }
  if (!isYamlMapping(value)) {
    throw new MosaicFormatError(source, '"permissions" must be a mapping');
  }
  return value;
}

function checkCategoryNames(permissions: YamlMapping, source: string): void {
  for (const name of Object.keys(permissions)) {
    if (name !== MOSAIC_PERMISSION_CATEGORY) {
      throw new MosaicFormatError(
        source,
        `"permissions.${name}": a mosaic can only declare show permissions`,
      );
    }
  }
}

function readEntryField(
  entry: YamlMapping,
  fieldName: string,
  entryLabel: string,
  source: string,
): string {
  const value = entry[fieldName];
  if (typeof value !== "string" || value === "") {
    throw new MosaicFormatError(
      source,
      `${entryLabel}: "${fieldName}" must be a non-empty string`,
    );
  }
  return value;
}

/** Reads one `show` entry. `position` counts from 1, as in the mod file. */
function readShowEntry(
  entry: YamlValue,
  position: number,
  source: string,
): ModPermission {
  const entryLabel = `"permissions.show" entry ${position}`;
  if (!isYamlMapping(entry)) {
    throw new MosaicFormatError(
      source,
      `${entryLabel} must be a mapping, found ${describeYamlValue(entry)}`,
    );
  }
  const host = readEntryField(entry, "host", entryLabel, source);
  const reason = readEntryField(entry, "reason", entryLabel, source);
  if (!isShowHost(host)) {
    throw new MosaicFormatError(
      source,
      `${entryLabel}: host "${host}" must be an origin such as "https://example.org", or a wildcard host such as "https://*.example.org"`,
    );
  }
  const permission: ModPermission = { category: "show", host, reason };
  return permission;
}

/**
 * Reads the `permissions` mapping of a mosaic file: its `show` lines in file
 * order. Absent permissions give an empty list. Any other category raises
 * `MosaicFormatError`, as does a `show` host that a mod file would refuse.
 */
export function readMosaicPermissions(
  value: YamlValue | undefined,
  source: string,
): ModPermission[] {
  const permissionsMapping = readPermissionsMapping(value, source);
  checkCategoryNames(permissionsMapping, source);
  const entries = permissionsMapping.show;
  const permissions: ModPermission[] = [];
  if (entries === undefined) {
    return permissions;
  }
  if (!Array.isArray(entries)) {
    throw new MosaicFormatError(source, '"permissions.show" must be a list');
  }
  for (const [index, entry] of entries.entries()) {
    permissions.push(readShowEntry(entry, index + 1, source));
  }
  return permissions;
}
