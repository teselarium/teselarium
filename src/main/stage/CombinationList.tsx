import { useMemo, useRef, useState } from "react";
import type { ComponentProps, ReactElement, RefObject } from "react";
import { Badge } from "@/vendor/shadcn/ui/badge.tsx";
import { Button } from "@/vendor/shadcn/ui/button.tsx";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/vendor/shadcn/ui/command.tsx";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
} from "@/vendor/shadcn/ui/popover.tsx";
import type { Loadable, TileCount } from "../../lib/core/combinations/index.ts";
import {
  describeTileCount,
  hasNoMatch,
  NO_MATCH_MARK,
  rankTileCount,
  sortByRank,
} from "./combination_rows.ts";
import type {
  CombinationMark,
  CombinationMarkKind,
  CountRank,
} from "./combination_rows.ts";
import { keepFocusInFrame } from "./frame_focus.ts";

/** One entry of a list. */
export interface CombinationRow {
  /** Unique in the list: a resolved source, or a fixed id such as `none`. */
  id: string;
  title: string;
  /** Short items shown under the title, such as a mosaic's aliases. */
  details: readonly string[];
  /** The tile-match count to show, or `null` for none. */
  count: Loadable<TileCount> | null;
  /** Badges after the title, such as "Current", "Recent" or "1 mosaic". "no match" is added from the count. */
  marks: readonly CombinationMark[];
  isSelectable: boolean;
  /** Why the entry's file cannot be loaded, or `null`. Such an entry goes last and is not selectable. */
  failure: string | null;
  onChoose: () => void;
  /** Drops a recently used entry that cannot be loaded, or `null`. */
  onRemove: (() => void) | null;
}

/** A group of entries under an optional heading. */
export interface CombinationSection {
  heading: string | null;
  rows: readonly CombinationRow[];
  /** Said when the group has no entry. Without it, an empty group is not shown. */
  emptyText?: string;
}

/** One line of the details footer. */
export interface ListDetail {
  term: string;
  value: string;
}

/** The footer's link to the list's explorer. */
export interface ExplorerLink {
  label: string;
  onOpen: () => void;
}

interface CombinationListProps {
  /** The list's accessible name, such as "Mod list". */
  label: string;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  /** The capsule that opens the list. */
  children: ReactElement;
  /**
   * What the list opens under while its capsule is hidden, as in the folded
   * bar under 480px: the bar's left side, which starts with the folded capsule.
   */
  anchorRef: RefObject<HTMLElement | null>;
  /** Entries listed first, never sorted, such as "None" and the tile. */
  leadRows: readonly CombinationRow[];
  sections: readonly CombinationSection[];
  /** Whether the entries are sorted by their counts when the list opens. */
  sortsByCount: boolean;
  details: readonly ListDetail[];
  explorer: ExplorerLink | null;
}

const NOT_COMPATIBLE_HEADING = "Not compatible";

/**
 * Where a list opens: under its capsule, or, while the capsule is hidden
 * (`display: none` gives it an empty box), under the bar's left side, whose
 * start is the folded capsule. Radix measures it each time it places the list.
 */
class CapsuleAnchor {
  triggerRef: RefObject<HTMLElement | null>;
  fallbackRef: RefObject<HTMLElement | null>;

  /** Whether the list was open when the anchor was built: one anchor per opening. */
  isForOpenList: boolean;

  constructor(
    triggerRef: RefObject<HTMLElement | null>,
    fallbackRef: RefObject<HTMLElement | null>,
    isForOpenList: boolean,
  ) {
    this.triggerRef = triggerRef;
    this.fallbackRef = fallbackRef;
    this.isForOpenList = isForOpenList;
  }

  getBoundingClientRect(): DOMRect {
    const triggerBox = this.triggerRef.current?.getBoundingClientRect();
    if (triggerBox !== undefined && triggerBox.width > 0) {
      return triggerBox;
    }
    const fallbackBox = this.fallbackRef.current?.getBoundingClientRect();
    return fallbackBox ?? new DOMRect();
  }
}

/** Keeps the entries whose title holds the typed text, ignoring letter case. */
function filterByTitle(
  _value: string,
  search: string,
  keywords?: string[],
): number {
  const title = (keywords ?? []).join(" ").toLowerCase();
  return title.includes(search.toLowerCase()) ? 1 : 0;
}

function listRows(sections: readonly CombinationSection[]): CombinationRow[] {
  const rows: CombinationRow[] = [];
  for (const section of sections) {
    rows.push(...section.rows);
  }
  return rows;
}

/** Each entry's rank by the counts known now, recorded when the list opens. */
function recordRanks(
  sections: readonly CombinationSection[],
): Map<string, CountRank> {
  const ranks = new Map<string, CountRank>();
  for (const row of listRows(sections)) {
    ranks.set(row.id, rankTileCount(row.count));
  }
  return ranks;
}

function isLoadable(row: CombinationRow): boolean {
  return row.failure === null;
}

function isFailed(row: CombinationRow): boolean {
  return row.failure !== null;
}

function keepRows(
  rows: readonly CombinationRow[],
  isKept: (row: CombinationRow) => boolean,
): CombinationRow[] {
  const kept: CombinationRow[] = [];
  for (const row of rows) {
    if (isKept(row)) {
      kept.push(row);
    }
  }
  return kept;
}

/** The rows of `ids`, in that order. */
function pickRows(
  rows: readonly CombinationRow[],
  ids: readonly string[],
): CombinationRow[] {
  const picked: CombinationRow[] = [];
  for (const id of ids) {
    for (const row of rows) {
      if (row.id === id) {
        picked.push(row);
      }
    }
  }
  return picked;
}

function listIds(rows: readonly CombinationRow[]): string[] {
  const ids: string[] = [];
  for (const row of rows) {
    ids.push(row.id);
  }
  return ids;
}

/**
 * The sorted sections: what fits and what partly fits, then "Not
 * compatible", by the ranks recorded when the list opened. An entry that
 * arrived since goes first, as an entry with no count known yet.
 */
function buildSortedSections(
  sections: readonly CombinationSection[],
  ranks: ReadonlyMap<string, CountRank>,
): CombinationSection[] {
  const rows = keepRows(listRows(sections), isLoadable);
  const sortedIds = sortByRank(listIds(rows), ranks);
  const fittingIds: string[] = [];
  const incompatibleIds: string[] = [];
  for (const id of sortedIds) {
    if (ranks.get(id) === "incompatible") {
      incompatibleIds.push(id);
    } else {
      fittingIds.push(id);
    }
  }
  const sorted: CombinationSection[] = [
    { heading: null, rows: pickRows(rows, fittingIds) },
    { heading: NOT_COMPATIBLE_HEADING, rows: pickRows(rows, incompatibleIds) },
  ];
  return sorted;
}

function keepLoadableSections(
  sections: readonly CombinationSection[],
): CombinationSection[] {
  const kept: CombinationSection[] = [];
  for (const section of sections) {
    kept.push({ ...section, rows: keepRows(section.rows, isLoadable) });
  }
  return kept;
}

type BadgeVariant = ComponentProps<typeof Badge>["variant"];

interface MarkStyle {
  variant: BadgeVariant;
  className: string;
}

/** One badge style per mark kind, so a color keeps one meaning across the lists. */
const MARK_STYLES: Readonly<Record<CombinationMarkKind, MarkStyle>> = {
  current: { variant: "default", className: "" },
  recent: { variant: "secondary", className: "" },
  mosaics: { variant: "outline", className: "" },
  noMatch: { variant: "outline", className: "text-muted-foreground" },
};

/** The count column's classes: one width for every row, so counts line up. */
const COUNT_COLUMN_CLASSES = "w-12 shrink-0 text-right text-xs tabular-nums";

/** The tile-match count, an empty column for a row without one in a list with counts, or nothing. */
function renderCount(
  row: CombinationRow,
  hasCountColumn: boolean,
): ReactElement | null {
  if (row.count === null) {
    return hasCountColumn ? (
      <span aria-hidden="true" className={COUNT_COLUMN_CLASSES} />
    ) : null;
  }
  const text = describeTileCount(row.count);
  if (text === null) {
    return (
      <span
        className={`${COUNT_COLUMN_CLASSES} text-muted-foreground`}
        aria-label="Counting"
      >
        …
      </span>
    );
  }
  return <span className={COUNT_COLUMN_CLASSES}>{text}</span>;
}

function renderMark(mark: CombinationMark): ReactElement {
  const style = MARK_STYLES[mark.kind];
  return (
    <Badge
      key={mark.kind}
      variant={style.variant}
      className={`shrink-0 ${style.className}`}
    >
      {mark.text}
    </Badge>
  );
}

function renderMarks(row: CombinationRow): ReactElement[] {
  const marks: ReactElement[] = [];
  for (const mark of row.marks) {
    marks.push(renderMark(mark));
  }
  if (hasNoMatch(row.count)) {
    marks.push(renderMark(NO_MATCH_MARK));
  }
  return marks;
}

function renderDetailItem(item: string): ReactElement {
  return (
    <span key={item} className="truncate">
      {item}
    </span>
  );
}

function renderRowText(row: CombinationRow): ReactElement {
  const items: ReactElement[] = [];
  for (const item of row.details) {
    items.push(renderDetailItem(item));
  }
  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <span className="truncate">{row.title}</span>
      {items.length === 0 ? null : (
        <span className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
          {items}
        </span>
      )}
    </div>
  );
}

function renderRow(
  row: CombinationRow,
  isMuted: boolean,
  hasCountColumn: boolean,
): ReactElement {
  return (
    <CommandItem
      key={row.id}
      value={row.id}
      keywords={[row.title]}
      disabled={!row.isSelectable}
      onSelect={row.onChoose}
      className={isMuted ? "text-muted-foreground" : undefined}
    >
      {renderRowText(row)}
      {renderMarks(row)}
      {renderCount(row, hasCountColumn)}
    </CommandItem>
  );
}

function renderSection(
  section: CombinationSection,
  index: number,
  hasCountColumn: boolean,
): ReactElement | null {
  if (section.rows.length === 0 && section.emptyText === undefined) {
    return null;
  }
  const isMuted = section.heading === NOT_COMPATIBLE_HEADING;
  const rows: ReactElement[] = [];
  for (const row of section.rows) {
    rows.push(renderRow(row, isMuted, hasCountColumn));
  }
  return (
    <CommandGroup
      key={section.heading ?? `section-${index}`}
      heading={section.heading ?? undefined}
    >
      {rows.length === 0 ? (
        <p className="px-2 py-1.5 text-sm text-muted-foreground">
          {section.emptyText}
        </p>
      ) : (
        rows
      )}
    </CommandGroup>
  );
}

function renderFailedRow(row: CombinationRow): ReactElement {
  return (
    <li key={row.id} className="flex items-center gap-2 px-2 py-1.5 text-sm">
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-muted-foreground">{row.title}</span>
        <span className="text-xs [overflow-wrap:anywhere] text-destructive">
          {row.failure}
        </span>
      </div>
      {row.onRemove === null ? null : (
        <Button type="button" variant="ghost" size="sm" onClick={row.onRemove}>
          Remove
        </Button>
      )}
    </li>
  );
}

/** The entries that cannot be loaded, last, with their reasons. Not selectable. */
function renderFailedRows(
  rows: readonly CombinationRow[],
): ReactElement | null {
  if (rows.length === 0) {
    return null;
  }
  const items: ReactElement[] = [];
  for (const row of rows) {
    items.push(renderFailedRow(row));
  }
  return (
    <ul aria-label="Cannot be loaded" className="border-t p-1">
      {items}
    </ul>
  );
}

function renderDetail(detail: ListDetail): ReactElement {
  return (
    <div key={detail.term} className="flex flex-col gap-0.5">
      <dt className="text-muted-foreground">{detail.term}</dt>
      <dd className="[overflow-wrap:anywhere]">
        <code>{detail.value}</code>
      </dd>
    </div>
  );
}

function renderFooter(
  details: readonly ListDetail[],
  explorer: ExplorerLink | null,
): ReactElement {
  const lines: ReactElement[] = [];
  for (const detail of details) {
    lines.push(renderDetail(detail));
  }
  return (
    <div className="flex flex-col gap-2 border-t p-3 text-xs select-text">
      <dl aria-label="Details" className="flex flex-col gap-2">
        {lines}
      </dl>
      {explorer === null ? null : (
        <Button
          type="button"
          variant="link"
          size="sm"
          className="h-auto justify-start self-start p-0"
          onClick={explorer.onOpen}
        >
          {explorer.label}
        </Button>
      )}
    </div>
  );
}

/** Whether any entry has a count, so every row keeps the count column. */
function hasCounts(sections: readonly CombinationSection[]): boolean {
  for (const row of listRows(sections)) {
    if (row.count !== null) {
      return true;
    }
  }
  return false;
}

/**
 * A capsule's list: a shadcn Popover, drawn by the app outside every mod
 * frame and opened under its capsule (`CapsuleAnchor`), holding a searchable
 * Command with its search field focused. Typing keeps the entries whose
 * title holds the text, arrow keys move, Enter chooses, and Escape closes it
 * and gives the focus back to the capsule. With `sortsByCount`, the entries
 * are sorted once, when the list opens, from the counts known then, so a
 * count that arrives never moves its entry: what fits first, and the
 * entries with no matching tile under "Not compatible", muted and marked
 * `no match`. Entries that cannot be loaded come last with their reason.
 * The footer holds the details, as text the user can select, and the
 * explorer link.
 */
export function CombinationList({
  label,
  isOpen,
  onOpenChange,
  children,
  anchorRef,
  leadRows,
  sections,
  sortsByCount,
  details,
  explorer,
}: CombinationListProps): ReactElement {
  const triggerRef = useRef<HTMLButtonElement>(null);
  // A new anchor each time the list opens: Radix only takes a virtual anchor
  // that differs from the last one it saw. Under StrictMode's double mount it
  // meanwhile records the capsule's first button, which React then replaces,
  // so reusing one anchor would place the list at the replaced button's empty
  // box, the top-left corner.
  const capsuleAnchorRef = useMemo(
    function buildCapsuleAnchorRef(): RefObject<CapsuleAnchor> {
      const anchorObject: RefObject<CapsuleAnchor> = {
        current: new CapsuleAnchor(triggerRef, anchorRef, isOpen),
      };
      return anchorObject;
    },
    [anchorRef, isOpen],
  );
  const [openRanks, setOpenRanks] = useState<Map<string, CountRank> | null>(
    null,
  );
  // Records the ranks while rendering the opening, React's way of adjusting state to new props.
  if (isOpen && sortsByCount && openRanks === null) {
    setOpenRanks(recordRanks(sections));
  }
  if (!isOpen && openRanks !== null) {
    setOpenRanks(null);
  }
  const shownSections =
    sortsByCount && openRanks !== null
      ? buildSortedSections(sections, openRanks)
      : keepLoadableSections(sections);
  const renderedSections: ReactElement[] = [];
  const allSections: CombinationSection[] = [
    { heading: null, rows: leadRows },
    ...shownSections,
  ];
  const hasCountColumn = hasCounts(allSections);
  for (const [index, section] of allSections.entries()) {
    const rendered = renderSection(section, index, hasCountColumn);
    if (rendered !== null) {
      renderedSections.push(rendered);
    }
  }
  return (
    <Popover open={isOpen} onOpenChange={onOpenChange}>
      <PopoverAnchor virtualRef={capsuleAnchorRef} />
      <PopoverTrigger asChild ref={triggerRef}>
        {children}
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-96 max-w-[calc(100vw-2rem)] p-0"
        onCloseAutoFocus={keepFocusInFrame}
      >
        <Command label={label} filter={filterByTitle}>
          <CommandInput placeholder="Search…" />
          <CommandList>
            <CommandEmpty>Nothing found.</CommandEmpty>
            {renderedSections}
          </CommandList>
          {renderFailedRows(keepRows(listRows(sections), isFailed))}
        </Command>
        {renderFooter(details, explorer)}
      </PopoverContent>
    </Popover>
  );
}
