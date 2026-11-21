import { useState } from "react";
import type { ReactElement } from "react";
import { DetailActions } from "./DetailActions.tsx";
import { isWebAddress } from "./detail_addresses.ts";
import type { DetailOpen } from "./detail_viewers.ts";
import { stopKeyPropagation } from "./list_keys.ts";

/**
 * One detail of a list's details page: a term, its value, and where its
 * Open link goes, or `null` for no Open link.
 */
export interface ListDetail {
  term: string;
  value: string;
  open: DetailOpen | null;
}

interface ListDetailsProps {
  details: readonly ListDetail[];
}

function renderDetail(
  detail: ListDetail,
  onFeedbackChange: (feedback: string) => void,
): ReactElement {
  return (
    <div key={detail.term} className="flex flex-col gap-0.5">
      <dt className="text-muted-foreground">{detail.term}</dt>
      <dd className="flex items-start gap-1">
        <code className="min-w-0 flex-1 self-center [overflow-wrap:anywhere]">
          {detail.value}
        </code>
        {isWebAddress(detail.value) ? (
          <DetailActions
            term={detail.term}
            value={detail.value}
            open={detail.open}
            onFeedbackChange={onFeedbackChange}
          />
        ) : null}
      </dd>
    </div>
  );
}

/**
 * The details of a list's details page, after its "Back" row: each term
 * and its value, as text the user can select, and, for a web address, its
 * Copy and Open controls (`DetailActions`). Keys stay in the section, so
 * Enter or Space on a control never chooses "Back". A polite live region
 * says how the last copy went.
 */
export function ListDetails({ details }: ListDetailsProps): ReactElement {
  const [copyFeedback, setCopyFeedback] = useState("");
  const lines: ReactElement[] = [];
  for (const detail of details) {
    lines.push(renderDetail(detail, setCopyFeedback));
  }
  return (
    <div
      className="border-t p-3 text-xs select-text"
      onKeyDown={stopKeyPropagation}
    >
      <dl aria-label="Details" className="flex flex-col gap-2">
        {lines}
      </dl>
      <p className="sr-only" aria-live="polite">
        {copyFeedback}
      </p>
    </div>
  );
}
