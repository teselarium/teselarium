import type { ReactElement, ReactNode } from "react";
import { Badge } from "@/vendor/shadcn/ui/badge.tsx";

/** The badge variants of the review's statuses. */
export type StatusVariant = "success" | "warning" | "outline" | "destructive";

/**
 * Status badges keep their role's color as text and border, with no fill, as
 * the mods' badges do, so their text has the contrast the theme gives each
 * text role on the dialog's background, in both color schemes.
 */
const VARIANT_CLASSES: Record<StatusVariant, string> = {
  success: "border-success text-success",
  warning: "border-warning text-warning",
  outline: "",
  destructive: "border-destructive text-destructive",
};

interface StatusBadgeProps {
  variant: StatusVariant;
  children: ReactNode;
}

/** shadcn's outline badge in a status color. `data-variant` names the status variant. */
export function StatusBadge({
  variant,
  children,
}: StatusBadgeProps): ReactElement {
  return (
    <Badge
      variant="outline"
      data-variant={variant}
      className={VARIANT_CLASSES[variant]}
    >
      {children}
    </Badge>
  );
}
