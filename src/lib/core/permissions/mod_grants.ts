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

const ANY_SITE = "*";

/** The verbs of the future permission prompt. */
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

/**
 * The site-owner rule: a mod whose file is served from the app's origin gets
 * every permission it declares, a mod from any other origin gets none.
 */
export function grantModPermissions(
  mod: Pick<ModFile, "source" | "permissions">,
  appOrigin: string,
): ModGrants {
  const isAppOrigin = new URL(mod.source).origin === appOrigin;
  const grants: ModGrants = {
    granted: isAppOrigin ? copyPermissions(mod.permissions) : [],
    denied: isAppOrigin ? [] : copyPermissions(mod.permissions),
  };
  return grants;
}

function describePermissionHost(host: string): string {
  if (host === ANY_SITE) {
    return "any site";
  }
  return host;
}

/** The warning for a declared permission that was not granted. */
export function describeDeniedPermission(permission: ModPermission): string {
  const verb = CATEGORY_VERBS[permission.category];
  const host = describePermissionHost(permission.host);
  const description = `Permission not granted: ${verb} ${host} ("${permission.reason}"). Mods from other sites run without extra permissions for now.`;
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

/**
 * Checks that a mod may inspect or open the mod at `targetSource`: it needs a
 * granted `open` permission for `"*"` or the target's origin. Returns `null`
 * when it may, and otherwise the message of the denial.
 */
export function checkOpenGrant(
  grants: ModGrants,
  targetSource: string,
): string | null {
  const targetOrigin = new URL(targetSource).origin;
  if (hasOpenPermission(grants.granted, targetOrigin)) {
    return null;
  }
  if (hasOpenPermission(grants.denied, targetOrigin)) {
    const deniedMessage = `Opening mods from ${targetOrigin}: the mod declares it in permissions.open, but the permission was not granted.`;
    return deniedMessage;
  }
  const undeclaredMessage = `Opening mods from ${targetOrigin} is not allowed. Add it to permissions.open in mod_conf.yaml.`;
  return undeclaredMessage;
}
