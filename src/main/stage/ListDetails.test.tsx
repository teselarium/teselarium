import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import { TooltipProvider } from "@/vendor/shadcn/ui/tooltip.tsx";
import { ListDetails } from "./ListDetails.tsx";
import type { ListDetail } from "./ListDetails.tsx";

const RUN_LINK = "https://example.org/#/run?mosaic=./mosaics/map/mosaic.yaml";

const MOSAIC_DETAILS: readonly ListDetail[] = Object.freeze([
  { term: "Mosaic", value: "Unsaved combination", open: null },
  {
    term: "Run link",
    value: RUN_LINK,
    open: { address: RUN_LINK, place: "a new tab" },
  },
]);

const MOD_SOURCE = "https://example.org/mods/map/mod.yaml";

const MOD_VIEWER_ADDRESS =
  "https://example.org/#/run?mod=mod_viewer&target=https%3A%2F%2Fexample.org%2Fmods%2Fmap%2Fmod.yaml";

const MOD_DETAIL: ListDetail = Object.freeze({
  term: "Mod",
  value: MOD_SOURCE,
  open: { address: MOD_VIEWER_ADDRESS, place: "the mod viewer" },
});

let writeText: Mock<(text: string) => Promise<void>>;

beforeEach(function stubClipboard(): void {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  writeText = vi.fn<(text: string) => Promise<void>>();
  writeText.mockResolvedValue(undefined);
  vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
});

afterEach(function restore(): void {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function renderDetails(details: readonly ListDetail[]): void {
  render(
    <TooltipProvider>
      <ListDetails details={details} />
    </TooltipProvider>,
  );
}

async function pressCopy(name: string): Promise<void> {
  await act(async function clickCopy(): Promise<void> {
    fireEvent.click(screen.getByRole("button", { name }));
    await Promise.resolve();
    await Promise.resolve();
  });
}

function findDetails(): HTMLElement {
  const details = document.querySelector<HTMLElement>("dl[aria-label=Details]");
  if (details === null) {
    throw new Error("Expected the details list");
  }
  return details;
}

function readTooltip(): string {
  return screen.getByRole("tooltip").textContent ?? "";
}

function readLiveRegion(): string {
  const region = document.querySelector("[aria-live=polite]");
  return region?.textContent ?? "";
}

describe("ListDetails", function describeListDetails(): void {
  it("shows each term and its value as selectable text", function showsDetails(): void {
    renderDetails(MOSAIC_DETAILS);

    const details = findDetails();
    expect(details.parentElement).toHaveClass("select-text");
    expect(details).toHaveTextContent("Unsaved combination");
    expect(details).toHaveTextContent(RUN_LINK);
  });

  it("Copy the run link: the clipboard holds it, and Copied shows and is announced, for 2 seconds", async function copiesRunLink(): Promise<void> {
    renderDetails(MOSAIC_DETAILS);

    await pressCopy("Copy run link");

    expect(writeText).toHaveBeenCalledExactlyOnceWith(RUN_LINK);
    expect(readTooltip()).toBe("Copied");
    expect(readLiveRegion()).toBe("Copied");
    await act(async function waitFeedback(): Promise<void> {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(screen.queryByText("Copied")).toBeNull();
    expect(readLiveRegion()).toBe("");
  });

  it("Copy refused: Cannot copy shows and is announced", async function showsRefusal(): Promise<void> {
    writeText.mockRejectedValue(new Error("Not allowed"));
    renderDetails([MOD_DETAIL]);

    await pressCopy("Copy mod");

    expect(readTooltip()).toBe("Cannot copy");
    expect(readLiveRegion()).toBe("Cannot copy");
  });

  it("Open in a new tab: a link to the value with no opener and no referrer", function opensInNewTab(): void {
    renderDetails(MOSAIC_DETAILS);

    const link = screen.getByRole("link", {
      name: "Open run link in a new tab",
    });

    expect(link).toHaveAttribute("href", RUN_LINK);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("Open in the viewer: the link goes to the viewer, named after it, and Copy still copies the address", async function opensInViewer(): Promise<void> {
    renderDetails([MOD_DETAIL]);

    const link = screen.getByRole("link", {
      name: "Open mod in the mod viewer",
    });
    await pressCopy("Copy mod");

    expect(link).toHaveAttribute("href", MOD_VIEWER_ADDRESS);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(writeText).toHaveBeenCalledExactlyOnceWith(MOD_SOURCE);
  });

  it("No Open link: a detail without one keeps its Copy button", function leavesOutOpen(): void {
    renderDetails([{ ...MOD_DETAIL, open: null }]);

    const details = findDetails();
    expect(
      within(details).getByRole("button", { name: "Copy mod" }),
    ).toBeInTheDocument();
    expect(within(details).queryAllByRole("link")).toEqual([]);
  });

  it("No buttons: Unsaved combination, the version and a local file's address have no controls", function leavesOutControls(): void {
    renderDetails([
      {
        term: "Mod",
        value: "file:///home/user/mods/map/mod.yaml",
        open: { address: MOD_VIEWER_ADDRESS, place: "the mod viewer" },
      },
      { term: "Version", value: "1.0.1", open: null },
      { term: "Mosaic", value: "Unsaved combination", open: null },
    ]);

    const details = findDetails();
    expect(within(details).queryAllByRole("button")).toEqual([]);
    expect(within(details).queryAllByRole("link")).toEqual([]);
  });
});
