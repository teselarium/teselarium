import { describe, expect, it } from "vitest";
import { FakeHistory } from "../../../test/fake_history.ts";
import {
  readHistoryPosition,
  readHistorySection,
  writeStageEntry,
} from "./stage_history.ts";

describe("readHistoryPosition", function describeReadHistoryPosition(): void {
  it("reads the stage's position", function readsPosition(): void {
    expect(readHistoryPosition({ teselarium: { position: 3 } })).toBe(3);
    expect(readHistoryPosition({ teselarium: { position: 0 } })).toBe(0);
    expect(
      readHistoryPosition({ teselarium: { position: 2, section: "mods" } }),
    ).toBe(2);
  });

  it("gives null for any other state", function readsOtherStates(): void {
    const otherStates = [
      null,
      undefined,
      "position",
      { key: "router-key" },
      { teselarium: null },
      { teselarium: { position: "3" } },
      { teselarium: { position: -1 } },
      { teselarium: { position: 1.5 } },
    ];

    for (const otherState of otherStates) {
      expect(readHistoryPosition(otherState)).toBeNull();
    }
  });
});

describe("readHistorySection", function describeReadHistorySection(): void {
  it("reads the stage's section", function readsSection(): void {
    expect(
      readHistorySection({ teselarium: { position: 1, section: "mods" } }),
    ).toBe("mods");
  });

  it("gives null for a missing or invalid section", function readsInvalidSections(): void {
    const otherStates = [
      null,
      { teselarium: null },
      { teselarium: { position: 1 } },
      { teselarium: { position: 1, section: null } },
      { teselarium: { position: 1, section: 3 } },
      { teselarium: { position: 1, section: "" } },
      { teselarium: { position: 1, section: ["mods"] } },
      { teselarium: { position: 1, section: { id: "mods" } } },
    ];

    for (const otherState of otherStates) {
      expect(readHistorySection(otherState)).toBeNull();
    }
  });
});

describe("writeStageEntry", function describeWriteStageEntry(): void {
  it("pushes an entry with the position, the section and the hash", function pushesEntry(): void {
    const history = new FakeHistory("#/");

    writeStageEntry(history, "push", {
      position: 1,
      section: "mods",
      hash: "#/run?mod=mod_explorer",
    });

    expect(history.entries).toEqual([
      { state: null, hash: "#/" },
      {
        state: { teselarium: { position: 1, section: "mods" } },
        hash: "#/run?mod=mod_explorer",
      },
    ]);
  });

  it("replaces the current entry", function replacesEntry(): void {
    const history = new FakeHistory("");

    writeStageEntry(history, "replace", {
      position: 0,
      section: null,
      hash: "#/run?mod=a",
    });

    expect(history.entries).toEqual([
      {
        state: { teselarium: { position: 0, section: null } },
        hash: "#/run?mod=a",
      },
    ]);
  });
});
