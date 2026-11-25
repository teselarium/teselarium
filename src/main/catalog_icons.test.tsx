import { render } from "@testing-library/react";
import { Shapes } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { describe, expect, it } from "vitest";
import { COLLECTION_ICON, MOD_ICON, MOSAIC_ICON } from "./catalog_icons.ts";

/** The drawing of an icon: the inner markup of the `<svg>` it renders. */
function readDrawing(Icon: LucideIcon): string {
  const { container } = render(<Icon />);
  const svg = container.querySelector("svg");
  if (svg === null) {
    throw new Error("Expected the icon to render an <svg>");
  }
  return svg.innerHTML;
}

describe("catalog icons", function describeCatalogIcons(): void {
  it("draws each catalog kind differently", function drawsDistinctIcons(): void {
    const drawings = new Set([
      readDrawing(MOD_ICON),
      readDrawing(COLLECTION_ICON),
      readDrawing(MOSAIC_ICON),
    ]);

    expect(drawings.size).toBe(3);
    expect(COLLECTION_ICON).toBe(Shapes);
  });

  it("keeps lucide's stroke in the text color", function keepsLucideStroke(): void {
    for (const Icon of [MOD_ICON, MOSAIC_ICON]) {
      const { container } = render(<Icon />);
      const svg = container.querySelector("svg");

      expect(svg).toHaveAttribute("stroke", "currentColor");
      expect(svg).toHaveAttribute("stroke-width", "2");
      expect(svg).toHaveAttribute("viewBox", "0 0 24 24");
    }
  });

  it("draws the mosaic as a faint tile holding four filled shapes", function drawsMosaicTile(): void {
    const { container } = render(<MOSAIC_ICON />);
    const [tile, ...shapes] = Array.from(container.querySelectorAll("svg > *"));

    expect(tile).toHaveAttribute("fill", "currentColor");
    expect(tile).toHaveAttribute("fill-opacity", "0.1");
    expect(tile).toHaveAttribute("stroke-opacity", "0.25");
    const classes: string[] = [];
    for (const shape of shapes) {
      expect(shape).toHaveAttribute("stroke", "none");
      classes.push(shape.getAttribute("class") ?? "");
    }
    expect(classes).toEqual([
      "mosaic-shape mosaic-shape-1",
      "mosaic-shape mosaic-shape-2",
      "mosaic-shape mosaic-shape-3",
      "mosaic-shape mosaic-shape-4",
    ]);
  });
});
