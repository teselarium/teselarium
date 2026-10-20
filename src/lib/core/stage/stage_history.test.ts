import { describe, expect, it } from "vitest";
import { FakeHistory } from "../../../test/fake_history.ts";
import {
  readHistoryPosition,
  readStageRoute,
  routeForLink,
  writeStageEntry,
} from "./stage_history.ts";

const HOME_LINK = { mod: "mod_explorer", collection: null, params: {} };

describe("readStageRoute", function describeReadStageRoute(): void {
  it("gives the home mod's link with hash #/ for home", function readsHome(): void {
    for (const hash of ["", "#/", "#/mods/view"]) {
      expect(readStageRoute(hash, "mod_explorer")).toEqual({
        hash: "#/",
        link: HOME_LINK,
        isHome: true,
      });
    }
  });

  it("keeps the hash of a run link", function readsRunLink(): void {
    const hash = "#/run?mod=.%2Fsamples%2Fmods%2Fbook_list&extra=1";

    expect(readStageRoute(hash, "mod_explorer")).toEqual({
      hash,
      link: {
        mod: "./samples/mods/book_list",
        collection: null,
        params: { extra: "1" },
      },
      isHome: false,
    });
  });
});

describe("routeForLink", function describeRouteForLink(): void {
  it("builds the hash with buildRunLink and is not home", function buildsRoute(): void {
    const link = {
      mod: "mod_viewer",
      collection: null,
      params: {
        target: "https://example.org/samples/mods/book_list/mod_conf.yaml",
      },
    };

    expect(routeForLink(link)).toEqual({
      hash: "#/run?mod=mod_viewer&target=https%3A%2F%2Fexample.org%2Fsamples%2Fmods%2Fbook_list%2Fmod_conf.yaml",
      link,
      isHome: false,
    });
  });
});

describe("readHistoryPosition", function describeReadHistoryPosition(): void {
  it("reads the stage's position", function readsPosition(): void {
    expect(readHistoryPosition({ opentesela: { position: 3 } })).toBe(3);
    expect(readHistoryPosition({ opentesela: { position: 0 } })).toBe(0);
  });

  it("gives null for any other state", function readsOtherStates(): void {
    const otherStates = [
      null,
      undefined,
      "position",
      { key: "router-key" },
      { opentesela: null },
      { opentesela: { position: "3" } },
      { opentesela: { position: -1 } },
      { opentesela: { position: 1.5 } },
    ];

    for (const otherState of otherStates) {
      expect(readHistoryPosition(otherState)).toBeNull();
    }
  });
});

describe("writeStageEntry", function describeWriteStageEntry(): void {
  it("pushes an entry with the position and the hash", function pushesEntry(): void {
    const history = new FakeHistory("#/");

    writeStageEntry(history, "push", 1, "#/run?mod=a");

    expect(history.entries).toEqual([
      { state: null, hash: "#/" },
      { state: { opentesela: { position: 1 } }, hash: "#/run?mod=a" },
    ]);
  });

  it("replaces the current entry", function replacesEntry(): void {
    const history = new FakeHistory("");

    writeStageEntry(history, "replace", 0, "#/");

    expect(history.entries).toEqual([
      { state: { opentesela: { position: 0 } }, hash: "#/" },
    ]);
  });
});
