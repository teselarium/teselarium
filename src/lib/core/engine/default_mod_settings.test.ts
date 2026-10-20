import { describe, expect, it } from "vitest";
import { resolveModReference } from "../../mod/index.ts";
import {
  findSwitchedOffMod,
  resolveDefaultModSettings,
} from "./default_mod_settings.ts";
import {
  describeEngineError,
  ModMethodError,
  ModSwitchedOffError,
} from "./engine_errors.ts";

const APP_URL = "https://example.org/app/index.html";
const VIEWER_SOURCE =
  "https://example.org/app/default_mods/mod_viewer/mod_conf.yaml";

describe("resolveDefaultModSettings", function describeResolveSettings(): void {
  it("resolves the folder against the app's address with a trailing slash", function resolvesFolder(): void {
    const defaults = resolveDefaultModSettings(
      { folder: "./default_mods", home: "mod_explorer", switchedOff: [] },
      APP_URL,
    );

    expect(defaults).toEqual({
      folder: "https://example.org/app/default_mods/",
      home: "mod_explorer",
      switchedOff: [],
    });
  });

  it("resolves the switched-off names to sources", function resolvesSwitchedOff(): void {
    const defaults = resolveDefaultModSettings(
      {
        folder: "./default_mods/",
        home: "mod_explorer",
        switchedOff: ["mod_viewer"],
      },
      APP_URL,
    );

    expect(defaults.switchedOff).toEqual([
      { name: "mod_viewer", source: VIEWER_SOURCE },
    ]);
  });
});

describe("findSwitchedOffMod", function describeFindSwitchedOffMod(): void {
  const defaults = resolveDefaultModSettings(
    {
      folder: "./default_mods/",
      home: "mod_explorer",
      switchedOff: ["mod_viewer"],
    },
    APP_URL,
  );

  it("finds the viewer whatever reference names it", function findsViewer(): void {
    const references = [
      "mod_viewer",
      "./default_mods/mod_viewer/",
      "./default_mods/mod_viewer",
      VIEWER_SOURCE,
    ];

    for (const reference of references) {
      const source = resolveModReference(reference, {
        baseUrl: APP_URL,
        defaultModsFolder: defaults.folder,
      });
      expect(findSwitchedOffMod(source, defaults)).toBe("mod_viewer");
    }
  });

  it("gives null for another mod", function ignoresOtherMod(): void {
    const source = resolveModReference("mod_explorer", {
      defaultModsFolder: defaults.folder,
    });

    expect(findSwitchedOffMod(source, defaults)).toBeNull();
  });
});

describe("ModSwitchedOffError", function describeModSwitchedOffError(): void {
  it("is an Error named after its class", function isNamedError(): void {
    const error = new ModSwitchedOffError("mod_viewer", VIEWER_SOURCE);

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(ModSwitchedOffError);
    expect(error.name).toBe("ModSwitchedOffError");
  });

  it("exposes the source and the name", function exposesSource(): void {
    const error = new ModSwitchedOffError("mod_viewer", VIEWER_SOURCE);

    expect(error.source).toBe(VIEWER_SOURCE);
    expect(error.modName).toBe("mod_viewer");
  });

  it("builds the message from the name", function buildsMessage(): void {
    const error = new ModSwitchedOffError("mod_viewer", VIEWER_SOURCE);

    expect(error.message).toBe('The default mod "mod_viewer" is switched off.');
  });

  it("keeps the cause when given", function keepsCause(): void {
    const cause = new Error("listed in switchedOff");

    const error = new ModSwitchedOffError("mod_viewer", VIEWER_SOURCE, {
      cause,
    });

    expect(error.cause).toBe(cause);
  });
});

describe("ModMethodError", function describeModMethodError(): void {
  it("is an Error named after its class", function isNamedError(): void {
    const error = new ModMethodError(-32602, '"key" must be a string');

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(ModMethodError);
    expect(error.name).toBe("ModMethodError");
  });

  it("keeps the code and the message", function keepsCode(): void {
    const error = new ModMethodError(-32602, '"key" must be a string');

    expect(error.code).toBe(-32602);
    expect(error.message).toBe('"key" must be a string');
  });

  it("keeps the cause when given", function keepsCause(): void {
    const cause = new Error("quota exceeded");

    const error = new ModMethodError(-32000, cause.message, { cause });

    expect(error.cause).toBe(cause);
  });
});

describe("describeEngineError", function describeDescribeEngineError(): void {
  it("uses the message of an Error, or the value as text", function describesErrors(): void {
    expect(describeEngineError(new Error("quota exceeded"))).toBe(
      "quota exceeded",
    );
    expect(describeEngineError("offline")).toBe("offline");
  });
});
