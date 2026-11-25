import { describe, expect, it } from "vitest";
import type { YamlMapping } from "../files/index.ts";
import { mergeMosaicConfig } from "./index.ts";

describe("mergeMosaicConfig", function describeMergeMosaicConfig(): void {
  it("Nested override", function mergesNestedMappings(): void {
    const modConfig: YamlMapping = {
      map: { zoom: 2, center: [0, 0] },
      markers: { color: "#3366cc" },
    };

    const mergedConfig = mergeMosaicConfig(modConfig, { map: { zoom: 3 } });

    expect(mergedConfig).toEqual({
      map: { zoom: 3, center: [0, 0] },
      markers: { color: "#3366cc" },
    });
  });

  it("Lists are replaced", function replacesLists(): void {
    const mergedConfig = mergeMosaicConfig(
      { columns: [1, 2, 3] },
      { columns: [4] },
    );

    expect(mergedConfig.columns).toEqual([4]);
  });

  it("Null replaces", function replacesWithNull(): void {
    const mergedConfig = mergeMosaicConfig(
      { legend: { show: true } },
      { legend: null },
    );

    expect(mergedConfig.legend).toBeNull();
  });

  it("a mapping replaces a scalar, and a scalar a mapping", function replacesAcrossKinds(): void {
    const mergedConfig = mergeMosaicConfig(
      { title: "Map", legend: { show: true } },
      { title: { text: "Map" }, legend: false },
    );

    expect(mergedConfig).toEqual({ title: { text: "Map" }, legend: false });
  });

  it("keeps the mod's key order and adds the mosaic's keys after", function keepsKeyOrder(): void {
    const mergedConfig = mergeMosaicConfig(
      { first: 1, second: { a: 1 }, third: 3 },
      { extra: true, second: { b: 2 }, first: 10 },
    );

    expect(Object.keys(mergedConfig)).toEqual([
      "first",
      "second",
      "third",
      "extra",
    ]);
    expect(Object.keys(mergedConfig.second as YamlMapping)).toEqual(["a", "b"]);
  });

  it("changes neither input and shares no objects with them", function keepsInputs(): void {
    const modConfig: YamlMapping = { map: { zoom: 2 }, columns: [1] };
    const mosaicConfig: YamlMapping = { map: { center: [0, 0] }, rows: [2] };

    const mergedConfig = mergeMosaicConfig(modConfig, mosaicConfig);
    (mergedConfig.map as YamlMapping).zoom = 9;
    (mergedConfig.columns as number[]).push(2);
    (mergedConfig.rows as number[]).push(3);

    expect(modConfig).toEqual({ map: { zoom: 2 }, columns: [1] });
    expect(mosaicConfig).toEqual({ map: { center: [0, 0] }, rows: [2] });
  });
});
