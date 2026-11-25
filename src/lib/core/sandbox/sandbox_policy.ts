import type { ModPermission, PermissionCategory } from "../../mod/index.ts";

const CONTENT_PROTOCOLS = new Set(["http:", "https:"]);

const NONE = "'none'";

/** Sorted and without duplicates, so the policy is the same for the same input. */
export function sortSources(sources: Iterable<string>): string[] {
  const sortedSources = [...new Set(sources)].sort();
  return sortedSources;
}

function readContentOrigin(source: string): string | null {
  if (!URL.canParse(source)) {
    return null;
  }
  const url = new URL(source);
  if (!CONTENT_PROTOCOLS.has(url.protocol)) {
    return null;
  }
  return url.origin;
}

/**
 * The `http:` and `https:` origins of the files the engine read to start a
 * mod, sorted and without duplicates. `file:` and `data:` sources are dropped.
 */
export function collectContentHosts(sources: Iterable<string>): string[] {
  const origins: string[] = [];
  for (const source of sources) {
    const origin = readContentOrigin(source);
    if (origin !== null) {
      origins.push(origin);
    }
  }
  return sortSources(origins);
}

/** The hosts of the granted permissions of one category, as declared. */
export function listCategoryHosts(
  granted: ModPermission[],
  category: PermissionCategory,
): string[] {
  const hosts: string[] = [];
  for (const permission of granted) {
    if (permission.category === category) {
      hosts.push(permission.host);
    }
  }
  return hosts;
}

function buildDirective(name: string, sources: string[]): string {
  const directive = [name, ...sources].join(" ");
  return directive;
}

/** A directive that allows only its hosts, or nothing without hosts. */
function buildHostDirective(name: string, hosts: string[]): string {
  if (hosts.length === 0) {
    return buildDirective(name, [NONE]);
  }
  return buildDirective(name, sortSources(hosts));
}

/**
 * Builds the Content-Security-Policy of a mod's frame. Content hosts and
 * granted `show` hosts can be shown, granted `connect`, `embed` and `code`
 * hosts can be reached for their requests, and everything else is blocked.
 * The tile link sources, already sorted, allow their exact files as images,
 * video and audio only. `open` permissions are enforced by the engine, not by
 * the policy.
 */
export function buildSandboxPolicy(
  contentHosts: string[],
  granted: ModPermission[],
  tileLinkSources: string[],
): string {
  const showHosts = sortSources([
    ...contentHosts,
    ...listCategoryHosts(granted, "show"),
  ]);
  const codeHosts = sortSources(listCategoryHosts(granted, "code"));
  const directives = [
    buildDirective("default-src", [NONE]),
    buildDirective("script-src", [
      "'unsafe-inline'",
      "'unsafe-eval'",
      "'wasm-unsafe-eval'",
      "blob:",
      ...codeHosts,
    ]),
    buildDirective("style-src", [
      "'unsafe-inline'",
      "data:",
      "blob:",
      ...showHosts,
    ]),
    buildDirective("img-src", [
      "data:",
      "blob:",
      ...showHosts,
      ...tileLinkSources,
    ]),
    buildDirective("media-src", [
      "data:",
      "blob:",
      ...showHosts,
      ...tileLinkSources,
    ]),
    buildDirective("font-src", ["data:", "blob:", ...showHosts]),
    buildHostDirective("connect-src", listCategoryHosts(granted, "connect")),
    buildHostDirective("frame-src", listCategoryHosts(granted, "embed")),
    buildDirective("base-uri", [NONE]),
    buildDirective("form-action", [NONE]),
  ];
  return directives.join("; ");
}
