import { describe, expect, it } from "vitest";
import { isWebAddress } from "./detail_addresses.ts";

const WEB_ADDRESSES: readonly string[] = Object.freeze([
  "https://example.org/mods/country_map/mod.yaml",
  "http://localhost:5173/#/run?mod=mod_viewer",
]);

const OTHER_VALUES: readonly string[] = Object.freeze([
  "file:///home/user/mods/country_map/mod.yaml",
  "blob:https://example.org/3f2a1c9e-7b4d-4e1a-9c8f-2d6b5a4e3c1f",
  "data:text/plain,hello",
  "javascript:alert(1)",
  "mod_viewer",
  "None",
  "Unsaved combination",
  "",
]);

describe("isWebAddress", function describeIsWebAddress(): void {
  it("accepts http and https addresses", function acceptsWebAddresses(): void {
    expect(WEB_ADDRESSES.filter(isWebAddress)).toEqual(WEB_ADDRESSES);
  });

  it("refuses other protocols, names and text", function refusesOthers(): void {
    expect(OTHER_VALUES.filter(isWebAddress)).toEqual([]);
  });
});
