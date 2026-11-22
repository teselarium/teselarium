import { describe, expect, it, vi } from "vitest";
import type { SiteDecision } from "../../lib/core/permissions/index.ts";
import {
  createBlockedStorage,
  createFullStorage,
  createMemoryStorage,
} from "../../test/memory_storage.ts";
import type { MemoryStorage } from "../../test/memory_storage.ts";
import {
  buildProbeDecision,
  PROBE_CONNECT_PERMISSION,
  SAMPLE_COVERS_PERMISSION,
} from "../../test/sample_mods.ts";
import {
  createSiteDecisions,
  readSiteDecisionsSnapshot,
  rememberSiteDecisions,
  removeDeclaredSiteDecisions,
  removeSiteDecision,
  SITE_DECISIONS_KEY,
  subscribeSiteDecisions,
} from "./site_decisions.ts";

const COVERS_ALLOW = buildProbeDecision(SAMPLE_COVERS_PERMISSION, true);
const COVERS_REFUSAL = buildProbeDecision(SAMPLE_COVERS_PERMISSION, false);
const CONNECT_REFUSAL = buildProbeDecision(PROBE_CONNECT_PERMISSION, false);
const MOSAIC_SOURCE = "https://mosaics.example.net/nobel/mosaic.yaml";
const MOSAIC_COVERS_ALLOW: SiteDecision = {
  mosaic: MOSAIC_SOURCE,
  title: "Nobel books",
  category: "show",
  host: "https://covers.openlibrary.org",
  allowed: true,
};
const ATLAS_ALLOW: SiteDecision = {
  ...COVERS_ALLOW,
  mod: "https://mods.example.net/atlas/mod_conf.yaml",
  title: "Atlas",
};

function buildStoredStorage(stored: unknown): MemoryStorage {
  const storage = createMemoryStorage();
  storage.setItem(SITE_DECISIONS_KEY, JSON.stringify(stored));
  return storage;
}

function readStoredDecisions(storage: MemoryStorage): unknown {
  const stored: unknown = JSON.parse(
    storage.getItem(SITE_DECISIONS_KEY) ?? "null",
  );
  return stored;
}

describe("createSiteDecisions", function describeCreateSiteDecisions(): void {
  it("starts empty without a stored value", function startsEmpty(): void {
    const store = createSiteDecisions({ storage: createMemoryStorage() });

    expect(readSiteDecisionsSnapshot(store)).toEqual([]);
  });

  it("reads valid stored decisions", function readsValidDecisions(): void {
    const storage = buildStoredStorage([COVERS_ALLOW, CONNECT_REFUSAL]);

    const store = createSiteDecisions({ storage });

    expect(readSiteDecisionsSnapshot(store)).toEqual([
      COVERS_ALLOW,
      CONNECT_REFUSAL,
    ]);
  });

  it("drops the entries that are not valid decisions", function dropsInvalidEntries(): void {
    const invalidEntries: unknown[] = [
      null,
      "decision",
      { ...COVERS_ALLOW, mod: "./probe/mod_conf.yaml" },
      { ...COVERS_ALLOW, mod: "ftp://mods.example.net/probe/mod_conf.yaml" },
      { ...COVERS_ALLOW, category: "listen" },
      { ...COVERS_ALLOW, host: "" },
      { ...COVERS_ALLOW, title: 3 },
      { ...COVERS_ALLOW, allowed: "yes" },
    ];
    const storage = buildStoredStorage([...invalidEntries, CONNECT_REFUSAL]);

    const store = createSiteDecisions({ storage });

    expect(readSiteDecisionsSnapshot(store)).toEqual([CONNECT_REFUSAL]);
  });

  it("reads a stored mod decision as before", function readsStoredModDecision(): void {
    const storage = buildStoredStorage([
      {
        mod: "https://mods.example.net/probe/mod_conf.yaml",
        title: "Probe",
        category: "show",
        host: "https://upload.wikimedia.org",
        allowed: true,
      },
    ]);

    const store = createSiteDecisions({ storage });

    expect(readSiteDecisionsSnapshot(store)).toEqual([
      {
        mod: "https://mods.example.net/probe/mod_conf.yaml",
        title: "Probe",
        category: "show",
        host: "https://upload.wikimedia.org",
        allowed: true,
      },
    ]);
  });

  it("reads a stored mosaic decision", function readsMosaicDecision(): void {
    const storage = buildStoredStorage([MOSAIC_COVERS_ALLOW, COVERS_ALLOW]);

    const store = createSiteDecisions({ storage });

    expect(readSiteDecisionsSnapshot(store)).toEqual([
      MOSAIC_COVERS_ALLOW,
      COVERS_ALLOW,
    ]);
  });

  it("reads a decision of a mosaic stored in this browser", function readsStoredMosaicDecision(): void {
    const storedMosaicAllow: SiteDecision = {
      ...MOSAIC_COVERS_ALLOW,
      mosaic: "opentesela-browser:///r1/nobel_books.yaml",
    };
    const storage = buildStoredStorage([storedMosaicAllow]);

    const store = createSiteDecisions({ storage });

    expect(readSiteDecisionsSnapshot(store)).toEqual([storedMosaicAllow]);
  });

  it("drops a mod decision whose mod is stored in this browser", function dropsBrowserMod(): void {
    const storage = buildStoredStorage([
      { ...COVERS_ALLOW, mod: "opentesela-browser:///r1/mod_conf.yaml" },
    ]);

    const store = createSiteDecisions({ storage });

    expect(readSiteDecisionsSnapshot(store)).toEqual([]);
  });

  it("drops an entry with both a mod and a mosaic, or neither", function dropsAmbiguousEntries(): void {
    const { mod: _mod, ...noDeclarer } = COVERS_ALLOW;
    const storage = buildStoredStorage([
      { ...COVERS_ALLOW, mosaic: MOSAIC_SOURCE },
      noDeclarer,
      { ...MOSAIC_COVERS_ALLOW, mosaic: "./nobel/mosaic.yaml" },
      CONNECT_REFUSAL,
    ]);

    const store = createSiteDecisions({ storage });

    expect(readSiteDecisionsSnapshot(store)).toEqual([CONNECT_REFUSAL]);
  });

  it("keeps a mosaic decision apart from a mod decision for the same address and host", function keepsSubjectsApart(): void {
    const modDecision: SiteDecision = {
      ...MOSAIC_COVERS_ALLOW,
      mosaic: undefined,
      mod: MOSAIC_SOURCE,
      allowed: false,
    };
    const store = createSiteDecisions({ storage: createMemoryStorage() });

    rememberSiteDecisions(store, [MOSAIC_COVERS_ALLOW]);
    rememberSiteDecisions(store, [modDecision]);

    expect(readSiteDecisionsSnapshot(store)).toEqual([
      MOSAIC_COVERS_ALLOW,
      {
        mod: MOSAIC_SOURCE,
        title: "Nobel books",
        category: "show",
        host: "https://covers.openlibrary.org",
        allowed: false,
      },
    ]);
  });

  it("keeps the last of duplicated decisions", function keepsLastDuplicate(): void {
    const storage = buildStoredStorage([COVERS_ALLOW, COVERS_REFUSAL]);

    const store = createSiteDecisions({ storage });

    expect(readSiteDecisionsSnapshot(store)).toEqual([COVERS_REFUSAL]);
  });

  it("ignores a stored value that is not a list", function ignoresNonList(): void {
    const store = createSiteDecisions({
      storage: buildStoredStorage({ decisions: [COVERS_ALLOW] }),
    });

    expect(readSiteDecisionsSnapshot(store)).toEqual([]);
  });

  it("starts empty when the storage cannot be read", function startsEmptyWhenBlocked(): void {
    const store = createSiteDecisions({ storage: createBlockedStorage() });

    expect(readSiteDecisionsSnapshot(store)).toEqual([]);
  });

  it("keeps its key outside the mod storage slots", function keepsKeyApart(): void {
    expect(SITE_DECISIONS_KEY).toBe("opentesela.site-decisions");
    expect(SITE_DECISIONS_KEY.startsWith("opentesela.mod-storage:")).toBe(
      false,
    );
  });
});

describe("rememberSiteDecisions", function describeRememberSiteDecisions(): void {
  it("adds the decisions and stores them", function remembersDecisions(): void {
    const storage = createMemoryStorage();
    const store = createSiteDecisions({ storage });

    rememberSiteDecisions(store, [COVERS_ALLOW, CONNECT_REFUSAL]);

    expect(readSiteDecisionsSnapshot(store)).toEqual([
      COVERS_ALLOW,
      CONNECT_REFUSAL,
    ]);
    expect(readStoredDecisions(storage)).toEqual([
      COVERS_ALLOW,
      CONNECT_REFUSAL,
    ]);
  });

  it("replaces a decision for the same mod, category and host", function replacesDecision(): void {
    const store = createSiteDecisions({
      storage: buildStoredStorage([COVERS_ALLOW]),
    });

    rememberSiteDecisions(store, [COVERS_REFUSAL]);

    expect(readSiteDecisionsSnapshot(store)).toEqual([COVERS_REFUSAL]);
  });

  it("writes back the cleaned list", function writesCleanedList(): void {
    const storage = buildStoredStorage([null, COVERS_ALLOW]);
    const store = createSiteDecisions({ storage });

    rememberSiteDecisions(store, [CONNECT_REFUSAL]);

    expect(readStoredDecisions(storage)).toEqual([
      COVERS_ALLOW,
      CONNECT_REFUSAL,
    ]);
  });

  it("Storage cannot be written", function keepsDecisionsInMemory(): void {
    const store = createSiteDecisions({ storage: createFullStorage() });

    expect(function remember(): void {
      rememberSiteDecisions(store, [COVERS_ALLOW]);
    }).not.toThrow();
    expect(readSiteDecisionsSnapshot(store)).toEqual([COVERS_ALLOW]);
  });

  it("gives a new frozen snapshot after a change", function freezesSnapshot(): void {
    const store = createSiteDecisions({ storage: createMemoryStorage() });
    const emptySnapshot = readSiteDecisionsSnapshot(store);

    rememberSiteDecisions(store, [COVERS_ALLOW]);

    const snapshot = readSiteDecisionsSnapshot(store);
    expect(snapshot).not.toBe(emptySnapshot);
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot[0])).toBe(true);
    expect(readSiteDecisionsSnapshot(store)).toBe(snapshot);
  });

  it("keeps no reference to the given decisions", function copiesDecisions(): void {
    const store = createSiteDecisions({ storage: createMemoryStorage() });
    const decision: SiteDecision = { ...COVERS_ALLOW };

    rememberSiteDecisions(store, [decision]);
    decision.allowed = false;

    expect(readSiteDecisionsSnapshot(store)).toEqual([COVERS_ALLOW]);
  });
});

describe("removeSiteDecision", function describeRemoveSiteDecision(): void {
  it("removes the decision and stores the rest", function removesDecision(): void {
    const storage = buildStoredStorage([COVERS_ALLOW, CONNECT_REFUSAL]);
    const store = createSiteDecisions({ storage });

    removeSiteDecision(store, COVERS_ALLOW);

    expect(readSiteDecisionsSnapshot(store)).toEqual([CONNECT_REFUSAL]);
    expect(readStoredDecisions(storage)).toEqual([CONNECT_REFUSAL]);
  });

  it("removes in memory when the storage cannot be written", function removesInMemory(): void {
    const storage = buildStoredStorage([COVERS_ALLOW]);
    storage.setItem = createFullStorage().setItem;
    const store = createSiteDecisions({ storage });

    removeSiteDecision(store, COVERS_ALLOW);

    expect(readSiteDecisionsSnapshot(store)).toEqual([]);
  });
});

describe("removeDeclaredSiteDecisions", function describeRemoveDeclaredSiteDecisions(): void {
  it("removes every decision of the mod and keeps the others", function removesModDecisions(): void {
    const storage = buildStoredStorage([
      COVERS_ALLOW,
      ATLAS_ALLOW,
      CONNECT_REFUSAL,
    ]);
    const store = createSiteDecisions({ storage });

    removeDeclaredSiteDecisions(store, {
      subject: "mod",
      source: COVERS_ALLOW.mod,
    });

    expect(readSiteDecisionsSnapshot(store)).toEqual([ATLAS_ALLOW]);
    expect(readStoredDecisions(storage)).toEqual([ATLAS_ALLOW]);
  });

  it("writes once and calls each listener once", function writesOnce(): void {
    const storage = buildStoredStorage([COVERS_ALLOW, CONNECT_REFUSAL]);
    const setItemSpy = vi.spyOn(storage, "setItem");
    const store = createSiteDecisions({ storage });
    const listener = vi.fn<() => void>();
    subscribeSiteDecisions(store, listener);

    removeDeclaredSiteDecisions(store, {
      subject: "mod",
      source: COVERS_ALLOW.mod,
    });

    expect(setItemSpy).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledOnce();
  });

  it("removes in memory when the storage cannot be written", function removesModInMemory(): void {
    const storage = buildStoredStorage([COVERS_ALLOW, ATLAS_ALLOW]);
    storage.setItem = createFullStorage().setItem;
    const store = createSiteDecisions({ storage });

    removeDeclaredSiteDecisions(store, {
      subject: "mod",
      source: COVERS_ALLOW.mod,
    });

    expect(readSiteDecisionsSnapshot(store)).toEqual([ATLAS_ALLOW]);
  });
});

describe("removing mosaic decisions", function describeRemoveMosaicDecisions(): void {
  it("removes one mosaic decision and keeps the mod's", function removesMosaicDecision(): void {
    const storage = buildStoredStorage([MOSAIC_COVERS_ALLOW, COVERS_ALLOW]);
    const store = createSiteDecisions({ storage });

    removeSiteDecision(store, MOSAIC_COVERS_ALLOW);

    expect(readSiteDecisionsSnapshot(store)).toEqual([COVERS_ALLOW]);
  });

  it("removes every decision of a mosaic and keeps the mods'", function removesAllMosaicDecisions(): void {
    const storage = buildStoredStorage([MOSAIC_COVERS_ALLOW, COVERS_ALLOW]);
    const store = createSiteDecisions({ storage });

    removeDeclaredSiteDecisions(store, {
      subject: "mosaic",
      source: MOSAIC_SOURCE,
    });

    expect(readSiteDecisionsSnapshot(store)).toEqual([COVERS_ALLOW]);
    expect(readStoredDecisions(storage)).toEqual([COVERS_ALLOW]);
  });
});

describe("subscribeSiteDecisions", function describeSubscribeSiteDecisions(): void {
  it("calls the listeners after every change, until unsubscribed", function notifiesListeners(): void {
    const store = createSiteDecisions({ storage: createMemoryStorage() });
    const listener = vi.fn<() => void>();
    const unsubscribe = subscribeSiteDecisions(store, listener);

    rememberSiteDecisions(store, [COVERS_ALLOW]);
    removeSiteDecision(store, COVERS_ALLOW);
    unsubscribe();
    rememberSiteDecisions(store, [CONNECT_REFUSAL]);

    expect(listener).toHaveBeenCalledTimes(2);
  });
});
