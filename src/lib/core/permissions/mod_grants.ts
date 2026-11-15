import type {
  ModFile,
  ModPermission,
  PermissionCategory,
} from "../../mod/index.ts";

/** What a mod gets of the permissions it declares. Together, both lists hold every declared permission. */
export interface ModGrants {
  granted: ModPermission[];
  denied: ModPermission[];
}

/** The user's answer about one declared permission of one mod. */
export interface SiteDecision {
  /** The mod file's address, as resolved by the mod loader. */
  mod: string;
  /** The mod's title when the user answered, for Settings. */
  title: string;
  category: PermissionCategory;
  /** As declared: an origin, a wildcard host or `"*"`. */
  host: string;
  allowed: boolean;
}

type DeclaringMod = Pick<ModFile, "source" | "permissions">;

const ANY_SITE = "*";

/** The verbs of the site consent dialog, the denial messages and Settings. */
const CATEGORY_VERBS: Record<PermissionCategory, string> = {
  show: "show content from",
  connect: "exchange data with",
  embed: "embed pages from",
  code: "load code from",
  open: "open mods from",
};

function copyPermissions(permissions: ModPermission[]): ModPermission[] {
  const copiedPermissions = structuredClone(permissions);
  return copiedPermissions;
}

function isFromAppOrigin(mod: DeclaringMod, appOrigin: string): boolean {
  const isAppOrigin = new URL(mod.source).origin === appOrigin;
  return isAppOrigin;
}

function decidesPermission(
  decision: SiteDecision,
  modSource: string,
  permission: ModPermission,
): boolean {
  const decides =
    decision.mod === modSource &&
    decision.category === permission.category &&
    decision.host === permission.host;
  return decides;
}

function hasDecision(
  decisions: readonly SiteDecision[],
  modSource: string,
  permission: ModPermission,
): boolean {
  for (const decision of decisions) {
    if (decidesPermission(decision, modSource, permission)) {
      return true;
    }
  }
  return false;
}

function isAllowedByDecisions(
  decisions: readonly SiteDecision[],
  modSource: string,
  permission: ModPermission,
): boolean {
  for (const decision of decisions) {
    if (
      decision.allowed &&
      decidesPermission(decision, modSource, permission)
    ) {
      return true;
    }
  }
  return false;
}

/**
 * The site-owner rule: a mod whose file is served from the app's origin gets
 * every permission it declares, a mod from any other origin gets the declared
 * permissions the user allowed. A decision allows a permission when its `mod`,
 * `category` and `host` equal the mod's `source` and the permission's, as
 * written.
 */
export function grantModPermissions(
  mod: DeclaringMod,
  appOrigin: string,
  decisions: readonly SiteDecision[],
): ModGrants {
  if (isFromAppOrigin(mod, appOrigin)) {
    const appOriginGrants: ModGrants = {
      granted: copyPermissions(mod.permissions),
      denied: [],
    };
    return appOriginGrants;
  }
  const grants: ModGrants = { granted: [], denied: [] };
  for (const permission of copyPermissions(mod.permissions)) {
    if (isAllowedByDecisions(decisions, mod.source, permission)) {
      grants.granted.push(permission);
    } else {
      grants.denied.push(permission);
    }
  }
  return grants;
}

function hasSameLine(
  lines: ModPermission[],
  permission: ModPermission,
): boolean {
  for (const line of lines) {
    if (
      line.category === permission.category &&
      line.host === permission.host
    ) {
      return true;
    }
  }
  return false;
}

/**
 * The declared permissions the site consent dialog must ask about: those of a
 * mod from another origin that have no decision for that mod, one per category
 * and host with the first reason, in the order declared. Empty for a mod from
 * the app's origin.
 */
export function listConsentLines(
  mod: DeclaringMod,
  appOrigin: string,
  decisions: readonly SiteDecision[],
): ModPermission[] {
  const lines: ModPermission[] = [];
  if (isFromAppOrigin(mod, appOrigin)) {
    return lines;
  }
  for (const permission of copyPermissions(mod.permissions)) {
    const isDecided = hasDecision(decisions, mod.source, permission);
    if (!isDecided && !hasSameLine(lines, permission)) {
      lines.push(permission);
    }
  }
  return lines;
}

function describePermissionHost(host: string): string {
  if (host === ANY_SITE) {
    return "any site";
  }
  return host;
}

/** The category's verb and the host, such as `show content from https://upload.wikimedia.org`. */
export function describePermissionLine(
  permission: Pick<ModPermission, "category" | "host">,
): string {
  const verb = CATEGORY_VERBS[permission.category];
  const host = describePermissionHost(permission.host);
  const line = `${verb} ${host}`;
  return line;
}

/** The warning for a declared permission that was not granted. */
export function describeDeniedPermission(permission: ModPermission): string {
  const line = describePermissionLine(permission);
  const description = `Permission not granted: ${line} ("${permission.reason}"). Mods from other sites get only the permissions you allow.`;
  return description;
}

function hasOpenPermission(
  permissions: ModPermission[],
  targetOrigin: string,
): boolean {
  for (const permission of permissions) {
    const isOpen = permission.category === "open";
    const coversTarget =
      permission.host === ANY_SITE || permission.host === targetOrigin;
    if (isOpen && coversTarget) {
      return true;
    }
  }
  return false;
}

/** What a request reaches through the `open` permission. */
export type OpenSubject = "mods" | "collections";

/** How the denial messages name a request on each subject, before the origin. */
const OPEN_SUBJECT_ACTIONS: Record<OpenSubject, string> = {
  mods: "Opening mods from",
  collections: "Inspecting collections from",
};

/**
 * Checks that a mod may reach the mod or collection file at `targetSource`
 * through the engine: it needs a granted `open` permission for `"*"` or the
 * target's origin. Returns `null` when it may, and otherwise the message of
 * the denial, worded for `subject`.
 */
export function checkOpenGrant(
  grants: ModGrants,
  targetSource: string,
  subject: OpenSubject = "mods",
): string | null {
  const targetOrigin = new URL(targetSource).origin;
  if (hasOpenPermission(grants.granted, targetOrigin)) {
    return null;
  }
  const action = OPEN_SUBJECT_ACTIONS[subject];
  if (hasOpenPermission(grants.denied, targetOrigin)) {
    const deniedMessage = `${action} ${targetOrigin}: the mod declares it in permissions.open, but the permission was not granted.`;
    return deniedMessage;
  }
  const undeclaredMessage = `${action} ${targetOrigin} is not allowed. Add it to permissions.open in mod_conf.yaml.`;
  return undeclaredMessage;
}
