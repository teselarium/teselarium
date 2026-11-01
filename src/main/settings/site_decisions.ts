import type { SiteDecision } from "../../lib/core/permissions/index.ts";
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

/** What identifies a decision: one declared category and host of one mod. */
export type SiteDecisionLine = Pick<SiteDecision, "mod" | "category" | "host">;

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

function isSiteDecision(entry: unknown): entry is SiteDecision {
  if (typeof entry !== "object" || entry === null) {
    return false;
  }
  const fields = entry as Record<string, unknown>;
  return (
    isWebAddress(fields.mod) &&
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

/** A frozen copy of one decision, with only its own fields. */
function freezeDecision(decision: SiteDecision): SiteDecision {
  const frozenDecision: SiteDecision = {
    mod: decision.mod,
    title: decision.title,
    category: decision.category,
    host: decision.host,
    allowed: decision.allowed,
  };
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
 * Keeps `decisions`, each replacing a remembered one for the same mod,
 * category and host, stored when the storage allows.
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

/** The decisions of every mod but the one at `mod`. */
function leaveOutMod(
  decisions: readonly SiteDecision[],
  mod: string,
): SiteDecision[] {
  const keptDecisions: SiteDecision[] = [];
  for (const decision of decisions) {
    if (decision.mod !== mod) {
      keptDecisions.push(decision);
    }
  }
  return keptDecisions;
}

/**
 * Forgets every decision of the mod file at `mod` with one write, stored
 * when the storage allows. Running mods keep their permissions.
 */
export function removeModSiteDecisions(
  store: SiteDecisions,
  mod: string,
): void {
  publishDecisions(store, Object.freeze(leaveOutMod(store.snapshot, mod)));
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
