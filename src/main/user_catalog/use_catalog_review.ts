import { useState } from "react";
import {
  applyReview,
  isCheckableRow,
  listDefaultChecked,
} from "../../lib/user_catalog/index.ts";
import type { ImportReview } from "../../lib/user_catalog/index.ts";
import { applyUserCatalogChanges } from "./user_catalog_store.ts";
import type { UserCatalogStore } from "./user_catalog_store.ts";

/** Where a review dialog is: waiting for files, reading them, showing the review, or applying it. */
export type ReviewPhase = "pick" | "reading" | "review" | "applying";

/** A review dialog's state and what its controls call. */
export interface CatalogReview {
  phase: ReviewPhase;
  review: ImportReview | null;
  checked: ReadonlySet<number>;
  error: string | null;
  /** Whether a checked row would change something, so the apply button is enabled. */
  canApply: boolean;
  /** Reads picked files into a review with `plan`. */
  startReview: (plan: () => Promise<ImportReview>) => void;
  toggle: (index: number, isChecked: boolean) => void;
  showError: (message: string) => void;
  /** Applies the checked rows. Resolves with whether the store changed. */
  apply: () => Promise<boolean>;
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function hasCheckedRow(
  review: ImportReview | null,
  checked: ReadonlySet<number>,
): boolean {
  if (review === null) {
    return false;
  }
  for (const index of checked) {
    const row = review.rows[index];
    if (row !== undefined && isCheckableRow(row)) {
      return true;
    }
  }
  return false;
}

/**
 * The state of the import and update dialogs: picked files become a review,
 * whose new and changed rows start checked, and applying writes the checked
 * rows through the store. A failure shows its message and changes nothing.
 */
export function useCatalogReview(store: UserCatalogStore): CatalogReview {
  const [phase, setPhase] = useState<ReviewPhase>("pick");
  const [review, setReview] = useState<ImportReview | null>(null);
  const [checked, setChecked] = useState<ReadonlySet<number>>(new Set());
  const [error, setError] = useState<string | null>(null);

  async function readReview(plan: () => Promise<ImportReview>): Promise<void> {
    setPhase("reading");
    setError(null);
    try {
      const planned = await plan();
      setReview(planned);
      setChecked(listDefaultChecked(planned));
    } catch (planError) {
      setError(describeError(planError));
    }
    setPhase("review");
  }

  function startReview(plan: () => Promise<ImportReview>): void {
    void readReview(plan);
  }

  function toggle(index: number, isChecked: boolean): void {
    const nextChecked = new Set(checked);
    if (isChecked) {
      nextChecked.add(index);
    } else {
      nextChecked.delete(index);
    }
    setChecked(nextChecked);
  }

  function showError(message: string): void {
    setError(message);
  }

  async function apply(): Promise<boolean> {
    if (review === null) {
      return false;
    }
    setPhase("applying");
    setError(null);
    try {
      await applyUserCatalogChanges(
        store,
        applyReview(review, checked, new Date()),
      );
      return true;
    } catch (applyError) {
      setError(describeError(applyError));
      setPhase("review");
      return false;
    }
  }

  const catalogReview: CatalogReview = {
    phase,
    review,
    checked,
    error,
    canApply: phase === "review" && hasCheckedRow(review, checked),
    startReview,
    toggle,
    showError,
    apply,
  };
  return catalogReview;
}
