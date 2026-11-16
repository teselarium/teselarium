import { describeYamlValue, isYamlMapping } from "../files/index.ts";
import type { YamlMapping, YamlValue } from "../files/index.ts";
import { ModFormatError } from "./mod_errors.ts";

/** What a permission lets a mod reach: a category a user can understand. */
export type PermissionCategory = "show" | "connect" | "embed" | "code" | "open";

/**
 * A declared permission. `host` is an origin, a wildcard host such as
 * `https://*.example.org` outside `open`, or `"*"` (any site) in `open` only.
 * It is kept as written.
 */
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

/** The whole leftmost label of a wildcard host's host name, with its dot. */
const WILDCARD_PREFIX = "*.";

const MIN_WILDCARD_LABELS = 2;

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
 * Parses a host that is written as an origin: an `http:` or `https:` URL whose
 * origin is the text itself. That comparison rejects paths, queries,
 * fragments, user info and trailing slashes at once. Gives null otherwise.
 */
function readOriginUrl(host: string): URL | null {
  if (!URL.canParse(host)) {
    return null;
  }
  const url = new URL(host);
  if (!ORIGIN_PROTOCOLS.has(url.protocol) || url.origin !== host) {
    return null;
  }
  return url;
}

/** A host is an origin when it is written as an origin and has no wildcard. */
export function isOriginHost(host: string): boolean {
  const url = readOriginUrl(host);
  return url !== null && !url.hostname.includes("*");
}

/**
 * True when the host name is a domain of at least the given number of labels,
 * none of them empty. A numeric last label means an IPv4 address, not a domain.
 */
function isDomainWithLabels(hostName: string, minLabels: number): boolean {
  const labels = hostName.split(".");
  for (const label of labels) {
    if (label === "") {
      return false;
    }
  }
  const lastLabel = labels[labels.length - 1];
  return labels.length >= minLabels && !/^[0-9]+$/.test(lastLabel);
}

/**
 * Removes the `*.` of a host written as `<scheme>//*.<rest>`, so
 * `https://*.us.archive.org` gives `https://us.archive.org`. Gives null for a
 * host written otherwise. The `*` is never given to the URL parser, because
 * engines disagree on it: Chromium encodes it in a host name as `%2A`.
 */
function removeWildcardLabel(host: string): string | null {
  for (const protocol of ORIGIN_PROTOCOLS) {
    const wildcardStart = `${protocol}//${WILDCARD_PREFIX}`;
    if (host.startsWith(wildcardStart)) {
      const baseOrigin = `${protocol}//${host.slice(wildcardStart.length)}`;
      return baseOrigin;
    }
  }
  return null;
}

/**
 * Parses the base of a wildcard host, the origin after its `*.`: the URL of
 * `https://us.archive.org` for `https://*.us.archive.org`. The base must be an
 * origin whose host name is a domain of at least two labels. Gives null when
 * the host is not a wildcard host.
 */
function readWildcardBase(host: string): URL | null {
  const baseOrigin = removeWildcardLabel(host);
  if (baseOrigin === null || !isOriginHost(baseOrigin)) {
    return null;
  }
  const baseUrl = new URL(baseOrigin);
  if (!isDomainWithLabels(baseUrl.hostname, MIN_WILDCARD_LABELS)) {
    return null;
  }
  return baseUrl;
}

/**
 * A host is a wildcard host when its host name starts with `*.` as its whole
 * leftmost label, and the host without it is an origin with no `*` whose host
 * name has at least two labels, such as `https://*.us.archive.org`.
 */
export function isWildcardHost(host: string): boolean {
  return readWildcardBase(host) !== null;
}

/**
 * Tells whether a permission host covers an origin. An exact host covers the
 * origin equal to it. A wildcard host covers the origins with the same scheme
 * and port whose host name ends with `.` and the host name of its base, so
 * never that host name itself. `"*"` covers nothing here: it is the `open`
 * category's own rule.
 */
export function permissionHostCovers(host: string, origin: string): boolean {
  const baseUrl = readWildcardBase(host);
  if (baseUrl === null) {
    return host === origin;
  }
  if (!URL.canParse(origin)) {
    return false;
  }
  const originUrl = new URL(origin);
  return (
    originUrl.protocol === baseUrl.protocol &&
    originUrl.port === baseUrl.port &&
    originUrl.hostname.endsWith(`.${baseUrl.hostname}`)
  );
}

/**
 * A host a `show` permission can name: an origin, or a wildcard host such as
 * `https://*.example.org`. Mosaics check their `show` lines with it.
 */
export function isShowHost(host: string): boolean {
  return isOriginHost(host) || isWildcardHost(host);
}

function describeInvalidOpenHost(host: string, entryLabel: string): string {
  if (isWildcardHost(host)) {
    const wildcardMessage = `${entryLabel}: host "${host}": wildcard hosts are not allowed in permissions.open`;
    return wildcardMessage;
  }
  const originMessage = `${entryLabel}: host "${host}" must be an origin such as "https://example.org"`;
  return originMessage;
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
  if (isOriginHost(host)) {
    return;
  }
  if (category === "open") {
    throw new ModFormatError(source, describeInvalidOpenHost(host, entryLabel));
  }
  if (!isWildcardHost(host)) {
    throw new ModFormatError(
      source,
      `${entryLabel}: host "${host}" must be an origin such as "https://example.org", or a wildcard host such as "https://*.example.org"`,
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
