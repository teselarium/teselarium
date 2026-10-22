import type {
  ModFile,
  ModIssue,
  ModPermission,
  PermissionCategory,
} from "../../mod/index.ts";
import type { ModGrants } from "../permissions/index.ts";

/** A request the frame's policy blocked, as the frame loader reports it. */
export interface BlockedRequest {
  blockedUrl: string;
  directive: string;
}

/** A browser dialog function the frame loader replaces, because the sandbox blocks it. */
export type BlockedDialogName = "alert" | "confirm" | "prompt" | "print";

/** What each blocked dialog function does in a mod, and what to use instead. */
const BLOCKED_DIALOG_MESSAGES: Record<BlockedDialogName, string> = {
  alert:
    "alert() is not available in mods. Show the message in the page or in a <dialog> element.",
  confirm:
    'confirm() is not available in mods and always returns false. Use a <dialog> element, or request "ui.confirm" for a confirmation shown by the app.',
  prompt:
    "prompt() is not available in mods and always returns null. Use an <input> in a <dialog> element.",
  print: "print() is not available in mods.",
};

interface DirectiveRule {
  category: PermissionCategory;
  /** What the blocked request was, e.g. `image` in "Blocked image request". */
  noun: string;
}

/** The directives a declared permission can open. Any other directive has no fix. */
const DIRECTIVE_RULES: Record<string, DirectiveRule> = {
  "img-src": { category: "show", noun: "image" },
  "media-src": { category: "show", noun: "media" },
  "font-src": { category: "show", noun: "font" },
  "style-src": { category: "show", noun: "stylesheet" },
  "style-src-elem": { category: "show", noun: "stylesheet" },
  "style-src-attr": { category: "show", noun: "stylesheet" },
  "connect-src": { category: "connect", noun: "connection" },
  "frame-src": { category: "embed", noun: "embedded page" },
  "child-src": { category: "embed", noun: "embedded page" },
  "script-src": { category: "code", noun: "script" },
  "script-src-elem": { category: "code", noun: "script" },
  "script-src-attr": { category: "code", noun: "script" },
  "worker-src": { category: "code", noun: "worker" },
};

function readDirectiveRule(directive: string): DirectiveRule | null {
  if (!Object.hasOwn(DIRECTIVE_RULES, directive)) {
    return null;
  }
  return DIRECTIVE_RULES[directive];
}

/** Browsers sometimes report only the origin, so the origin is all a message relies on. */
function readBlockedOrigin(blockedUrl: string): string | null {
  if (!URL.canParse(blockedUrl)) {
    return null;
  }
  const origin = new URL(blockedUrl).origin;
  if (origin === "null") {
    return null;
  }
  return origin;
}

function declaresHost(
  permissions: ModPermission[],
  category: PermissionCategory,
  origin: string,
): boolean {
  for (const permission of permissions) {
    if (permission.category === category && permission.host === origin) {
      return true;
    }
  }
  return false;
}

function describeBlock(blocked: BlockedRequest, grants: ModGrants): string {
  const rule = readDirectiveRule(blocked.directive);
  const origin = readBlockedOrigin(blocked.blockedUrl);
  const hasFix =
    rule !== null &&
    origin !== null &&
    !declaresHost(grants.granted, rule.category, origin);
  if (!hasFix) {
    const policyMessage = `Blocked by the sandbox policy (${blocked.directive}).`;
    return policyMessage;
  }
  if (declaresHost(grants.denied, rule.category, origin)) {
    const deniedMessage = `Blocked ${rule.noun} request to ${origin}: the mod declares it in permissions.${rule.category}, but the permission was not granted.`;
    return deniedMessage;
  }
  const undeclaredMessage = `Blocked ${rule.noun} request to ${origin}. Add it to permissions.${rule.category} in mod_conf.yaml.`;
  return undeclaredMessage;
}

/**
 * Turns a blocked request into a warning for the mod's issue list, with the
 * fix when there is one: the entry to add to `mod_conf.yaml`, or the note
 * that the declared permission was not granted.
 */
export function describeBlockedRequest(
  blocked: BlockedRequest,
  mod: Pick<ModFile, "source">,
  grants: ModGrants,
): ModIssue {
  const issue: ModIssue = {
    level: "warning",
    source: mod.source,
    message: describeBlock(blocked, grants),
  };
  return issue;
}

/** Turns a blocked dialog function into a warning for the mod's issue list, naming what to use instead. */
export function describeBlockedDialog(
  name: BlockedDialogName,
  mod: Pick<ModFile, "source">,
): ModIssue {
  const issue: ModIssue = {
    level: "warning",
    source: mod.source,
    message: BLOCKED_DIALOG_MESSAGES[name],
  };
  return issue;
}
