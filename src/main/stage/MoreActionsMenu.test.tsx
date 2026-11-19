import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import { TooltipProvider } from "@/vendor/shadcn/ui/tooltip.tsx";
import { MoreActionsMenu } from "./MoreActionsMenu.tsx";

const RUN_HASH =
  "#/run?mod=./mods/book_list&collection=./books/collection.yaml";

let writeText: Mock<(text: string) => Promise<void>>;
let onReloadTiles: Mock<() => void>;

beforeEach(function stubClipboard(): void {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  writeText = vi.fn<(text: string) => Promise<void>>();
  writeText.mockResolvedValue(undefined);
  onReloadTiles = vi.fn<() => void>();
  vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
});

afterEach(function restore(): void {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

interface HarnessProps {
  canReloadTiles?: boolean;
}

/** The menu as the stage bar holds it: its open state, and the feedback it reports. */
function MoreActionsHarness({
  canReloadTiles = true,
}: HarnessProps): ReactElement {
  const [isOpen, setIsOpen] = useState(false);
  const [feedback, setFeedback] = useState("");
  return (
    <TooltipProvider>
      <MoreActionsMenu
        hash={RUN_HASH}
        canReloadTiles={canReloadTiles}
        onReloadTiles={onReloadTiles}
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        onFeedbackChange={setFeedback}
      />
      <p data-testid="feedback">{feedback}</p>
    </TooltipProvider>
  );
}

function findMoreButton(): HTMLElement {
  return screen.getByRole("button", { name: "More actions" });
}

function openMenu(): void {
  fireEvent.keyDown(findMoreButton(), { key: "Enter" });
}

async function chooseCopyLink(): Promise<void> {
  openMenu();
  await act(async function clickCopy(): Promise<void> {
    fireEvent.click(screen.getByRole("menuitem", { name: "Copy link" }));
    await Promise.resolve();
    await Promise.resolve();
  });
}

function readTooltip(): string {
  return screen.getByRole("tooltip").textContent ?? "";
}

describe("MoreActionsMenu", function describeMoreActionsMenu(): void {
  it("has a button named and titled More actions", function namesButton(): void {
    render(<MoreActionsHarness />);

    expect(findMoreButton()).toBeInTheDocument();
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("Keyboard", function opensWithKeyboard(): void {
    render(<MoreActionsHarness />);

    openMenu();

    const item = screen.getByRole("menuitem", { name: "Copy link" });
    expect(screen.getAllByRole("menuitem")[0]).toBe(item);
    expect(item).toHaveFocus();
  });

  it("Reload tiles", function reloadsTiles(): void {
    render(<MoreActionsHarness />);
    openMenu();

    fireEvent.click(screen.getByRole("menuitem", { name: "Reload tiles" }));

    expect(onReloadTiles).toHaveBeenCalledOnce();
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("No collection", function hidesReload(): void {
    render(<MoreActionsHarness canReloadTiles={false} />);

    openMenu();

    expect(screen.getAllByRole("menuitem")).toEqual([
      screen.getByRole("menuitem", { name: "Copy link" }),
    ]);
  });

  it("Copy the link", async function copiesLink(): Promise<void> {
    render(<MoreActionsHarness />);

    await chooseCopyLink();

    const { origin, pathname, search } = window.location;
    expect(writeText).toHaveBeenCalledExactlyOnceWith(
      `${origin}${pathname}${search}${RUN_HASH}`,
    );
    expect(screen.queryByRole("menu")).toBeNull();
    expect(readTooltip()).toBe("Link copied");
    expect(findMoreButton()).toHaveAccessibleName("More actions");
    expect(screen.getByTestId("feedback")).toHaveTextContent("Link copied");
  });

  it("says Link copied for 2 seconds", async function endsFeedback(): Promise<void> {
    render(<MoreActionsHarness />);
    await chooseCopyLink();

    await act(async function waitAlmost(): Promise<void> {
      await vi.advanceTimersByTimeAsync(1999);
    });
    expect(readTooltip()).toBe("Link copied");
    await act(async function waitRest(): Promise<void> {
      await vi.advanceTimersByTimeAsync(1);
    });

    expect(screen.queryByText("Link copied")).toBeNull();
    expect(screen.getByTestId("feedback")).toHaveTextContent("");
  });

  it("Copy refused", async function showsFailure(): Promise<void> {
    writeText.mockRejectedValue(new Error("Not allowed"));
    render(<MoreActionsHarness />);

    await chooseCopyLink();

    expect(readTooltip()).toBe("Cannot copy the link");
    expect(screen.getByTestId("feedback")).toHaveTextContent(
      "Cannot copy the link",
    );
  });

  it("says Cannot copy the link without a clipboard", async function showsMissingClipboard(): Promise<void> {
    vi.stubGlobal("navigator", { ...navigator, clipboard: undefined });
    render(<MoreActionsHarness />);

    await chooseCopyLink();

    expect(readTooltip()).toBe("Cannot copy the link");
  });
});
