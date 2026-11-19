import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { useRef, useState } from "react";
import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import { TooltipProvider } from "@/vendor/shadcn/ui/tooltip.tsx";
import type { Loadable, TileCount } from "../../lib/core/combinations/index.ts";
import { CombinationList } from "./CombinationList.tsx";
import type { CombinationRow } from "./CombinationList.tsx";
import {
  buildMosaicCountMark,
  CURRENT_MARK,
  RECENT_MARK,
} from "./combination_rows.ts";
import type { CombinationMark } from "./combination_rows.ts";

interface RowFields {
  id: string;
  count?: Loadable<TileCount> | null;
  marks?: readonly CombinationMark[];
  failure?: string | null;
  onChoose?: () => void;
  onRemove?: (() => void) | null;
}

function waitForTimers(resolve: () => void): void {
  setTimeout(resolve, 0);
}

function ignoreChoice(): void {
  // The test does not choose this row.
}

function buildRow(fields: RowFields): CombinationRow {
  const row: CombinationRow = {
    id: fields.id,
    title: fields.id,
    details: [],
    count: fields.count ?? null,
    marks: fields.marks ?? [],
    isSelectable: (fields.failure ?? null) === null,
    failure: fields.failure ?? null,
    onChoose: fields.onChoose ?? ignoreChoice,
    onRemove: fields.onRemove ?? null,
  };
  return row;
}

function buildCount(matching: number, total: number): Loadable<TileCount> {
  const count: Loadable<TileCount> = {
    state: "loaded",
    value: { matching, total },
  };
  return count;
}

interface HarnessProps {
  rows: readonly CombinationRow[];
}

/** A list with its capsule, open state and anchor, as the stage bar holds them. */
function ListHarness({ rows }: HarnessProps): ReactElement {
  const [isOpen, setIsOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);
  return (
    <TooltipProvider>
      <div ref={anchorRef}>
        <CombinationList
          label="Mod list"
          isOpen={isOpen}
          onOpenChange={setIsOpen}
          anchorRef={anchorRef}
          leadRows={[]}
          sections={[{ heading: null, rows }]}
          sortsByCount
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

function listOptionNames(): string[] {
  const names: string[] = [];
  for (const option of screen.getAllByRole("option")) {
    names.push(option.getAttribute("data-value") ?? "");
  }
  return names;
}

describe("CombinationList", function describeCombinationList(): void {
  it("opens with the search field focused, and shows the details", function opensList(): void {
    render(<ListHarness rows={[buildRow({ id: "Country Map" })]} />);

    openList();

    expect(screen.getByRole("combobox")).toHaveFocus();
    expect(screen.getByRole("combobox")).toHaveAccessibleName("Mod list");
    expect(
      screen.getByText("https://example.org/mod.yaml"),
    ).toBeInTheDocument();
  });

  it("Search the mods: keeps the titles that hold the text, ignoring case", async function searches(): Promise<void> {
    const rows = [
      buildRow({ id: "Book List" }),
      buildRow({ id: "Flashcards" }),
      buildRow({ id: "Country Map" }),
    ];
    render(<ListHarness rows={rows} />);
    openList();

    await act(async function typeSearch(): Promise<void> {
      fireEvent.change(screen.getByRole("combobox"), {
        target: { value: "MAP" },
      });
      await Promise.resolve();
    });

    expect(listOptionNames()).toEqual(["Country Map"]);
  });

  it("chooses with the arrow keys and Enter", function choosesWithKeyboard(): void {
    const onChoose: Mock<() => void> = vi.fn<() => void>();
    const rows = [
      buildRow({ id: "Book List" }),
      buildRow({ id: "Country Map", onChoose }),
    ];
    render(<ListHarness rows={rows} />);
    openList();
    const search = screen.getByRole("combobox");

    fireEvent.keyDown(search, { key: "ArrowDown" });
    fireEvent.keyDown(search, { key: "Enter" });

    expect(onChoose).toHaveBeenCalledOnce();
  });

  it("Escape closes the list and gives the focus back to the capsule", async function closesOnEscape(): Promise<void> {
    render(<ListHarness rows={[buildRow({ id: "Book List" })]} />);
    openList();

    // Radix gives the focus back a moment after the list is removed.
    await act(async function pressEscape(): Promise<void> {
      fireEvent.keyDown(screen.getByRole("combobox"), { key: "Escape" });
      await new Promise<void>(waitForTimers);
    });

    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.getByRole("button", { name: "Mod: Map" })).toHaveFocus();
  });

  it("sorts what fits first, then partly, then Not compatible, muted and saying no match", function sortsByCount(): void {
    const rows = [
      buildRow({ id: "Flashcards", count: buildCount(0, 17) }),
      buildRow({ id: "Book List", count: buildCount(3, 17) }),
      buildRow({ id: "Country Map", count: buildCount(17, 17) }),
      buildRow({ id: "Viewer", count: { state: "loaded", value: "any" } }),
    ];
    render(<ListHarness rows={rows} />);

    openList();

    expect(listOptionNames()).toEqual([
      "Country Map",
      "Viewer",
      "Book List",
      "Flashcards",
    ]);
    const group = screen.getByRole("group", { name: "Not compatible" });
    const flashcards = within(group).getByRole("option");
    expect(within(flashcards).getByText("0/17")).toBeInTheDocument();
    expect(within(flashcards).getByText("no match")).toHaveAttribute(
      "data-slot",
      "badge",
    );
    expect(flashcards).toHaveClass("text-muted-foreground");
    expect(flashcards).not.toHaveAttribute("aria-disabled", "true");
  });

  it("Count arrives while open: the entry shows it and stays at its place", function keepsOrder(): void {
    const loading: Loadable<TileCount> = { state: "loading" };
    const { rerender } = render(
      <ListHarness
        rows={[
          buildRow({ id: "Flashcards", count: loading }),
          buildRow({ id: "Country Map", count: buildCount(2, 2) }),
        ]}
      />,
    );
    openList();
    expect(screen.getAllByLabelText("Counting")).toHaveLength(1);

    rerender(
      <ListHarness
        rows={[
          buildRow({ id: "Flashcards", count: buildCount(0, 2) }),
          buildRow({ id: "Country Map", count: buildCount(2, 2) }),
        ]}
      />,
    );

    expect(listOptionNames()).toEqual(["Flashcards", "Country Map"]);
    const flashcards = screen.getAllByRole("option")[0];
    expect(flashcards).toHaveTextContent("0/2");
    expect(flashcards).toHaveTextContent("no match");
    expect(screen.queryByRole("group", { name: "Not compatible" })).toBeNull();
  });

  it("gives each mark kind its badge style: Current filled, Recent secondary, mosaics outline, no match muted", function stylesMarks(): void {
    const mosaicMark = buildMosaicCountMark(2);
    const rows = [
      buildRow({
        id: "Country Map",
        count: buildCount(17, 17),
        marks: [
          CURRENT_MARK,
          RECENT_MARK,
          ...(mosaicMark === null ? [] : [mosaicMark]),
        ],
      }),
      buildRow({ id: "Flashcards", count: buildCount(0, 17) }),
    ];
    render(<ListHarness rows={rows} />);

    openList();

    const listbox = screen.getByRole("listbox");
    expect(within(listbox).getByText("Current")).toHaveAttribute(
      "data-variant",
      "default",
    );
    expect(within(listbox).getByText("Recent")).toHaveAttribute(
      "data-variant",
      "secondary",
    );
    expect(within(listbox).getByText("2 mosaics")).toHaveAttribute(
      "data-variant",
      "outline",
    );
    const noMatch = within(listbox).getByText("no match");
    expect(noMatch).toHaveAttribute("data-variant", "outline");
    expect(noMatch).toHaveClass("text-muted-foreground");
  });

  it("puts every count in one right-aligned column after the marks, reserved on rows without a count", function alignsCounts(): void {
    const rows = [
      buildRow({ id: "Country Map", count: buildCount(17, 17) }),
      buildRow({ id: "Viewer", count: { state: "loaded", value: "any" } }),
      buildRow({ id: "Loading", count: { state: "loading" } }),
      buildRow({ id: "None", count: null }),
      buildRow({ id: "Flashcards", count: buildCount(0, 17) }),
    ];
    render(<ListHarness rows={rows} />);

    openList();

    const columns: Element[] = [];
    for (const option of screen.getAllByRole("option")) {
      const column = option.lastElementChild;
      expect(column).not.toBeNull();
      columns.push(column as Element);
    }
    for (const column of columns) {
      expect(column).toHaveClass("w-12", "shrink-0", "text-right");
    }
    const flashcards = screen.getByRole("option", { name: /Flashcards/ });
    const noMatch = within(flashcards).getByText("no match");
    expect(noMatch.nextElementSibling).toHaveTextContent("0/17");
  });

  it("lists entries that cannot be loaded last, not selectable, with Remove for recent ones", function listsFailures(): void {
    const onRemove: Mock<() => void> = vi.fn<() => void>();
    const rows = [
      buildRow({ id: "Gone", failure: "HTTP 404 Not Found", onRemove }),
      buildRow({ id: "Book List" }),
    ];
    render(<ListHarness rows={rows} />);
    openList();

    const failed = screen.getByRole("list", { name: "Cannot be loaded" });
    fireEvent.click(within(failed).getByRole("button", { name: "Remove" }));

    expect(listOptionNames()).toEqual(["Book List"]);
    expect(failed).toHaveTextContent("Gone");
    expect(failed).toHaveTextContent("404");
    expect(onRemove).toHaveBeenCalledOnce();
  });
});
