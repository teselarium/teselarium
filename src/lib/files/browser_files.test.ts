import { describe, expect, it } from "vitest";
import {
  BROWSER_FILE_PROTOCOL,
  buildBrowserFileAddress,
  isBrowserFileAddress,
} from "./browser_files.ts";

describe("buildBrowserFileAddress", function describeBuildAddress(): void {
  it("File of a folder", function buildsFolderFileAddress(): void {
    const address = buildBrowserFileAddress("r1", "maps/nobel_map.yaml");

    expect(address).toBe("teselarium-browser:///r1/maps/nobel_map.yaml");
  });

  it("Single file", function buildsSingleFileAddress(): void {
    const address = buildBrowserFileAddress("r2", "nobel_map.yaml");

    expect(address).toBe("teselarium-browser:///r2/nobel_map.yaml");
  });

  it("Segment with a space", function encodesSpace(): void {
    const address = buildBrowserFileAddress("r1", "my maps/nobel map.yaml");

    expect(address).toBe("teselarium-browser:///r1/my%20maps/nobel%20map.yaml");
  });

  it("Segment with a URL delimiter", function encodesDelimiters(): void {
    const address = buildBrowserFileAddress("r1", "maps/a#b?c.yaml");

    expect(address).toBe("teselarium-browser:///r1/maps/a%23b%3Fc.yaml");
  });

  it("Path with a leading slash", function ignoresLeadingSlash(): void {
    const address = buildBrowserFileAddress("r1", "/maps/nobel_map.yaml");

    expect(address).toBe("teselarium-browser:///r1/maps/nobel_map.yaml");
  });

  it("Relative reference stays inside the root", function resolvesInsideRoot(): void {
    const address = buildBrowserFileAddress("r1", "maps/nobel_map.yaml");

    const resolved = new URL("../tiles/laureates/", address);

    expect(resolved.href).toBe("teselarium-browser:///r1/tiles/laureates/");
  });
});

describe("isBrowserFileAddress", function describeIsBrowserFileAddress(): void {
  it("Browser address", function acceptsBrowserAddress(): void {
    const isBrowserFile = isBrowserFileAddress(
      "teselarium-browser:///r1/nobel_map.yaml",
    );

    expect(isBrowserFile).toBe(true);
  });

  it("Remote and local addresses", function rejectsOtherAddresses(): void {
    expect(isBrowserFileAddress("https://example.org/a.yaml")).toBe(false);
    expect(isBrowserFileAddress("file:///a.yaml")).toBe(false);
  });

  it("Not a URL", function rejectsNonUrl(): void {
    expect(isBrowserFileAddress("./maps/a.yaml")).toBe(false);
  });

  it("Protocol constant", function namesProtocol(): void {
    expect(BROWSER_FILE_PROTOCOL).toBe("teselarium-browser:");
  });
});
