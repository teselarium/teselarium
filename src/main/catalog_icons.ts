import { LayoutGrid, Puzzle, Shapes } from "lucide-react";
import type { LucideIcon } from "lucide-react";

/**
 * The icon of each catalog kind, shared by the sidebar's vanilla sections and
 * the stage bar, so one concept has one icon across the app.
 */
export const MOD_ICON: LucideIcon = Puzzle;
export const COLLECTION_ICON: LucideIcon = LayoutGrid;
export const MOSAIC_ICON: LucideIcon = Shapes;
