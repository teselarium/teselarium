import { describeYamlValue, isYamlMapping } from "../files/index.ts";
import type { YamlMapping, YamlValue } from "../files/index.ts";
import { ModFormatError } from "./mod_errors.ts";

/** What a permission lets a mod reach: a category a user can understand. */
export type PermissionCategory = "show" | "connect" | "embed" | "code" | "open";

/** A declared permission. `host` is an origin, or `"*"` (any site) in `open` only. */
export interface ModPermission {
  category: PermissionCategory;
  host: string;
  reason: string;
}

/** The categories in the order permissions are listed, whatever the order in the file. */
export const PERMISSION_CATEGORIES: readonly PermissionCategory[] = [
  "show",
  "connect",
  "embed",
  "code",
  "open",
];

const ANY_SITE = "*";

const ORIGIN_PROTOCOLS = new Set(["http:", "https:"]);

function isPermissionCategory(name: string): name is PermissionCategory {
  return (PERMISSION_CATEGORIES as readonly string[]).includes(name);
}

function isNonEmptyString(value: YamlValue | undefined): value is string {
  return typeof value === "string" && value !== "";
}

function readPermissionsMapping(
  value: YamlValue | undefined,
  source: string,
): YamlMapping {
  if (value === undefined) {
    const noPermissions: YamlMapping = {};
    return noPermissions;
  }
  if (!isYamlMapping(value)) {
    throw new ModFormatError(source, '"permissions" must be a mapping');
  }
  return value;
}

function checkCategoryNames(permissions: YamlMapping, source: string): void {
  for (const name of Object.keys(permissions)) {
    if (!isPermissionCategory(name)) {
      throw new ModFormatError(
        source,
        `"permissions.${name}" is not a permission category, use one of: ${PERMISSION_CATEGORIES.join(", ")}`,
      );
    }
  }
}

/**
 * A host is an origin when it parses as an `http:` or `https:` URL without a
 * wildcard and its origin is the text itself. That comparison rejects paths,
 * queries, fragments, user info and trailing slashes at once.
 */
export function isOriginHost(host: string): boolean {
  if (!URL.canParse(host)) {
    return false;
  }
  const url = new URL(host);
  if (!ORIGIN_PROTOCOLS.has(url.protocol) || url.hostname.includes("*")) {
    return false;
  }
  return url.origin === host;
}

function checkPermissionHost(
  category: PermissionCategory,
  host: string,
  entryLabel: string,
  source: string,
): void {
  if (host === ANY_SITE) {
    if (category !== "open") {
      throw new ModFormatError(
        source,
        `${entryLabel}: host "*" is only allowed in permissions.open`,
      );
    }
    return;
  }
  if (!isOriginHost(host)) {
    throw new ModFormatError(
      source,
      `${entryLabel}: host "${host}" must be an origin such as "https://example.org"`,
    );
  }
}

function readEntryField(
  entry: YamlMapping,
  fieldName: string,
  entryLabel: string,
  source: string,
): string {
  const value = entry[fieldName];
  if (!isNonEmptyString(value)) {
    throw new ModFormatError(
      source,
      `${entryLabel}: "${fieldName}" must be a non-empty string`,
    );
  }
  return value;
}

/** Reads one entry of a category. `position` counts from 1, as in the collection loader. */
function readPermissionEntry(
  category: PermissionCategory,
  entry: YamlValue,
  position: number,
  source: string,
): ModPermission {
  const entryLabel = `"permissions.${category}" entry ${position}`;
  if (!isYamlMapping(entry)) {
    throw new ModFormatError(
      source,
      `${entryLabel} must be a mapping, found ${describeYamlValue(entry)}`,
    );
  }
  const host = readEntryField(entry, "host", entryLabel, source);
  const reason = readEntryField(entry, "reason", entryLabel, source);
  checkPermissionHost(category, host, entryLabel, source);
  const permission: ModPermission = { category, host, reason };
  return permission;
}

function readCategoryEntries(
  category: PermissionCategory,
  entries: YamlValue,
  source: string,
): ModPermission[] {
  if (!Array.isArray(entries)) {
    throw new ModFormatError(
      source,
      `"permissions.${category}" must be a list`,
    );
  }
  const permissions: ModPermission[] = [];
  for (const [index, entry] of entries.entries()) {
    permissions.push(readPermissionEntry(category, entry, index + 1, source));
  }
  return permissions;
}

/**
 * Reads the `permissions` mapping of a mod file into a list ordered by
 * category (`show`, `connect`, `embed`, `code`, `open`), then by entry.
 * Absent permissions give an empty list. Raises `ModFormatError`.
 */
export function readModPermissions(
  value: YamlValue | undefined,
  source: string,
): ModPermission[] {
  const permissionsMapping = readPermissionsMapping(value, source);
  checkCategoryNames(permissionsMapping, source);
  const permissions: ModPermission[] = [];
  for (const category of PERMISSION_CATEGORIES) {
    const entries = permissionsMapping[category];
    if (entries !== undefined) {
      permissions.push(...readCategoryEntries(category, entries, source));
    }
  }
  return permissions;
}
