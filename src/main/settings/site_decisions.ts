import {
  isDecisionOf,
  readDecisionDeclarer,
} from "../../lib/core/permissions/index.ts";
import type {
  DecisionDeclarer,
  SiteDecision,
} from "../../lib/core/permissions/index.ts";
import { PERMISSION_CATEGORIES } from "../../lib/mod/index.ts";
import { readStoredJson, writeStoredJson } from "./stored_json.ts";
import type { SettingsStorage } from "./stored_json.ts";

/** The part of `Storage` the store uses. The app passes `localStorage`. */
export type SiteDecisionsStorage = SettingsStorage;

export interface SiteDecisionsOptions {
  storage: SiteDecisionsStorage;
}

/** The remembered answers of the site consent dialog. Mutable. */
export interface SiteDecisions {
  storage: SiteDecisionsStorage;
  listeners: Set<() => void>;
  /** The remembered decisions, frozen, and new after every change. */
  snapshot: readonly SiteDecision[];
}

/**
 * What identifies a decision: one declared category and host of one mod, or
 * one `show` host of one mosaic.
 */
export type SiteDecisionLine = Pick<
  SiteDecision,
  "mod" | "mosaic" | "category" | "host"
>;

/** Outside the `opentesela.mod-storage:` keys, so no mod storage slot can reach it. */
export const SITE_DECISIONS_KEY = "opentesela.site-decisions";

function isWebAddress(value: unknown): boolean {
  if (typeof value !== "string" || !URL.canParse(value)) {
    return false;
  }
  const protocol = new URL(value).protocol;
  return protocol === "http:" || protocol === "https:";
}

function isPermissionCategory(value: unknown): boolean {
  return (PERMISSION_CATEGORIES as readonly unknown[]).includes(value);
}

/**
 * Whether the entry names exactly one declarer: a `mod` or a `mosaic` web
 * address, never both. An older app reads a mosaic entry as invalid.
 */
function hasOneDeclarer(fields: Record<string, unknown>): boolean {
  const hasMod = fields.mod !== undefined;
  const hasMosaic = fields.mosaic !== undefined;
  if (hasMod === hasMosaic) {
    return false;
  }
  return isWebAddress(hasMod ? fields.mod : fields.mosaic);
}

function isSiteDecision(entry: unknown): entry is SiteDecision {
  if (typeof entry !== "object" || entry === null) {
    return false;
  }
  const fields = entry as Record<string, unknown>;
  return (
    hasOneDeclarer(fields) &&
    typeof fields.title === "string" &&
    isPermissionCategory(fields.category) &&
    typeof fields.host === "string" &&
    fields.host !== "" &&
    typeof fields.allowed === "boolean"
  );
}

function isSameLine(decision: SiteDecision, line: SiteDecisionLine): boolean {
  return (
    decision.mod === line.mod &&
    decision.mosaic === line.mosaic &&
    decision.category === line.category &&
    decision.host === line.host
  );
}

/** The decisions without the one for `line`. */
function leaveOutLine(
  decisions: readonly SiteDecision[],
  line: SiteDecisionLine,
): SiteDecision[] {
  const keptDecisions: SiteDecision[] = [];
  for (const decision of decisions) {
    if (!isSameLine(decision, line)) {
      keptDecisions.push(decision);
    }
  }
  return keptDecisions;
}

/** A frozen copy of one decision, with only its own fields: `mod` or `mosaic`, then the others. */
function freezeDecision(decision: SiteDecision): SiteDecision {
  const fields = {
    title: decision.title,
    category: decision.category,
    host: decision.host,
    allowed: decision.allowed,
  };
  const declarer = readDecisionDeclarer(decision);
  const frozenDecision: SiteDecision =
    declarer.subject === "mosaic"
      ? { mosaic: declarer.source, ...fields }
      : { mod: declarer.source, ...fields };
  return Object.freeze(frozenDecision);
}

/** `decisions` merged into `current`: a later decision replaces an earlier one for the same line. */
function mergeDecisions(
  current: readonly SiteDecision[],
  decisions: readonly SiteDecision[],
): readonly SiteDecision[] {
  let merged: SiteDecision[] = [...current];
  for (const decision of decisions) {
    merged = leaveOutLine(merged, decision);
    merged.push(freezeDecision(decision));
  }
  return Object.freeze(merged);
}

/** The valid decisions of a stored value, the last of duplicates kept. */
function readValidDecisions(stored: unknown): readonly SiteDecision[] {
  const decisions: SiteDecision[] = [];
  if (!Array.isArray(stored)) {
    return Object.freeze(decisions);
  }
  for (const entry of stored) {
    if (isSiteDecision(entry)) {
      decisions.push(entry);
    }
  }
  return mergeDecisions([], decisions);
}

function publishDecisions(
  store: SiteDecisions,
  decisions: readonly SiteDecision[],
): void {
  store.snapshot = decisions;
  writeStoredJson(store.storage, SITE_DECISIONS_KEY, decisions);
  for (const listener of store.listeners) {
    listener();
  }
}

/**
 * Reads the stored decisions, dropping the entries that are not valid
 * decisions. The cleaned list is written back on the next change.
 */
export function createSiteDecisions(
  options: SiteDecisionsOptions,
): SiteDecisions {
  const store: SiteDecisions = {
    storage: options.storage,
    listeners: new Set(),
    snapshot: readValidDecisions(
      readStoredJson(options.storage, SITE_DECISIONS_KEY),
    ),
  };
  return store;
}

/**
 * Keeps `decisions`, each replacing a remembered one for the same mod or
 * mosaic, category and host, stored when the storage allows.
 */
export function rememberSiteDecisions(
  store: SiteDecisions,
  decisions: readonly SiteDecision[],
): void {
  publishDecisions(store, mergeDecisions(store.snapshot, decisions));
}

/**
 * Forgets the decision for `line`, stored when the storage allows. Only
 * later launches read it, so running mods keep their permissions.
 */
export function removeSiteDecision(
  store: SiteDecisions,
  line: SiteDecisionLine,
): void {
  publishDecisions(store, Object.freeze(leaveOutLine(store.snapshot, line)));
}

/** The decisions of every mod and mosaic but `declarer`. */
function leaveOutDeclarer(
  decisions: readonly SiteDecision[],
  declarer: DecisionDeclarer,
): SiteDecision[] {
  const keptDecisions: SiteDecision[] = [];
  for (const decision of decisions) {
    if (!isDecisionOf(decision, declarer)) {
      keptDecisions.push(decision);
    }
  }
  return keptDecisions;
}

/**
 * Forgets every decision of one mod file or one mosaic file with one write,
 * stored when the storage allows. Running mods keep their permissions.
 */
export function removeDeclaredSiteDecisions(
  store: SiteDecisions,
  declarer: DecisionDeclarer,
): void {
  publishDecisions(
    store,
    Object.freeze(leaveOutDeclarer(store.snapshot, declarer)),
  );
}

export function readSiteDecisionsSnapshot(
  store: SiteDecisions,
): readonly SiteDecision[] {
  return store.snapshot;
}

function unsubscribeSiteDecisions(
  store: SiteDecisions,
  listener: () => void,
): void {
  store.listeners.delete(listener);
}

/** Calls `listener` after every change. Returns the function that unsubscribes it. */
export function subscribeSiteDecisions(
  store: SiteDecisions,
  listener: () => void,
): () => void {
  store.listeners.add(listener);
  return unsubscribeSiteDecisions.bind(undefined, store, listener);
}
