import type {
  ModFile,
  ModPermission,
  PermissionCategory,
} from "../../mod/index.ts";
import type { LoadedMosaic } from "../../mosaic/index.ts";

/** What a mod gets of the permissions it declares. Together, both lists hold every declared permission. */
export interface ModGrants {
  granted: ModPermission[];
  denied: ModPermission[];
}

/** What declares the permissions a decision answers: a mod, or the mosaic a mod was opened from. */
export type SiteDecisionSubject = "mod" | "mosaic";

/** The fields of a decision other than the address of what declared it. */
interface SiteDecisionFields {
  /** The mod's or the mosaic's title when the user answered, for Settings. */
  title: string;
  category: PermissionCategory;
  /** As declared: an origin, a wildcard host or `"*"`. */
  host: string;
  allowed: boolean;
}

/**
 * The user's answer about one declared permission of one mod, or about one
 * `show` line of one mosaic. It has exactly one of `mod`, the mod file's
 * address as resolved by the mod loader, or `mosaic`, the mosaic file's.
 */
export type SiteDecision = ModSiteDecision | MosaicSiteDecision;

/** A decision about a mod's permission. */
export type ModSiteDecision = SiteDecisionFields & {
  mod: string;
  mosaic?: undefined;
};

/** A decision about a mosaic's `show` line. */
export type MosaicSiteDecision = SiteDecisionFields & {
  mosaic: string;
  mod?: undefined;
};

/** The subject and address of what declared a decision's permission. */
export interface DecisionDeclarer {
  subject: SiteDecisionSubject;
  source: string;
}

/** A line the site consent dialog asks about, with what declared it. */
export type ConsentLine = ModPermission & { subject: SiteDecisionSubject };

type DeclaringMod = Pick<ModFile, "source" | "permissions">;

type DeclaringMosaic = Pick<LoadedMosaic, "source" | "permissions">;

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

function isFromAppOrigin(source: string, appOrigin: string): boolean {
  const isAppOrigin = new URL(source).origin === appOrigin;
  return isAppOrigin;
}

/** The subject and address of what declared a decision's permission. */
export function readDecisionDeclarer(decision: SiteDecision): DecisionDeclarer {
  if (decision.mosaic !== undefined) {
    const mosaicDeclarer: DecisionDeclarer = {
      subject: "mosaic",
      source: decision.mosaic,
    };
    return mosaicDeclarer;
  }
  const modDeclarer: DecisionDeclarer = {
    subject: "mod",
    source: decision.mod,
  };
  return modDeclarer;
}

/** Whether the decision answers about what `declarer` declared: same subject and same address. */
export function isDecisionOf(
  decision: SiteDecision,
  declarer: DecisionDeclarer,
): boolean {
  const decisionDeclarer = readDecisionDeclarer(decision);
  return (
    decisionDeclarer.subject === declarer.subject &&
    decisionDeclarer.source === declarer.source
  );
}

function decidesPermission(
  decision: SiteDecision,
  declarer: DecisionDeclarer,
  permission: ModPermission,
): boolean {
  const decides =
    isDecisionOf(decision, declarer) &&
    decision.category === permission.category &&
    decision.host === permission.host;
  return decides;
}

function hasDecision(
  decisions: readonly SiteDecision[],
  declarer: DecisionDeclarer,
  permission: ModPermission,
): boolean {
  for (const decision of decisions) {
    if (decidesPermission(decision, declarer, permission)) {
      return true;
    }
  }
  return false;
}

function isAllowedByDecisions(
  decisions: readonly SiteDecision[],
  declarer: DecisionDeclarer,
  permission: ModPermission,
): boolean {
  for (const decision of decisions) {
    if (decision.allowed && decidesPermission(decision, declarer, permission)) {
      return true;
    }
  }
  return false;
}

/** The site-owner rule for the permissions one declarer declares. */
function grantDeclaredPermissions(
  declarer: DecisionDeclarer,
  permissions: ModPermission[],
  appOrigin: string,
  decisions: readonly SiteDecision[],
): ModGrants {
  if (isFromAppOrigin(declarer.source, appOrigin)) {
    const appOriginGrants: ModGrants = {
      granted: copyPermissions(permissions),
      denied: [],
    };
    return appOriginGrants;
  }
  const grants: ModGrants = { granted: [], denied: [] };
  for (const permission of copyPermissions(permissions)) {
    if (isAllowedByDecisions(decisions, declarer, permission)) {
      grants.granted.push(permission);
    } else {
      grants.denied.push(permission);
    }
  }
  return grants;
}

/**
 * The site-owner rule: a mod whose file is served from the app's origin gets
 * every permission it declares, a mod from any other origin gets the declared
 * permissions the user allowed. A decision allows a permission when its `mod`,
 * `category` and `host` equal the mod's `source` and the permission's, as
 * written. A mosaic's decisions never apply to a mod.
 */
export function grantModPermissions(
  mod: DeclaringMod,
  appOrigin: string,
  decisions: readonly SiteDecision[],
): ModGrants {
  const declarer: DecisionDeclarer = { subject: "mod", source: mod.source };
  return grantDeclaredPermissions(
    declarer,
    mod.permissions,
    appOrigin,
    decisions,
  );
}

/**
 * The site-owner rule for a mosaic's `show` lines: every line of a mosaic
 * file served from the app's origin, and for a mosaic from another origin the
 * lines the user allowed for that mosaic file. A mod's decisions never apply
 * to a mosaic. `null` (a mod not opened from a mosaic) gets no lines.
 */
export function grantMosaicPermissions(
  mosaic: DeclaringMosaic | null,
  appOrigin: string,
  decisions: readonly SiteDecision[],
): ModGrants {
  if (mosaic === null) {
    const noGrants: ModGrants = { granted: [], denied: [] };
    return noGrants;
  }
  const declarer: DecisionDeclarer = {
    subject: "mosaic",
    source: mosaic.source,
  };
  return grantDeclaredPermissions(
    declarer,
    mosaic.permissions,
    appOrigin,
    decisions,
  );
}

/** The grants of a sandbox: the lines of `first`, then those of `second`, in each list. */
export function joinGrants(first: ModGrants, second: ModGrants): ModGrants {
  const joinedGrants: ModGrants = {
    granted: [...first.granted, ...second.granted],
    denied: [...first.denied, ...second.denied],
  };
  return joinedGrants;
}

function hasSameLine(lines: ConsentLine[], permission: ModPermission): boolean {
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

/** The consent lines of one declarer: none from the app's origin. */
function listDeclaredConsentLines(
  declarer: DecisionDeclarer,
  permissions: ModPermission[],
  appOrigin: string,
  decisions: readonly SiteDecision[],
): ConsentLine[] {
  const lines: ConsentLine[] = [];
  if (isFromAppOrigin(declarer.source, appOrigin)) {
    return lines;
  }
  for (const permission of copyPermissions(permissions)) {
    const isDecided = hasDecision(decisions, declarer, permission);
    if (!isDecided && !hasSameLine(lines, permission)) {
      lines.push({ ...permission, subject: declarer.subject });
    }
  }
  return lines;
}

/**
 * The declared permissions the site consent dialog must ask about: those of a
 * mod from another origin that have no decision for that mod, then the `show`
 * lines of a mosaic from another origin that have no decision for that
 * mosaic. Each part holds one line per category and host with the first
 * reason, in the order declared, and each line names its `subject`. A mod or
 * a mosaic from the app's origin adds no line.
 */
export function listConsentLines(
  mod: DeclaringMod,
  appOrigin: string,
  decisions: readonly SiteDecision[],
  mosaic: DeclaringMosaic | null = null,
): ConsentLine[] {
  const lines = listDeclaredConsentLines(
    { subject: "mod", source: mod.source },
    mod.permissions,
    appOrigin,
    decisions,
  );
  if (mosaic !== null) {
    const mosaicLines = listDeclaredConsentLines(
      { subject: "mosaic", source: mosaic.source },
      mosaic.permissions,
      appOrigin,
      decisions,
    );
    lines.push(...mosaicLines);
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

/** The warning for a `show` line of the mosaic file at `mosaicSource` that was not granted. */
export function describeDeniedMosaicPermission(
  permission: ModPermission,
  mosaicSource: string,
): string {
  const line = describePermissionLine(permission);
  const description = `Permission of the mosaic "${mosaicSource}" not granted: ${line} ("${permission.reason}"). Mosaics from other sites get only the permissions you allow.`;
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
export type OpenSubject = "mods" | "collections" | "mosaics";

/** How the denial messages name a request on each subject, before the origin. */
const OPEN_SUBJECT_ACTIONS: Record<OpenSubject, string> = {
  mods: "Opening mods from",
  collections: "Inspecting collections from",
  mosaics: "Opening mosaics from",
};

/**
 * Checks that a mod may reach the mod, collection or mosaic file at `targetSource`
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
