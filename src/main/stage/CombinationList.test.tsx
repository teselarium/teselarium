import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { useRef, useState } from "react";
import type { ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import { TooltipProvider } from "@/vendor/shadcn/ui/tooltip.tsx";
import type { EntryScore } from "../../lib/core/combinations/index.ts";
import { CombinationList } from "./CombinationList.tsx";
import type { CombinationRow, ListRows } from "./combination_rows.ts";
import { createListChoices, readListChoicesSnapshot } from "./list_choices.ts";
import type { ListChoices, ListKind } from "./list_choices.ts";
import { SETTLE_INTERVAL_MS } from "./list_settling.ts";
import { buildTestRow, buildTestScore } from "./test_rows.ts";

afterEach(function useRealTimers(): void {
  vi.useRealTimers();
});

function waitForTimers(resolve: () => void): void {
  setTimeout(resolve, 0);
}

const UNTYPED_SCORE: EntryScore = {
  state: "loaded",
  value: { matching: 17, total: 17, isUntyped: true },
};

function buildRows(
  entries: readonly CombinationRow[],
  overrides: Partial<ListRows> = {},
): ListRows {
  const rows: ListRows = {
    pinnedRows: [],
    entries,
    failedRows: [],
    ...overrides,
  };
  return rows;
}

interface HarnessProps {
  rows: ListRows;
  kind?: ListKind;
  listChoices?: ListChoices;
}

const SHARED_CHOICES = createListChoices();

/** A list with its capsule, open state and anchor, as the stage bar holds them. */
function ListHarness({
  rows,
  kind = "mod",
  listChoices = SHARED_CHOICES,
}: HarnessProps): ReactElement {
  const [isOpen, setIsOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);
  return (
    <TooltipProvider>
      <div ref={anchorRef}>
        <CombinationList
          kind={kind}
          label="Mod list"
          isOpen={isOpen}
          onOpenChange={setIsOpen}
          anchorRef={anchorRef}
          rows={rows}
          pairHeading="For Flashcards + Laureates"
          listChoices={listChoices}
          details={[{ term: "Mod", value: "https://example.org/mod.yaml" }]}
          explorer={null}
        >
          <button type="button">Mod: Map</button>
        </CombinationList>
      </div>
    </TooltipProvider>
  );
}

function openList(): void {
  fireEvent.click(screen.getByRole("button", { name: "Mod: Map" }));
}

function listOptionIds(): string[] {
  const ids: string[] = [];
  for (const option of screen.getAllByRole("option")) {
    ids.push(option.getAttribute("data-value") ?? "");
  }
  return ids;
}

function findOption(id: string): HTMLElement {
  for (const option of screen.getAllByRole("option")) {
    if (option.getAttribute("data-value") === id) {
      return option;
    }
  }
  throw new Error(`Expected the option ${id}`);
}

async function flushTurns(): Promise<void> {
  await act(async function waitTurns(): Promise<void> {
    for (let turn = 0; turn < 3; turn += 1) {
      await new Promise<void>(waitForTimers);
    }
  });
}

/** Opens a menu of the toolbar, as a pointer does. */
function openMenu(name: string): void {
  const trigger = screen.getByRole("button", { name });
  fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false });
}

describe("CombinationList", function describeCombinationList(): void {
  it("opens with the search field focused, and shows the details", function opensList(): void {
    render(<ListHarness rows={buildRows([buildTestRow("Country Map")])} />);

    openList();

    expect(screen.getByRole("combobox")).toHaveFocus();
    expect(screen.getByRole("combobox")).toHaveAccessibleName("Mod list");
    expect(
      screen.getByText("https://example.org/mod.yaml"),
    ).toBeInTheDocument();
  });

  it("chooses with the arrow keys and Enter", function choosesWithKeyboard(): void {
    const onChoose: Mock<() => void> = vi.fn<() => void>();
    const rows = buildRows([
      buildTestRow("Book List"),
      buildTestRow("Country Map", { onChoose }),
    ]);
    render(<ListHarness rows={rows} listChoices={createListChoices()} />);
    openList();
    const search = screen.getByRole("combobox");

    fireEvent.keyDown(search, { key: "ArrowDown" });
    fireEvent.keyDown(search, { key: "Enter" });

    expect(onChoose).toHaveBeenCalledOnce();
  });

  it("Escape closes the list and gives the focus back to the capsule", async function closesOnEscape(): Promise<void> {
    render(<ListHarness rows={buildRows([buildTestRow("Book List")])} />);
    openList();

    // Radix gives the focus back a moment after the list is removed.
    await act(async function pressEscape(): Promise<void> {
      fireEvent.keyDown(screen.getByRole("combobox"), { key: "Escape" });
      await new Promise<void>(waitForTimers);
    });

    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.getByRole("button", { name: "Mod: Map" })).toHaveFocus();
  });

  it("lists entries that cannot be loaded last, not selectable, with Remove for recent ones", function listsFailures(): void {
    const onRemove: Mock<() => void> = vi.fn<() => void>();
    const gone = buildTestRow("Gone", {
      failure: "HTTP 404 Not Found",
      isSelectable: false,
      onRemove,
    });
    render(
      <ListHarness
        rows={buildRows([buildTestRow("Book List")], { failedRows: [gone] })}
      />,
    );
    openList();

    const failed = screen.getByRole("list", { name: "Cannot be loaded" });
    expect(failed).toHaveTextContent("HTTP 404 Not Found");
    fireEvent.click(within(failed).getByRole("button", { name: "Remove" }));

    expect(onRemove).toHaveBeenCalledOnce();
    expect(listOptionIds()).toEqual(["Book List"]);
  });
});

describe("columns", function describeColumns(): void {
  it("Columns line up: mark, title, mosaic badge and score, each column with one width in every row", function alignsColumns(): void {
    const rows = buildRows([
      buildTestRow("Country Map", {
        mark: "current",
        mosaics: { count: 1, matching: null },
        score: buildTestScore(17, 17),
      }),
      buildTestRow("Flashcards"),
    ]);
    render(<ListHarness rows={rows} listChoices={createListChoices()} />);

    openList();

    for (const option of screen.getAllByRole("option")) {
      const columns = option.children;
      expect(columns).toHaveLength(4);
      expect(columns[0]).toHaveClass("w-3", "shrink-0");
      expect(columns[1]).toHaveClass("flex-1");
      expect(columns[2]).toHaveClass("w-9", "shrink-0");
      expect(columns[3]).toHaveClass("w-12", "shrink-0");
    }
  });

  it("names each mark, and marks the current row as current", function namesMarks(): void {
    const rows = buildRows([
      buildTestRow("Country Map", { mark: "current" }),
      buildTestRow("Atlas", { mark: "tried" }),
      buildTestRow("Flashcards"),
    ]);
    render(<ListHarness rows={rows} listChoices={createListChoices()} />);

    openList();

    const current = findOption("Country Map");
    expect(within(current).getByRole("img", { name: "Current" })).toBeVisible();
    expect(current).toHaveAttribute("aria-current", "true");
    const tried = findOption("Atlas");
    expect(
      within(tried).getByRole("img", {
        name: "Tried recently, not saved in the app",
      }),
    ).toBeInTheDocument();
    expect(tried).not.toHaveAttribute("aria-current");
    expect(within(findOption("Flashcards")).queryByRole("img")).toBeNull();
  });

  it("names the mosaic badge: a number of mosaics, the matching ones, or the icon alone", function namesBadges(): void {
    const rows = buildRows([
      buildTestRow("Country Map", { mosaics: { count: 1, matching: null } }),
      buildTestRow("Atlas", { mosaics: { count: 3, matching: 2 } }),
      buildTestRow("Nobel map", { mosaics: "icon" }),
    ]);
    render(<ListHarness rows={rows} listChoices={createListChoices()} />);

    openList();

    expect(
      within(findOption("Country Map")).getByRole("img", { name: "1 mosaic" }),
    ).toHaveTextContent("1");
    expect(
      within(findOption("Atlas")).getByRole("img", {
        name: "2 of 3 mosaics match",
      }),
    ).toHaveTextContent("2");
    expect(
      within(findOption("Nobel map")).getByRole("img", { name: "Mosaic" }),
    ).toHaveTextContent("");
  });

  it("shows the score: counting, muted without a matching tile, and still selectable", function showsScores(): void {
    const rows = buildRows([
      buildTestRow("Flashcards", { score: buildTestScore(0, 17) }),
      buildTestRow("Book List", { score: { state: "loading" } }),
      buildTestRow("Viewer", { score: UNTYPED_SCORE }),
    ]);
    render(<ListHarness rows={rows} listChoices={createListChoices()} />);

    openList();

    const flashcards = findOption("Flashcards");
    const muted = flashcards.querySelector("[data-column=score]");
    expect(muted).toHaveTextContent("0/17");
    expect(muted).toHaveClass("text-muted-foreground");
    expect(flashcards).not.toHaveAttribute("aria-disabled", "true");
    expect(
      within(findOption("Book List")).getByRole("img", { name: "Counting" }),
    ).toHaveClass("motion-safe:animate-spin");
    expect(findOption("Viewer")).toHaveTextContent("17/17");
  });
});

describe("toolbar", function describeToolbar(): void {
  it("Sort by name: the menu offers the list's sorts, and a choice orders the rows", async function sortsByName(): Promise<void> {
    const listChoices = createListChoices();
    const rows = buildRows([
      buildTestRow("Flashcards"),
      buildTestRow("Country Map", { mosaics: { count: 1, matching: null } }),
      buildTestRow("Book List"),
    ]);
    render(<ListHarness rows={rows} listChoices={listChoices} />);
    openList();
    expect(listOptionIds()).toEqual(["Country Map", "Book List", "Flashcards"]);

    openMenu("Sort");
    const menu = await screen.findByRole("menu");
    expect(within(menu).getAllByRole("menuitemradio")).toHaveLength(4);
    fireEvent.click(within(menu).getByRole("menuitemradio", { name: "Name" }));
    await flushTurns();

    expect(listOptionIds()).toEqual(["Book List", "Country Map", "Flashcards"]);
    expect(readListChoicesSnapshot(listChoices).mod.sort).toBe("name");
  });

  it("Keyboard: Enter on the sort button opens its menu, and Escape closes it with the focus back, the list open", async function usesKeyboard(): Promise<void> {
    const onChoose: Mock<() => void> = vi.fn<() => void>();
    render(
      <ListHarness
        rows={buildRows([buildTestRow("Book List", { onChoose })])}
        listChoices={createListChoices()}
      />,
    );
    openList();
    const sort = screen.getByRole("button", { name: "Sort" });
    sort.focus();

    fireEvent.keyDown(sort, { key: "Enter" });
    const menu = await screen.findByRole("menu");
    fireEvent.keyDown(menu, { key: "Escape" });
    await flushTurns();

    expect(screen.queryByRole("menu")).toBeNull();
    expect(sort).toHaveFocus();
    expect(screen.getByRole("combobox")).toBeInTheDocument();
    expect(onChoose).not.toHaveBeenCalled();
  });

  it("Escape closes only the menu, and the list stays open", async function closesMenuOnly(): Promise<void> {
    render(
      <ListHarness
        rows={buildRows([buildTestRow("Book List")])}
        listChoices={createListChoices()}
      />,
    );
    openList();
    openMenu("Sort");
    const menu = await screen.findByRole("menu");

    fireEvent.keyDown(menu, { key: "Escape" });
    await flushTurns();

    expect(screen.queryByRole("menu")).toBeNull();
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });

  it("Compatible only: a click in the filter menu keeps the list open, and the filter button is pressed", async function filtersCompatible(): Promise<void> {
    const rows = buildRows([
      buildTestRow("Flashcards", { score: buildTestScore(0, 17) }),
      buildTestRow("Book List", { score: buildTestScore(3, 17) }),
    ]);
    render(<ListHarness rows={rows} listChoices={createListChoices()} />);
    openList();
    openMenu("Filter");
    const menu = await screen.findByRole("menu");

    fireEvent.pointerDown(
      within(menu).getByRole("menuitemcheckbox", { name: "Compatible only" }),
    );
    fireEvent.click(
      within(menu).getByRole("menuitemcheckbox", { name: "Compatible only" }),
    );
    await flushTurns();

    expect(screen.getByRole("combobox")).toBeInTheDocument();
    expect(screen.getByRole("menu")).toBeInTheDocument();
    expect(listOptionIds()).toEqual(["Book List"]);
    expect(screen.getByRole("button", { name: "Filter" })).toHaveAttribute(
      "data-active",
      "true",
    );
  });

  it("keeps the choices of each list kind apart", async function keepsKindsApart(): Promise<void> {
    const listChoices = createListChoices();
    render(
      <ListHarness
        rows={buildRows([buildTestRow("Book List")])}
        listChoices={listChoices}
      />,
    );
    openList();
    openMenu("Sort");
    fireEvent.click(
      within(await screen.findByRole("menu")).getByRole("menuitemradio", {
        name: "Matching tiles",
      }),
    );
    await flushTurns();

    const snapshot = readListChoicesSnapshot(listChoices);
    expect(snapshot.mod.sort).toBe("tiles");
    expect(snapshot.collection.sort).toBe("mosaics-first");
    expect(snapshot.mosaic.sort).toBe("pair-first");
  });
});

/** Country Map with its mosaic, and Flashcards, as a mod list on the laureates. */
function buildPageRows(onChooseMosaic: () => void): ListRows {
  const countryMap = buildTestRow("Country Map", {
    mosaics: { count: 1, matching: null },
    score: buildTestScore(0, 17),
    options: [
      buildTestRow("Nobel laureates on the map", {
        mosaics: "icon",
        score: buildTestScore(17, 17),
        onChoose: onChooseMosaic,
      }),
      buildTestRow("Without a mosaic", {
        id: "Country Map#without-mosaic",
        searchText: "Country Map",
        score: buildTestScore(0, 17),
      }),
    ],
  });
  return buildRows([countryMap, buildTestRow("Flashcards")]);
}

describe("pages", function describePages(): void {
  it("Rows with mosaics open a page: Back, its mosaics, Without a mosaic, and the mosaic is chosen there", async function opensPage(): Promise<void> {
    const onChooseMosaic: Mock<() => void> = vi.fn<() => void>();
    render(
      <ListHarness
        rows={buildPageRows(onChooseMosaic)}
        listChoices={createListChoices()}
      />,
    );
    openList();
    expect(findOption("Country Map")).toHaveTextContent("17/17");

    fireEvent.click(findOption("Country Map"));
    await flushTurns();

    expect(listOptionIds()).toEqual([
      "back",
      "Nobel laureates on the map",
      "Country Map#without-mosaic",
    ]);
    expect(findOption("back")).toHaveAccessibleName("Back to Country Map");
    fireEvent.click(findOption("Nobel laureates on the map"));
    expect(onChooseMosaic).toHaveBeenCalledOnce();
  });

  it("Backspace in an empty search goes back, with the entry highlighted", async function goesBack(): Promise<void> {
    render(
      <ListHarness
        rows={buildPageRows(vi.fn<() => void>())}
        listChoices={createListChoices()}
      />,
    );
    openList();
    fireEvent.click(findOption("Country Map"));
    await flushTurns();

    fireEvent.keyDown(screen.getByRole("combobox"), { key: "Backspace" });
    await flushTurns();

    expect(listOptionIds()).toEqual(["Country Map", "Flashcards"]);
    expect(findOption("Country Map")).toHaveAttribute("aria-selected", "true");
  });
});

/** Two mods sorted by "Match ratio", Flashcards still counting. */
function buildSettlingRows(flashcardsScore: EntryScore): ListRows {
  return buildRows([
    buildTestRow("Flashcards", { score: flashcardsScore }),
    buildTestRow("Book List", { score: buildTestScore(1, 2) }),
  ]);
}

function buildRatioChoices(): ListChoices {
  const listChoices = createListChoices();
  listChoices.snapshot = {
    ...listChoices.snapshot,
    mod: { sort: "ratio", filters: [] },
  };
  return listChoices;
}

/** Country Map with a page of "Without a mosaic" only, scoring 0/17, and Flashcards with `flashcardsScore`. */
function buildBackRows(flashcardsScore: EntryScore): ListRows {
  const countryMap = buildTestRow("Country Map", {
    mosaics: { count: 1, matching: null },
    options: [
      buildTestRow("Without a mosaic", {
        id: "Country Map#without-mosaic",
        searchText: "Country Map",
        score: buildTestScore(0, 17),
      }),
    ],
  });
  return buildRows([
    buildTestRow("Flashcards", { score: flashcardsScore }),
    countryMap,
  ]);
}

function advanceTime(milliseconds: number): void {
  act(function advanceTimers(): void {
    vi.advanceTimersByTime(milliseconds);
  });
}

describe("settling", function describeSettling(): void {
  it("Score arrives while settling: the row moves to its place, at most every 300ms", function settles(): void {
    vi.useFakeTimers();
    const listChoices = buildRatioChoices();
    const { rerender } = render(
      <ListHarness
        rows={buildSettlingRows({ state: "loading" })}
        listChoices={listChoices}
      />,
    );
    openList();
    expect(listOptionIds()).toEqual(["Book List", "Flashcards"]);

    rerender(
      <ListHarness
        rows={buildSettlingRows(buildTestScore(2, 2))}
        listChoices={listChoices}
      />,
    );
    advanceTime(SETTLE_INTERVAL_MS / 2);
    expect(listOptionIds()).toEqual(["Book List", "Flashcards"]);
    expect(findOption("Flashcards")).toHaveTextContent("2/2");
    advanceTime(SETTLE_INTERVAL_MS);

    expect(listOptionIds()).toEqual(["Flashcards", "Book List"]);
  });

  it("Score arrives after the pointer moved: the score shows in its row and no row moves", function staysAfterPointer(): void {
    vi.useFakeTimers();
    const listChoices = buildRatioChoices();
    const { rerender } = render(
      <ListHarness
        rows={buildSettlingRows({ state: "loading" })}
        listChoices={listChoices}
      />,
    );
    openList();

    fireEvent.pointerMove(screen.getByRole("listbox"));
    rerender(
      <ListHarness
        rows={buildSettlingRows(buildTestScore(2, 2))}
        listChoices={listChoices}
      />,
    );
    advanceTime(SETTLE_INTERVAL_MS * 3);

    expect(listOptionIds()).toEqual(["Book List", "Flashcards"]);
    expect(findOption("Flashcards")).toHaveTextContent("2/2");
  });

  it("an arrow key stops the settling too, and a search change sorts again at once", function sortsAgainOnSearch(): void {
    vi.useFakeTimers();
    const listChoices = buildRatioChoices();
    const { rerender } = render(
      <ListHarness
        rows={buildSettlingRows({ state: "loading" })}
        listChoices={listChoices}
      />,
    );
    openList();
    fireEvent.keyDown(screen.getByRole("combobox"), { key: "ArrowDown" });
    rerender(
      <ListHarness
        rows={buildSettlingRows(buildTestScore(2, 2))}
        listChoices={listChoices}
      />,
    );
    advanceTime(SETTLE_INTERVAL_MS * 3);
    expect(listOptionIds()).toEqual(["Book List", "Flashcards"]);

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "l" } });

    expect(listOptionIds()).toEqual(["Flashcards", "Book List"]);
  });

  it("Back from a page: the stopped list is sorted with the scores that arrived, the entry highlighted", function sortsAgainOnBack(): void {
    vi.useFakeTimers();
    const listChoices = buildRatioChoices();
    const loadingRows = buildBackRows({ state: "loading" });
    const arrivedRows = buildBackRows(buildTestScore(1, 1));
    const { rerender } = render(
      <ListHarness rows={loadingRows} listChoices={listChoices} />,
    );
    openList();
    expect(listOptionIds()).toEqual(["Country Map", "Flashcards"]);
    fireEvent.pointerMove(screen.getByRole("listbox"));
    rerender(<ListHarness rows={arrivedRows} listChoices={listChoices} />);
    advanceTime(SETTLE_INTERVAL_MS * 3);
    expect(listOptionIds()).toEqual(["Country Map", "Flashcards"]);

    fireEvent.click(findOption("Country Map"));
    advanceTime(0);
    fireEvent.click(findOption("back"));
    advanceTime(0);

    expect(listOptionIds()).toEqual(["Flashcards", "Country Map"]);
    expect(findOption("Country Map")).toHaveAttribute("aria-selected", "true");
  });

  it("choosing the sort already chosen sorts the stopped list again", async function sortsAgainOnSort(): Promise<void> {
    const listChoices = buildRatioChoices();
    const { rerender } = render(
      <ListHarness
        rows={buildSettlingRows({ state: "loading" })}
        listChoices={listChoices}
      />,
    );
    openList();
    fireEvent.pointerMove(screen.getByRole("listbox"));
    rerender(
      <ListHarness
        rows={buildSettlingRows(buildTestScore(2, 2))}
        listChoices={listChoices}
      />,
    );
    await flushTurns();
    expect(listOptionIds()).toEqual(["Book List", "Flashcards"]);

    openMenu("Sort");
    fireEvent.click(
      within(await screen.findByRole("menu")).getByRole("menuitemradio", {
        name: "Match ratio",
      }),
    );
    await flushTurns();

    expect(listOptionIds()).toEqual(["Flashcards", "Book List"]);
  });
});

/** The value of the highlighted row, or `null`. */
function readHighlighted(): string | null {
  for (const option of screen.getAllByRole("option")) {
    if (option.getAttribute("aria-selected") === "true") {
      return option.getAttribute("data-value");
    }
  }
  return null;
}

/** Country Map with a mosaic and Book List first, then Flashcards, current. */
function buildCurrentLastRows(): ListRows {
  return buildRows([
    buildTestRow("Flashcards", { mark: "current" }),
    buildTestRow("Country Map", { mosaics: { count: 1, matching: null } }),
    buildTestRow("Book List"),
  ]);
}

describe("opening highlight", function describeOpeningHighlight(): void {
  it("Current mod highlighted: the current entry, although others come first", function highlightsCurrent(): void {
    render(
      <ListHarness
        rows={buildCurrentLastRows()}
        listChoices={createListChoices()}
      />,
    );

    openList();

    expect(listOptionIds()).toEqual(["Country Map", "Book List", "Flashcards"]);
    expect(readHighlighted()).toBe("Flashcards");
  });

  it("Tile link: None, the next row that can be chosen", function skipsTile(): void {
    const rows = buildRows([buildTestRow("Laureates")], {
      pinnedRows: [
        buildTestRow("2016__bob_dylan.md", {
          mark: "current",
          isSelectable: false,
        }),
        buildTestRow("None"),
      ],
    });
    render(<ListHarness rows={rows} listChoices={createListChoices()} />);

    openList();

    expect(readHighlighted()).toBe("None");
  });

  it("Current entry filtered out: the first row", function fallsBackToFirst(): void {
    const listChoices = createListChoices();
    listChoices.snapshot = {
      ...listChoices.snapshot,
      mod: { sort: "name", filters: ["unsaved"] },
    };
    const rows = buildRows([
      buildTestRow("Flashcards", { mark: "current" }),
      buildTestRow("Atlas", { mark: "tried" }),
      buildTestRow("Globe", { mark: "tried" }),
    ]);
    render(<ListHarness rows={rows} listChoices={listChoices} />);

    openList();

    expect(listOptionIds()).toEqual(["Atlas", "Globe"]);
    expect(readHighlighted()).toBe("Atlas");
  });

  it("Typing: the first row that matches", async function highlightsFirstMatch(): Promise<void> {
    render(
      <ListHarness
        rows={buildCurrentLastRows()}
        listChoices={createListChoices()}
      />,
    );
    openList();

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "o" } });
    await flushTurns();

    expect(listOptionIds()).toEqual(["Country Map", "Book List"]);
    expect(readHighlighted()).toBe("Country Map");
  });

  it("highlights the current entry again on each opening", async function highlightsOnReopen(): Promise<void> {
    render(
      <ListHarness
        rows={buildCurrentLastRows()}
        listChoices={createListChoices()}
      />,
    );
    openList();
    fireEvent.keyDown(screen.getByRole("combobox"), { key: "ArrowUp" });
    expect(readHighlighted()).not.toBe("Flashcards");

    await act(async function closeAndOpen(): Promise<void> {
      fireEvent.keyDown(screen.getByRole("combobox"), { key: "Escape" });
      await new Promise<void>(waitForTimers);
    });
    openList();

    expect(readHighlighted()).toBe("Flashcards");
  });
});
