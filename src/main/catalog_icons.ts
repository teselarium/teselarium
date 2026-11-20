import { createLucideIcon, Shapes } from "lucide-react";
import type { LucideIcon } from "lucide-react";

/**
 * A mod: lucide's `square-arrow-right-enter` turned towards the bottom right,
 * on lucide's dashed square (`square-dashed`), the place a mod fills: the
 * arrow enters through the square's open top-left corner. The same square as
 * the mosaic's frame. Drawn on lucide's grid, so it keeps lucide's stroke and
 * color settings.
 */
const ModIcon: LucideIcon = createLucideIcon("opentesela-mod", [
  ["path", { d: "M19 3a2 2 0 0 1 2 2", key: "corner-top-right" }],
  ["path", { d: "M21 19a2 2 0 0 1-2 2", key: "corner-bottom-right" }],
  ["path", { d: "M5 21a2 2 0 0 1-2-2", key: "corner-bottom-left" }],
  ["path", { d: "M9 3h1", key: "dash-top-left" }],
  ["path", { d: "M14 3h1", key: "dash-top-right" }],
  ["path", { d: "M9 21h1", key: "dash-bottom-left" }],
  ["path", { d: "M14 21h1", key: "dash-bottom-right" }],
  ["path", { d: "M3 9v1", key: "dash-left-top" }],
  ["path", { d: "M3 14v1", key: "dash-left-bottom" }],
  ["path", { d: "M21 9v1", key: "dash-right-top" }],
  ["path", { d: "M21 14v1", key: "dash-right-bottom" }],
  ["path", { d: "M3 3l11 11", key: "arrow-line" }],
  ["path", { d: "M14 8v6H8", key: "arrow-head" }],
]);

/**
 * A mosaic: a tile holding shapes arranged on a grid, the tiles of a
 * collection (see `Shapes`) put in place. The tile is outlined in the text
 * color at a quarter of its opacity and filled with it at a tenth, half a
 * unit larger than the mod's square on each side, so both read as the same
 * size. The shapes are filled, without stroke, by the app's stylesheet
 * (`.mosaic-shape` in app.css): the theme's colors, made more saturated.
 */
const TILE_STROKE_OPACITY = "0.25";
const TILE_FILL_OPACITY = "0.1";

const MosaicIcon: LucideIcon = createLucideIcon("opentesela-mosaic", [
  [
    "rect",
    {
      x: "2.5",
      y: "2.5",
      width: "19",
      height: "19",
      rx: "2",
      fill: "currentColor",
      fillOpacity: TILE_FILL_OPACITY,
      strokeOpacity: TILE_STROKE_OPACITY,
      key: "tile",
    },
  ],
  [
    "path",
    {
      d: "M8.5 5.75 11.75 11.25H5.25z",
      stroke: "none",
      className: "mosaic-shape mosaic-shape-1",
      key: "triangle-top",
    },
  ],
  [
    "circle",
    {
      cx: "15.5",
      cy: "8.5",
      r: "2.75",
      stroke: "none",
      className: "mosaic-shape mosaic-shape-2",
      key: "circle",
    },
  ],
  [
    "rect",
    {
      x: "5.75",
      y: "12.75",
      width: "5.5",
      height: "5.5",
      stroke: "none",
      className: "mosaic-shape mosaic-shape-3",
      key: "square",
    },
  ],
  [
    "path",
    {
      d: "M15.5 12.75 18.75 18.25H12.25z",
      stroke: "none",
      className: "mosaic-shape mosaic-shape-4",
      key: "triangle-bottom",
    },
  ],
]);

/**
 * The icon of each catalog kind, shared by the sidebar's vanilla sections and
 * the stage bar, so one concept has one icon across the app.
 */
export const MOD_ICON: LucideIcon = ModIcon;
export const COLLECTION_ICON: LucideIcon = Shapes;
export const MOSAIC_ICON: LucideIcon = MosaicIcon;
