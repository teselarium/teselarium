import type { ReactElement } from "react";
import { Checkbox } from "@/vendor/shadcn/ui/checkbox.tsx";
import { isCheckableRow } from "../../lib/user_catalog/index.ts";
import type {
  ImportReview,
  ImportReviewRow,
} from "../../lib/user_catalog/index.ts";
import { STATUS_VIEWS } from "./review_statuses.ts";
import { StatusBadge } from "./StatusBadge.tsx";

interface ReviewListProps {
  review: ImportReview;
  /** The checked rows, by index. */
  checked: ReadonlySet<number>;
  isDisabled: boolean;
  onToggle: (index: number, isChecked: boolean) => void;
}

interface ReviewRowProps {
  row: ImportReviewRow;
  index: number;
  isChecked: boolean;
  isDisabled: boolean;
  onToggle: (index: number, isChecked: boolean) => void;
}

function describeCheckbox(row: ImportReviewRow): string {
  if (row.status === "missing") {
    return `Remove ${row.path} from your catalog`;
  }
  return `Import ${row.path}`;
}

function describeIgnored(count: number): string {
  if (count === 1) {
    return "1 other file was ignored.";
  }
  return `${count} other files were ignored.`;
}

function ReviewRow({
  row,
  index,
  isChecked,
  isDisabled,
  onToggle,
}: ReviewRowProps): ReactElement {
  const view = STATUS_VIEWS[row.status];
  const isCheckable = isCheckableRow(row);

  function handleCheckedChange(checkedState: boolean | "indeterminate"): void {
    onToggle(index, checkedState === true);
  }

  const warnings: ReactElement[] = [];
  for (const warning of row.warnings) {
    warnings.push(
      <li key={warning} className="text-warning">
        {warning}
      </li>,
    );
  }
  return (
    <li className="flex gap-3 py-2" data-review-row={row.status}>
      {/* 32px on a phone, as touch needs; the app's usual size from `sm`. */}
      <Checkbox
        className="mt-0.5 size-8 sm:size-5"
        aria-label={describeCheckbox(row)}
        checked={isCheckable && isChecked}
        disabled={!isCheckable || isDisabled}
        onCheckedChange={handleCheckedChange}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <code className="text-sm [overflow-wrap:anywhere]">{row.path}</code>
          <StatusBadge variant={view.variant}>{view.label}</StatusBadge>
        </div>
        {row.title === null ? null : (
          <span className="text-sm [overflow-wrap:anywhere]">{row.title}</span>
        )}
        {row.error === null ? null : (
          <p className="m-0 text-sm text-destructive [overflow-wrap:anywhere]">
            {row.error}
          </p>
        )}
        {warnings.length === 0 ? null : (
          <ul className="m-0 list-none p-0 text-sm [overflow-wrap:anywhere]">
            {warnings}
          </ul>
        )}
        {row.status === "missing" ? (
          <p className="m-0 text-sm text-muted-foreground">
            Check it to remove it from your catalog.
          </p>
        ) : null}
      </div>
    </li>
  );
}

/** The review's rows, in a list that scrolls inside the dialog, and the count of ignored files. */
export function ReviewList({
  review,
  checked,
  isDisabled,
  onToggle,
}: ReviewListProps): ReactElement {
  const rows: ReactElement[] = [];
  for (const [index, row] of review.rows.entries()) {
    rows.push(
      <ReviewRow
        key={`${row.status}:${row.path}:${index}`}
        row={row}
        index={index}
        isChecked={checked.has(index)}
        isDisabled={isDisabled}
        onToggle={onToggle}
      />,
    );
  }
  return (
    <div className="flex min-h-0 flex-col gap-2">
      {rows.length === 0 ? (
        <p className="m-0 text-sm text-muted-foreground">
          No mosaic file was picked.
        </p>
      ) : (
        <ul
          aria-label="Picked files"
          data-review-list=""
          className="m-0 max-h-[45vh] list-none divide-y overflow-y-auto p-0"
        >
          {rows}
        </ul>
      )}
      {review.ignoredCount === 0 ? null : (
        <p className="m-0 text-sm text-muted-foreground">
          {describeIgnored(review.ignoredCount)}
        </p>
      )}
    </div>
  );
}
