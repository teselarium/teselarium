import type { ImportStatus } from "../../lib/user_catalog/index.ts";
import type { StatusVariant } from "./StatusBadge.tsx";

/** How the review shows a status: its label and its badge variant. */
export interface StatusView {
  label: string;
  variant: StatusVariant;
}

/** The badge of each status (`user-catalog`, "User catalog dialog colors"). */
export const STATUS_VIEWS: Record<ImportStatus, StatusView> = {
  new: { label: "New", variant: "success" },
  changed: { label: "Changed", variant: "warning" },
  unchanged: { label: "Unchanged", variant: "outline" },
  "changed-here": { label: "Changed here only", variant: "outline" },
  conflict: { label: "Changed here and in the file", variant: "warning" },
  invalid: { label: "Not a mosaic", variant: "destructive" },
  missing: { label: "Not in the folder", variant: "outline" },
};
