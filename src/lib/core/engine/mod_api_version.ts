import satisfies from "semver/functions/satisfies.js";

/**
 * The version of the mod API: the engine methods and events, the mount
 * context, the mod file format and the test API. It is separate from the app's own version.
 * See "Mod API version" in the engine's README for when it changes.
 */
export const MOD_API_VERSION = "0.1.19";

/** Whether `version` is in `range`, by npm's semver range rules. */
export function isVersionInApiRange(version: string, range: string): boolean {
  return satisfies(version, range);
}

/**
 * Whether a mod's `api` range matches `MOD_API_VERSION`: `null` when the mod
 * declares no range.
 */
export function matchModApiRange(range: string | null): boolean | null {
  if (range === null) {
    return null;
  }
  return isVersionInApiRange(MOD_API_VERSION, range);
}

/** The message of the warning of a mod that declares no `api` range. */
export function describeMissingApiRange(): string {
  return `the mod declares no "api" range, so it may not work with mod API ${MOD_API_VERSION}`;
}

/** The message of the warning of a mod whose `api` range does not match `MOD_API_VERSION`. */
export function describeApiRangeMismatch(range: string): string {
  return `the mod was written for mod API "${range}", so it may not work with mod API ${MOD_API_VERSION}`;
}

/** The error of a sandbox whose mod, written for `range`, the user did not run. */
export function describeCancelledApiMismatch(range: string | null): string {
  if (range === null) {
    return `The mod was not started: it declares no "api" range, and this app has mod API ${MOD_API_VERSION}`;
  }
  return `The mod was not started: it was written for mod API "${range}", and this app has mod API ${MOD_API_VERSION}`;
}
