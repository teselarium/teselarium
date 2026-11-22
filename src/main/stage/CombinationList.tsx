import { ChevronLeft } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import type {
  Dispatch,
  KeyboardEvent,
  ReactElement,
  RefObject,
  SetStateAction,
} from "react";
import { Button } from "@/vendor/shadcn/ui/button.tsx";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/vendor/shadcn/ui/command.tsx";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
} from "@/vendor/shadcn/ui/popover.tsx";
import type {
  EntryScore,
  TileCount,
} from "../../lib/core/combinations/index.ts";
import { MOSAIC_ICON as MosaicIcon } from "../catalog_icons.ts";
import { HoverTooltip } from "../HoverTooltip.tsx";
import { LoadingSpinner } from "../LoadingSpinner.tsx";
import { useStoreSnapshot } from "../use_store_snapshot.ts";
import type {
  CombinationRow,
  ListRows,
  MosaicBadge,
  RowMark,
} from "./combination_rows.ts";
import { CombinationListToolbar } from "./CombinationListToolbar.tsx";
import { keepFocusInFrame } from "./frame_focus.ts";
import { ListDetails } from "./ListDetails.tsx";
import type { ListDetail } from "./ListDetails.tsx";
import {
  readListChoicesSnapshot,
  subscribeListChoices,
} from "./list_choices.ts";
import type { ListChoices, ListKind } from "./list_choices.ts";
import {
  findOpeningHighlight,
  keepFilteredEntries,
  orderEntries,
  placePinnedRows,
} from "./list_order.ts";
import type { EntryGroup } from "./list_order.ts";
import {
  matchEntries,
  matchPageOptions,
  showPinnedRows,
} from "./list_search.ts";
import type { MatchedEntry } from "./list_search.ts";
import {
  arrangeSettledGroups,
  isSameOrder,
  readSettledGroups,
  SETTLE_INTERVAL_MS,
} from "./list_settling.ts";
import type { SettledGroup } from "./list_settling.ts";

interface CombinationListProps {
  kind: ListKind;
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
  rows: ListRows;
  /** The heading of the current pair's group, sorted by "This pair first". */
  pairHeading: string;
  listChoices: ListChoices;
  /** The current entry's details, which the details page shows. */
  details: readonly ListDetail[];
}

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

/**
 * What the list shows: the main list, or an entry's page, and the search of
 * each. While `isShowingDetails`, the details page is shown in their place,
 * and leaving it returns to them as they were.
 */
interface ListView {
  pageId: string | null;
  mainSearch: string;
  pageSearch: string;
  isShowingDetails: boolean;
}

const MAIN_VIEW: ListView = Object.freeze({
  pageId: null,
  mainSearch: "",
  pageSearch: "",
  isShowingDetails: false,
});

/**
 * The main list's order. `layout` is `null` until the next render sorts
 * with what is known. While `isFrozen`, rows stay in place.
 */
interface SettleState {
  layout: readonly SettledGroup[] | null;
  isFrozen: boolean;
}

const SORT_AGAIN: SettleState = Object.freeze({
  layout: null,
  isFrozen: false,
});

/** The id of a page's "Back" row. */
const BACK_ID = "back";

const MARK_TEXTS: Readonly<Record<RowMark, string>> = Object.freeze({
  current: "Current",
  tried: "Tried recently, not saved in the app",
});

const MARK_CLASSES: Readonly<Record<RowMark, string>> = Object.freeze({
  current: "bg-primary",
  tried: "border border-primary",
});

/** Each column keeps one width in every row, so the columns line up. */
const MARK_COLUMN_CLASSES = "flex w-3 shrink-0 justify-center";
const BADGE_COLUMN_CLASSES =
  "flex w-9 shrink-0 items-center justify-end gap-0.5 text-xs tabular-nums";
const SCORE_COLUMN_CLASSES =
  "flex w-12 shrink-0 justify-end text-xs tabular-nums";

const UNTYPED_TOOLTIP = "Accepts any tile: this mod has no tile type";

/**
 * A row's secondary text: muted, and in the accent's foreground color while
 * the row is highlighted (a `group`), a pair that meets 4.5:1 on the accent
 * in both color schemes (`theme`, "Token contrast").
 */
const SECONDARY_TEXT_CLASSES =
  "text-muted-foreground group-data-[selected=true]:text-accent-foreground";

/** The cmdk item of a row is a `group`, so its secondary text follows its highlight. */
const ROW_CLASSES = "group";

function renderWithTooltip(
  trigger: ReactElement,
  tooltip: string,
): ReactElement {
  return <HoverTooltip content={tooltip}>{trigger}</HoverTooltip>;
}

/** The mark column: the dot or the ring, named, or an empty column. */
function renderMark(mark: RowMark | null): ReactElement {
  if (mark === null) {
    return <span aria-hidden="true" className={MARK_COLUMN_CLASSES} />;
  }
  const text = MARK_TEXTS[mark];
  return (
    <span className={MARK_COLUMN_CLASSES} data-column="mark">
      {renderWithTooltip(
        <span
          role="img"
          aria-label={text}
          data-mark={mark}
          className={`size-2 rounded-full ${MARK_CLASSES[mark]}`}
        />,
        text,
      )}
    </span>
  );
}

function describeMosaicBadge(badge: MosaicBadge): string {
  if (badge.matching !== null) {
    const matching = `${badge.matching} of ${badge.count} mosaics match`;
    return matching;
  }
  const count = badge.count === 1 ? "1 mosaic" : `${badge.count} mosaics`;
  return count;
}

/** The badge column: the mosaic icon with a number, the icon alone, or an empty column. */
function renderBadge(mosaics: CombinationRow["mosaics"]): ReactElement {
  if (mosaics === null) {
    return <span aria-hidden="true" className={BADGE_COLUMN_CLASSES} />;
  }
  const name = mosaics === "icon" ? "Mosaic" : describeMosaicBadge(mosaics);
  const number =
    mosaics === "icon" ? null : (
      <span>{mosaics.matching ?? mosaics.count}</span>
    );
  return renderWithTooltip(
    <span
      role="img"
      aria-label={name}
      data-column="badge"
      className={BADGE_COLUMN_CLASSES}
    >
      <MosaicIcon aria-hidden="true" className="size-3.5" />
      {number}
    </span>,
    name,
  );
}

/**
 * A measured score, `matching/total`, muted without a matching tile. An
 * untyped mod's score is named with its tooltip, which a device that cannot
 * hover does not show.
 */
function renderMeasuredScore(count: TileCount): ReactElement {
  const value = `${count.matching}/${count.total}`;
  const classes =
    count.matching === 0
      ? `${SCORE_COLUMN_CLASSES} ${SECONDARY_TEXT_CLASSES}`
      : SCORE_COLUMN_CLASSES;
  if (!count.isUntyped) {
    return (
      <span
        data-column="score"
        data-muted={count.matching === 0}
        className={classes}
      >
        {value}
      </span>
    );
  }
  return renderWithTooltip(
    <span
      role="img"
      aria-label={`${value}: ${UNTYPED_TOOLTIP}`}
      data-column="score"
      data-muted={count.matching === 0}
      className={classes}
    >
      {value}
    </span>,
    UNTYPED_TOOLTIP,
  );
}

/** The score column: `matching/total`, muted without a matching tile, the spinner while counting, or an empty column. */
function renderScore(score: EntryScore): ReactElement {
  if (score === null) {
    return <span aria-hidden="true" className={SCORE_COLUMN_CLASSES} />;
  }
  if (score.state === "loading") {
    return (
      <span className={SCORE_COLUMN_CLASSES} data-column="score">
        <LoadingSpinner
          label="Counting"
          className={`size-3.5 ${SECONDARY_TEXT_CLASSES}`}
        />
      </span>
    );
  }
  if (score.state === "failed") {
    return renderWithTooltip(
      <span
        role="img"
        data-column="score"
        aria-label={`No score: ${score.reason}`}
        className={`${SCORE_COLUMN_CLASSES} ${SECONDARY_TEXT_CLASSES}`}
      >
        –
      </span>,
      score.reason,
    );
  }
  return renderMeasuredScore(score.value);
}

function renderDetailItem(item: string): ReactElement {
  return (
    <span key={item} className="truncate">
      {item}
    </span>
  );
}

/** For an entry found through its mosaics: the first one's title with the icon, and "+<k> more". */
function renderFoundMosaics(row: CombinationRow): ReactElement | null {
  const found = row.foundMosaics;
  if (found === null) {
    return null;
  }
  return (
    <span
      className={`flex min-w-0 items-center gap-1 text-xs ${SECONDARY_TEXT_CLASSES}`}
    >
      <MosaicIcon aria-hidden="true" className="size-3" />
      <span className="truncate">{found.title}</span>
      {found.moreCount === 0 ? null : (
        <span className="shrink-0">{`+${found.moreCount} more`}</span>
      )}
    </span>
  );
}

function renderRowText(row: CombinationRow): ReactElement {
  const items: ReactElement[] = [];
  for (const item of row.details) {
    items.push(renderDetailItem(item));
  }
  return (
    <div className="flex min-w-0 flex-1 flex-col" data-column="title">
      <span className="truncate">{row.title}</span>
      {items.length === 0 ? null : (
        <span
          className={`flex flex-wrap gap-x-3 text-xs ${SECONDARY_TEXT_CLASSES}`}
        >
          {items}
        </span>
      )}
      {renderFoundMosaics(row)}
    </div>
  );
}

/** The four columns of a row: mark, title, mosaic badge and score. */
function renderRow(row: CombinationRow, onSelect: () => void): ReactElement {
  return (
    <CommandItem
      key={row.id}
      value={row.id}
      disabled={!row.isSelectable}
      onSelect={onSelect}
      className={ROW_CLASSES}
      aria-current={row.mark === "current" ? "true" : undefined}
      data-row-id={row.id}
    >
      {renderMark(row.mark)}
      {renderRowText(row)}
      {renderBadge(row.mosaics)}
      {renderScore(row.score)}
    </CommandItem>
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

function findEntry(
  entries: readonly CombinationRow[],
  id: string | null,
): CombinationRow | null {
  for (const entry of entries) {
    if (entry.id === id) {
      return entry;
    }
  }
  return null;
}

/** The key a group of the main list is rendered with. */
function readGroupKey(group: EntryGroup, index: number): string {
  return group.heading ?? `group-${index}`;
}

/** The highlighted row and the key of the group that shows it, in one commit. */
interface HighlightPlace {
  rowId: string;
  groupKey: string | null;
}

/** Whether the row highlighted in `committed` is still highlighted, now in another group. */
function isMovedToAnotherGroup(
  committed: HighlightPlace | null,
  current: HighlightPlace,
): boolean {
  if (committed === null || committed.rowId !== current.rowId) {
    return false;
  }
  return (
    committed.groupKey !== null &&
    current.groupKey !== null &&
    committed.groupKey !== current.groupKey
  );
}

/** The key of the group that shows the row `rowId`, or `null` when no group does. */
function findRowGroupKey(
  groups: readonly EntryGroup[],
  rowId: string,
): string | null {
  for (const [index, group] of groups.entries()) {
    for (const entry of group.entries) {
      if (entry.id === rowId) {
        return readGroupKey(group, index);
      }
    }
  }
  return null;
}

/** The first row of `groups` that can be chosen, as cmdk proposes it, or `null`. */
function findFirstSelectableId(groups: readonly EntryGroup[]): string | null {
  for (const group of groups) {
    for (const entry of group.entries) {
      if (entry.isSelectable) {
        return entry.id;
      }
    }
  }
  return null;
}

/**
 * Whether `value` is cmdk's proposal of the first row after the highlighted
 * row moved to another group, and was mounted again there: the moved row is
 * still highlighted and shown, and `value` is the first row that can be
 * chosen. A user's move to another row goes through, and consumes the guard.
 */
function isProposalForMovedRow(
  groups: readonly EntryGroup[],
  highlighted: string,
  movedRow: string | null,
  value: string,
): boolean {
  if (movedRow === null || movedRow !== highlighted || value === highlighted) {
    return false;
  }
  const isShown = findRowGroupKey(groups, movedRow) !== null;
  return isShown && value === findFirstSelectableId(groups);
}

/** The rows of `groups`, in the order shown. */
function listGroupRows(groups: readonly EntryGroup[]): CombinationRow[] {
  const rows: CombinationRow[] = [];
  for (const group of groups) {
    rows.push(...group.entries);
  }
  return rows;
}

function listMatchedRows(matched: readonly MatchedEntry[]): CombinationRow[] {
  const rows: CombinationRow[] = [];
  for (const entry of matched) {
    rows.push(entry.entry);
  }
  return rows;
}

function readPageSearch(matched: readonly MatchedEntry[], id: string): string {
  for (const entry of matched) {
    if (entry.entry.id === id) {
      return entry.pageSearch;
    }
  }
  return "";
}

/** The settled order, sorted with what is known now. */
function settleNow(
  setSettle: Dispatch<SetStateAction<SettleState>>,
  layout: readonly SettledGroup[],
): void {
  setSettle({ layout, isFrozen: false });
}

function freezeSettle(current: SettleState): SettleState {
  return current.isFrozen ? current : { ...current, isFrozen: true };
}

/** Shows the row the list highlights after Back, once. */
function scrollRowIntoView(
  listRef: RefObject<HTMLDivElement | null>,
  targetRef: RefObject<string | null>,
): void {
  const id = targetRef.current;
  if (id === null) {
    return;
  }
  targetRef.current = null;
  for (const item of listRef.current?.querySelectorAll("[data-row-id]") ?? []) {
    if (item.getAttribute("data-row-id") === id) {
      item.scrollIntoView({ block: "nearest" });
    }
  }
}

/** How long until the rows may be sorted again: at most every `SETTLE_INTERVAL_MS`. */
function readSettleDelay(sortedAtRef: RefObject<number>): number {
  const delay = Math.max(
    0,
    sortedAtRef.current + SETTLE_INTERVAL_MS - Date.now(),
  );
  return delay;
}

/** Keeps when the rows were last sorted, for the throttle. */
function recordSortTime(sortedAtRef: RefObject<number>): void {
  sortedAtRef.current = Date.now();
}

/**
 * A capsule's list: a shadcn Popover, drawn by the app outside every mod
 * frame and opened under its capsule (`CapsuleAnchor`), holding a Command
 * with its toolbar (search field focused, sort and filter) and the rows in
 * four columns: mark, title, mosaic badge and score.
 *
 * The list does its own filtering (`matchEntries`) and ordering
 * (`orderEntries`, `keepFilteredEntries`), with the rows pinned at the top
 * outside both and hidden while searching. cmdk keeps the input, the
 * highlighted row, arrow keys and Enter.
 *
 * Rows settle: they are sorted again as titles and scores arrive, at most
 * every 300ms, until the pointer moves in the list or an arrow key is
 * pressed; then they stay in place. Opening, Back, a search change and a
 * sort choice sort them again at once.
 *
 * An entry with mosaics opens its page in place of the main list: "Back",
 * named after it, then its options. "Back" and Backspace in an empty search
 * field return, with the main search and the entry highlighted. Entries that
 * cannot be loaded come last with their reason.
 *
 * The toolbar's "Details" button opens the details page in place of the
 * main list or of an entry's page: a "Back" row, then the current entry's
 * details (`ListDetails`). "Back", Backspace in an empty search field and
 * the "Details" button return to what was shown, with its search and its
 * highlighted row, and sort again. Typing, choosing a sort and checking a
 * filter return too.
 */
export function CombinationList({
  kind,
  label,
  isOpen,
  onOpenChange,
  children,
  anchorRef,
  rows,
  pairHeading,
  listChoices,
  details,
}: CombinationListProps): ReactElement {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
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
  const choice = useStoreSnapshot(
    listChoices,
    subscribeListChoices,
    readListChoicesSnapshot,
  )[kind];
  const [view, setView] = useState<ListView>(MAIN_VIEW);
  const [highlighted, setHighlighted] = useState("");
  // The row highlighted when the details page opened, highlighted again when it is left.
  const [detailsReturnId, setDetailsReturnId] = useState("");
  // The parent to show after Back, and when the rows were last sorted: read after rendering.
  const scrollTargetRef = useRef<string | null>(null);
  // The parent highlighted by Back. Removing the page's highlighted row may
  // make cmdk propose the first row in the same commit; that proposal is
  // dropped, and the guard is cleared once the commit is done.
  const pendingHighlightRef = useRef<string | null>(null);
  // The highlighted row and its group in the last commit, to see it move to another group.
  const committedPlaceRef = useRef<HighlightPlace | null>(null);
  // The highlighted row that moved to another group, whose first-row proposal from cmdk is undone.
  const movedRowRef = useRef<string | null>(null);
  // The moved row to highlight again once cmdk's proposal is committed, before it is painted.
  const restoredRowRef = useRef<string | null>(null);
  const sortedAtRef = useRef(0);
  const [settle, setSettle] = useState<SettleState>(SORT_AGAIN);
  const [wasOpen, setWasOpen] = useState(false);
  // Whether the opening still has to highlight the current entry, once its rows are sorted.
  const [isHighlightingCurrent, setIsHighlightingCurrent] = useState(false);
  // Opening starts on the main list, sorted with what is known, while rendering as React adjusts state to new props.
  if (isOpen && !wasOpen) {
    setWasOpen(true);
    setView(MAIN_VIEW);
    setIsHighlightingCurrent(true);
    setSettle(SORT_AGAIN);
  }
  if (!isOpen && wasOpen) {
    setWasOpen(false);
  }

  const matched = matchEntries(rows.entries, view.mainSearch);
  const freshGroups = orderEntries(
    keepFilteredEntries(listMatchedRows(matched), choice.filters),
    choice.sort,
    pairHeading,
  );
  const freshLayout = readSettledGroups(freshGroups);
  if (settle.layout === null && isOpen) {
    settleNow(setSettle, freshLayout);
  }
  const layout = settle.layout ?? freshLayout;
  const isSettled = isSameOrder(layout, freshLayout);
  const page = findEntry(rows.entries, view.pageId);
  const mainGroups: EntryGroup[] = placePinnedRows(
    arrangeSettledGroups(freshGroups, layout),
    showPinnedRows(rows.pinnedRows, view.mainSearch),
  );
  // A highlighted row that moves to another group, as a mosaic does once the
  // current pair is known, is mounted again, and cmdk then proposes the first
  // row, in a later commit of its own: that proposal is undone. cmdk has
  // already taken it, and reads the highlight again only when it changes, so
  // the proposal is committed, then the moved row highlighted again.
  // Only while the main list is open, so opening it again is no move.
  const highlightedGroupKey =
    isOpen && page === null && !view.isShowingDetails
      ? findRowGroupKey(mainGroups, highlighted)
      : null;
  // Before cmdk's proposal: React runs a commit's effects before it renders again.
  useLayoutEffect(
    function rememberHighlightPlace(): void {
      const place: HighlightPlace = {
        rowId: highlighted,
        groupKey: highlightedGroupKey,
      };
      if (isMovedToAnotherGroup(committedPlaceRef.current, place)) {
        movedRowRef.current = highlighted;
      }
      committedPlaceRef.current = place;
    },
    [highlighted, highlightedGroupKey],
  );
  useLayoutEffect(
    function highlightMovedRowAgain(): void {
      const restoredRow = restoredRowRef.current;
      if (restoredRow !== null) {
        restoredRowRef.current = null;
        setHighlighted(restoredRow);
      }
    },
    [highlighted],
  );
  // The opening's rows are sorted: highlight the current entry before the list is shown, so cmdk mounts on it and scrolls it into view.
  if (isOpen && isHighlightingCurrent && settle.layout !== null) {
    setIsHighlightingCurrent(false);
    setHighlighted(findOpeningHighlight(listGroupRows(mainGroups)));
  }

  const settledLayout = settle.layout;
  useEffect(
    function keepSortTime(): void {
      if (settledLayout !== null) {
        recordSortTime(sortedAtRef);
      }
    },
    [settledLayout],
  );
  useEffect(
    function sortAgainWhileSettling(): (() => void) | undefined {
      if (!isOpen || settle.isFrozen || settle.layout === null || isSettled) {
        return undefined;
      }
      const delay = readSettleDelay(sortedAtRef);
      const timer = setTimeout(
        settleNow.bind(undefined, setSettle, freshLayout),
        delay,
      );
      return clearTimeout.bind(undefined, timer);
    },
    [isOpen, settle, isSettled, freshLayout],
  );

  useEffect(
    function showHighlightedParent(): void {
      pendingHighlightRef.current = null;
      scrollRowIntoView(listRef, scrollTargetRef);
    },
    [view.pageId, view.isShowingDetails],
  );

  const search = page === null ? view.mainSearch : view.pageSearch;

  function sortAgain(): void {
    setSettle(SORT_AGAIN);
  }

  function freeze(): void {
    setSettle(freezeSettle);
  }

  function handleSearchChange(search: string): void {
    if (page !== null) {
      setView({ ...view, pageSearch: search, isShowingDetails: false });
      return;
    }
    setView({ ...view, mainSearch: search, isShowingDetails: false });
    sortAgain();
  }

  function openDetails(): void {
    setDetailsReturnId(highlighted);
    setView({ ...view, isShowingDetails: true });
    setHighlighted(BACK_ID);
  }

  /**
   * Returns to the main list or the entry's page, with the row highlighted
   * before, sorted again. The highlight moves off "Back" before "Back" is
   * removed: cmdk highlights the first row when the highlighted one goes.
   */
  function leaveDetails(): void {
    flushSync(setHighlighted.bind(undefined, detailsReturnId));
    setView({ ...view, isShowingDetails: false });
    scrollTargetRef.current = detailsReturnId;
    sortAgain();
  }

  function toggleDetails(): void {
    if (view.isShowingDetails) {
      leaveDetails();
      return;
    }
    openDetails();
  }

  /** A sort choice sorts again, and leaves the details page to show its effect. */
  function handleSortChoose(): void {
    if (view.isShowingDetails) {
      leaveDetails();
      return;
    }
    sortAgain();
  }

  /** A filter change leaves the details page, to show its effect. */
  function handleFilterChange(): void {
    if (view.isShowingDetails) {
      leaveDetails();
    }
  }

  function openPage(entry: CombinationRow): void {
    const pageSearch = readPageSearch(matched, entry.id);
    setView({ ...view, pageId: entry.id, pageSearch });
    const firstOption = matchPageOptions(entry, pageSearch)[0];
    setHighlighted(firstOption?.id ?? BACK_ID);
  }

  function goBack(): void {
    const parentId = view.pageId ?? "";
    setView({ ...view, pageId: null, pageSearch: "" });
    setHighlighted(parentId);
    pendingHighlightRef.current = parentId;
    scrollTargetRef.current = parentId;
    sortAgain();
  }

  function handleHighlightChange(value: string): void {
    const pending = pendingHighlightRef.current;
    pendingHighlightRef.current = null;
    const movedRow = movedRowRef.current;
    movedRowRef.current = null;
    if (
      pending === null &&
      isProposalForMovedRow(mainGroups, highlighted, movedRow, value)
    ) {
      restoredRowRef.current = highlighted;
    }
    setHighlighted(pending ?? value);
  }

  function chooseEntry(entry: CombinationRow): void {
    if (entry.options === null) {
      entry.onChoose();
      return;
    }
    openPage(entry);
  }

  function handleKeyDown(event: KeyboardEvent): void {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      freeze();
    }
    if (event.key !== "Backspace" || search !== "") {
      return;
    }
    if (view.isShowingDetails) {
      event.preventDefault();
      leaveDetails();
      return;
    }
    if (page !== null) {
      event.preventDefault();
      goBack();
    }
  }

  function renderRows(): ReactElement | ReactElement[] {
    if (view.isShowingDetails) {
      return renderDetailsBack();
    }
    return page === null ? renderMainGroups() : renderPage(page);
  }

  function renderMainGroups(): ReactElement[] {
    const rendered: ReactElement[] = [];
    for (const [index, group] of mainGroups.entries()) {
      const items: ReactElement[] = [];
      for (const entry of group.entries) {
        items.push(renderRow(entry, chooseEntry.bind(undefined, entry)));
      }
      rendered.push(
        <CommandGroup
          key={readGroupKey(group, index)}
          heading={group.heading ?? undefined}
        >
          {items}
        </CommandGroup>,
      );
    }
    return rendered;
  }

  function renderPage(entry: CombinationRow): ReactElement {
    const items: ReactElement[] = [];
    for (const option of matchPageOptions(entry, view.pageSearch)) {
      items.push(renderRow(option, option.onChoose));
    }
    return (
      <CommandGroup>
        <CommandItem
          value={BACK_ID}
          onSelect={goBack}
          className={ROW_CLASSES}
          aria-label={`Back to ${entry.title}`}
        >
          <ChevronLeft aria-hidden="true" />
          <span>Back</span>
          <span className={`truncate ${SECONDARY_TEXT_CLASSES}`}>
            {entry.title}
          </span>
        </CommandItem>
        {items}
      </CommandGroup>
    );
  }

  /** The details page's only row, which goes back to what the list showed before. */
  function renderDetailsBack(): ReactElement {
    return (
      <CommandGroup>
        <CommandItem
          value={BACK_ID}
          onSelect={leaveDetails}
          className={ROW_CLASSES}
        >
          <ChevronLeft aria-hidden="true" />
          <span>Back</span>
        </CommandItem>
      </CommandGroup>
    );
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
        <Command
          label={label}
          shouldFilter={false}
          value={highlighted}
          onValueChange={handleHighlightChange}
          onKeyDown={handleKeyDown}
        >
          <CombinationListToolbar
            kind={kind}
            listChoices={listChoices}
            search={search}
            onSearchChange={handleSearchChange}
            onSortChoose={handleSortChoose}
            onFilterChange={handleFilterChange}
            isShowingDetails={view.isShowingDetails}
            onDetailsToggle={toggleDetails}
          />
          <CommandList ref={listRef} onPointerMove={freeze}>
            <CommandEmpty>Nothing found.</CommandEmpty>
            {renderRows()}
          </CommandList>
          {page === null && !view.isShowingDetails
            ? renderFailedRows(rows.failedRows)
            : null}
        </Command>
        {view.isShowingDetails ? <ListDetails details={details} /> : null}
      </PopoverContent>
    </Popover>
  );
}
