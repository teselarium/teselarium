import { describe, expect, it } from "vitest";
import type { StoredVersion } from "../core/storage/index.ts";
import {
  isChangedSinceExport,
  MAX_KEPT_VERSIONS,
  pruneVersions,
  readSyncedText,
} from "./index.ts";

const ADDRESS = "teselarium-browser:///r1/nobel_map.yaml";

/** The time of the `index`-th version: one minute apart, from 10:00. */
function readTime(index: number): string {
  const time = new Date(Date.UTC(2026, 10, 20, 10, index)).toISOString();
  return time;
}

function buildVersion(
  index: number,
  kind: StoredVersion["kind"],
  text: string,
): StoredVersion {
  const version: StoredVersion = {
    address: ADDRESS,
    savedAt: readTime(index),
    kind,
    text,
  };
  return version;
}

/** An imported version, then `saveCount` saves, newest first. */
function buildSavedHistory(saveCount: number): StoredVersion[] {
  const versions: StoredVersion[] = [buildVersion(0, "imported", "imported")];
  for (let index = 1; index <= saveCount; index += 1) {
    versions.push(buildVersion(index, "saved", `save ${index}`));
  }
  versions.reverse();
  return versions;
}

function readSavedAt(version: { savedAt: string }): string {
  return version.savedAt;
}

describe("pruneVersions", function describePruneVersions(): void {
  it("keeps every version up to the limit", function keepsUnderLimit(): void {
    const versions = buildSavedHistory(MAX_KEPT_VERSIONS - 1);

    expect(pruneVersions(versions, readTime(0))).toEqual([]);
  });

  it("Twenty-second save", function keepsSyncedVersion(): void {
    const versions = buildSavedHistory(21);

    const deleted = pruneVersions(versions, readTime(0));

    expect(deleted.map(readSavedAt)).toEqual([readTime(1)]);
    expect(versions.length - deleted.length).toBe(21);
  });

  it("drops the oldest versions of a mosaic never exported", function dropsOldest(): void {
    const versions = buildSavedHistory(21);

    const deleted = pruneVersions(versions, null);

    expect(deleted.map(readSavedAt)).toEqual([readTime(1), readTime(0)]);
  });

  it("gives keys, not texts", function givesKeys(): void {
    const deleted = pruneVersions(buildSavedHistory(21), null);

    expect(deleted[0]).toEqual({ address: ADDRESS, savedAt: readTime(1) });
  });
});

describe("isChangedSinceExport", function describeChangedSinceExport(): void {
  it("is unchanged with the synced text", function isUnchanged(): void {
    expect(isChangedSinceExport("text", "text")).toBe(false);
  });

  it("is changed with another text", function isChanged(): void {
    expect(isChangedSinceExport("edited", "text")).toBe(true);
  });

  it("is changed when never exported", function isNeverExported(): void {
    expect(isChangedSinceExport("text", null)).toBe(true);
  });
});

describe("readSyncedText", function describeReadSyncedText(): void {
  it("reads the text of the synced version", function readsSyncedText(): void {
    const versions = buildSavedHistory(2);

    expect(readSyncedText(versions, readTime(0))).toBe("imported");
  });

  it("is null without a synced version", function readsNoSyncedText(): void {
    expect(readSyncedText(buildSavedHistory(2), null)).toBeNull();
    expect(readSyncedText([], readTime(0))).toBeNull();
  });
});
