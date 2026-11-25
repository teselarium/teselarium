import type { ReactElement } from "react";
import { Checkbox } from "@/vendor/shadcn/ui/checkbox.tsx";
import { isCheckableRow } from "../../lib/user_catalog/index.ts";
import type {
  ConflictChoice,
  ImportReview,
  ImportReviewRow,
} from "../../lib/user_catalog/index.ts";
import { STATUS_VIEWS } from "./review_statuses.ts";
import { StatusBadge } from "./StatusBadge.tsx";

interface ReviewListProps {
  review: ImportReview;
  /** The checked rows, by index. */
  checked: ReadonlySet<number>;
  /** The choice of each conflict, by index. */
  choices: ReadonlyMap<number, ConflictChoice>;
  isDisabled: boolean;
  onToggle: (index: number, isChecked: boolean) => void;
  onChoose: (index: number, choice: ConflictChoice) => void;
}

interface ReviewRowProps {
  row: ImportReviewRow;
  index: number;
  isChecked: boolean;
  choice: ConflictChoice | null;
  isDisabled: boolean;
  onToggle: (index: number, isChecked: boolean) => void;
  onChoose: (index: number, choice: ConflictChoice) => void;
}

/** The choices of a conflict, in the order the review offers them (`user-catalog`, "Conflict choices"). */
const CONFLICT_CHOICE_LABELS: Record<ConflictChoice, string> = {
  "keep-mine": "Keep mine",
  "take-file": "Take the file",
  "keep-both": "Keep both",
};

/** What an update says when it replaces changes made here since export. */
const REPLACES_LOCAL_CHANGES_MESSAGE =
  "The changes made here since the last export are replaced. They stay in the history.";

interface ConflictChoicesProps {
  path: string;
  index: number;
  choice: ConflictChoice | null;
  isDisabled: boolean;
  onChoose: (index: number, choice: ConflictChoice) => void;
}

/**
 * A conflict's choices: native radio buttons, which keep the radio group's
 * keyboard and screen reader behavior, 32px tall on a phone. None is chosen
 * at first.
 */
function ConflictChoices({
  path,
  index,
  choice,
  isDisabled,
  onChoose,
}: ConflictChoicesProps): ReactElement {
  const options: ReactElement[] = [];
  for (const [value, label] of Object.entries(CONFLICT_CHOICE_LABELS)) {
    const conflictChoice = value as ConflictChoice;
    options.push(
      <label
        key={value}
        className="flex min-h-8 cursor-pointer items-center gap-2 text-sm"
      >
        <input
          type="radio"
          name={`conflict-${index}`}
          value={value}
          className="size-5 accent-primary"
          checked={choice === conflictChoice}
          disabled={isDisabled}
          onChange={onChoose.bind(undefined, index, conflictChoice)}
        />
        {label}
      </label>,
    );
  }
  return (
    <fieldset className="m-0 flex flex-wrap gap-x-4 border-0 p-0">
      <legend className="sr-only">What to do with {path}</legend>
      {options}
    </fieldset>
  );
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
  choice,
  isDisabled,
  onToggle,
  onChoose,
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
        {row.status === "conflict" ? (
          <ConflictChoices
            path={row.path}
            index={index}
            choice={choice}
            isDisabled={isDisabled}
            onChoose={onChoose}
          />
        ) : null}
        {row.replacesLocalChanges ? (
          <p
            className="m-0 text-sm text-warning"
            data-replaces-local-changes=""
          >
            {REPLACES_LOCAL_CHANGES_MESSAGE}
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
  choices,
  isDisabled,
  onToggle,
  onChoose,
}: ReviewListProps): ReactElement {
  const rows: ReactElement[] = [];
  for (const [index, row] of review.rows.entries()) {
    rows.push(
      <ReviewRow
        key={`${row.status}:${row.path}:${index}`}
        row={row}
        index={index}
        isChecked={checked.has(index)}
        choice={choices.get(index) ?? null}
        isDisabled={isDisabled}
        onToggle={onToggle}
        onChoose={onChoose}
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
