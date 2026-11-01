import { readStoredJson, writeStoredJson } from "./stored_json.ts";
import type { SettingsStorage } from "./stored_json.ts";

export interface PlayerSitesOptions {
  storage: SettingsStorage;
}

/** The hosts the user chose to always play from, for every mod. Mutable. */
export interface PlayerSites {
  storage: SettingsStorage;
  listeners: Set<() => void>;
  /** The remembered hosts, frozen, and new after every change. */
  snapshot: readonly string[];
}

/** Outside the `opentesela.mod-storage:` keys, so no mod storage slot can reach it. */
export const PLAYER_SITES_KEY = "opentesela.player-sites";

/** A host name as `URL.hostname` gives it: lower case, without a scheme, port or path. */
function isHost(value: unknown): value is string {
  if (typeof value !== "string" || value === "") {
    return false;
  }
  const address = `https://${value}/`;
  return URL.canParse(address) && new URL(address).hostname === value;
}

/** The hosts of `hosts` that are valid, each kept once, in order. */
function keepValidHosts(hosts: readonly unknown[]): readonly string[] {
  const keptHosts = new Set<string>();
  for (const host of hosts) {
    if (isHost(host)) {
      keptHosts.add(host);
    }
  }
  return Object.freeze([...keptHosts]);
}

function readValidHosts(stored: unknown): readonly string[] {
  if (!Array.isArray(stored)) {
    return Object.freeze([]);
  }
  return keepValidHosts(stored);
}

function publishHosts(store: PlayerSites, hosts: readonly string[]): void {
  store.snapshot = hosts;
  writeStoredJson(store.storage, PLAYER_SITES_KEY, hosts);
  for (const listener of store.listeners) {
    listener();
  }
}

/**
 * Reads the stored hosts, dropping the entries that are not hosts and the
 * duplicates. The cleaned list is written back on the next change.
 */
export function createPlayerSites(options: PlayerSitesOptions): PlayerSites {
  const store: PlayerSites = {
    storage: options.storage,
    listeners: new Set(),
    snapshot: readValidHosts(readStoredJson(options.storage, PLAYER_SITES_KEY)),
  };
  return store;
}

/** Remembers `host` for every mod, stored when the storage allows. */
export function rememberPlayerSite(store: PlayerSites, host: string): void {
  publishHosts(store, keepValidHosts([...store.snapshot, host]));
}

function leaveOutHost(hosts: readonly string[], host: string): string[] {
  const keptHosts: string[] = [];
  for (const keptHost of hosts) {
    if (keptHost !== host) {
      keptHosts.push(keptHost);
    }
  }
  return keptHosts;
}

/**
 * Forgets `host`, stored when the storage allows. The next player of that
 * host asks again; a player already shown keeps playing.
 */
export function removePlayerSite(store: PlayerSites, host: string): void {
  publishHosts(store, Object.freeze(leaveOutHost(store.snapshot, host)));
}

export function readPlayerSitesSnapshot(store: PlayerSites): readonly string[] {
  return store.snapshot;
}

function unsubscribePlayerSites(
  store: PlayerSites,
  listener: () => void,
): void {
  store.listeners.delete(listener);
}

/** Calls `listener` after every change. Returns the function that unsubscribes it. */
export function subscribePlayerSites(
  store: PlayerSites,
  listener: () => void,
): () => void {
  store.listeners.add(listener);
  return unsubscribePlayerSites.bind(undefined, store, listener);
}
