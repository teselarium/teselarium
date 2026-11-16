import { describe, expect, it } from "vitest";
import type { Metadata } from "../files/index.ts";
import { applyMosaicAliases } from "./index.ts";

describe("applyMosaicAliases", function describeApplyMosaicAliases(): void {
  it("Laureates become country tiles", function renamesLaureateFields(): void {
    const aliasedMetadata = applyMosaicAliases(
      { name: "Bob Dylan", birth_country: "United States", year: 2016 },
      { title: ["name"], country: ["birth_country"] },
    );

    expect(aliasedMetadata).toEqual({
      title: "Bob Dylan",
      country: "United States",
      year: 2016,
    });
  });

  it("keeps each renamed key in its place", function keepsKeyOrder(): void {
    const aliasedMetadata = applyMosaicAliases(
      { year: 2016, name: "Bob Dylan", image: "./dylan.jpg" },
      { title: ["name"] },
    );

    expect(Object.keys(aliasedMetadata)).toEqual(["year", "title", "image"]);
  });

  it("Field already present", function keepsPresentField(): void {
    const aliasedMetadata = applyMosaicAliases(
      { title: "Tarantula", name: "Bob Dylan" },
      { title: ["name"] },
    );

    expect(aliasedMetadata).toEqual({ title: "Tarantula", name: "Bob Dylan" });
  });

  it("First listed name wins", function usesFirstListedName(): void {
    const aliasedMetadata = applyMosaicAliases(
      { origin: "Peru", birth_country: "Peru" },
      { country: ["birth_country", "origin"] },
    );

    expect(aliasedMetadata).toEqual({ origin: "Peru", country: "Peru" });
  });

  it("uses a later name when the first is absent", function usesLaterName(): void {
    const aliasedMetadata = applyMosaicAliases(
      { origin: "Peru" },
      { country: ["birth_country", "origin"] },
    );

    expect(aliasedMetadata).toEqual({ country: "Peru" });
  });

  it("changes no input", function keepsInputs(): void {
    const metadata: Metadata = { name: "Bob Dylan", tags: ["music"] };

    const aliasedMetadata = applyMosaicAliases(metadata, { title: ["name"] });

    expect(metadata).toEqual({ name: "Bob Dylan", tags: ["music"] });
    expect(aliasedMetadata).not.toBe(metadata);
  });
});
