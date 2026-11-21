import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import { TooltipProvider } from "@/vendor/shadcn/ui/tooltip.tsx";
import {
  buildFakeMatchMedia,
  createFakeHoverDevice,
} from "../../test/fake_hover_queries.ts";
import { MoreActionsMenu } from "./MoreActionsMenu.tsx";

const RUN_HASH =
  "#/run?mod=./mods/book_list&collection=./books/collection.yaml";

let writeText: Mock<(text: string) => Promise<void>>;
let onReloadTiles: Mock<() => void>;
let onTheaterToggle: Mock<() => void>;
let onFullscreen: Mock<() => void>;

beforeEach(function stubClipboard(): void {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  writeText = vi.fn<(text: string) => Promise<void>>();
  writeText.mockResolvedValue(undefined);
  onReloadTiles = vi.fn<() => void>();
  onTheaterToggle = vi.fn<() => void>();
  onFullscreen = vi.fn<() => void>();
  vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
});

afterEach(function restore(): void {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

interface HarnessProps {
  canReloadTiles?: boolean;
  /** Whether the stage bar is under 480px wide. */
  isNarrow?: boolean;
  isTheaterMode?: boolean;
  /** Whether the sandbox has a running mod frame, which fullscreen needs. */
  hasModFrame?: boolean;
}

/** The menu as the stage bar holds it: its open state, and the feedback it reports. */
function MoreActionsHarness({
  canReloadTiles = true,
  isNarrow = false,
  isTheaterMode = false,
  hasModFrame = true,
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
        isNarrow={isNarrow}
        viewActions={{
          isTheaterMode,
          onTheaterToggle,
          onFullscreen: hasModFrame ? onFullscreen : null,
        }}
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

  it("says Link copied on a device that cannot hover", async function showsCopiedOnTouch(): Promise<void> {
    vi.stubGlobal(
      "matchMedia",
      buildFakeMatchMedia(createFakeHoverDevice(false)),
    );
    render(<MoreActionsHarness />);

    await chooseCopyLink();

    expect(readTooltip()).toBe("Link copied");
  });

  it("says Cannot copy the link without a clipboard", async function showsMissingClipboard(): Promise<void> {
    vi.stubGlobal("navigator", { ...navigator, clipboard: undefined });
    render(<MoreActionsHarness />);

    await chooseCopyLink();

    expect(readTooltip()).toBe("Cannot copy the link");
  });
});

function readMenuItemNames(): string[] {
  const names: string[] = [];
  const menu = screen.getByRole("menu");
  for (const item of menu.querySelectorAll('[role^="menuitem"]')) {
    names.push(item.textContent ?? "");
  }
  return names;
}

describe("view actions on a narrow bar", function describeViewActions(): void {
  it("Wide bar keeps the menu short", function keepsWideMenuShort(): void {
    render(<MoreActionsHarness />);

    openMenu();

    expect(readMenuItemNames()).toEqual(["Copy link", "Reload tiles"]);
  });

  it("Narrow bar: Theater mode and Fullscreen after the other items", function addsViewItems(): void {
    render(<MoreActionsHarness isNarrow />);

    openMenu();

    expect(readMenuItemNames()).toEqual([
      "Copy link",
      "Reload tiles",
      "Theater mode",
      "Fullscreen",
    ]);
    expect(screen.getByRole("separator")).toBeInTheDocument();
  });

  it("Theater mode is checked while it is on, and toggles it", function togglesTheater(): void {
    const { unmount } = render(<MoreActionsHarness isNarrow />);
    openMenu();
    const off = screen.getByRole("menuitemcheckbox", { name: "Theater mode" });
    expect(off).toHaveAttribute("aria-checked", "false");

    fireEvent.click(off);

    expect(onTheaterToggle).toHaveBeenCalledOnce();
    unmount();
    render(<MoreActionsHarness isNarrow isTheaterMode />);
    openMenu();
    expect(
      screen.getByRole("menuitemcheckbox", { name: "Theater mode" }),
    ).toHaveAttribute("aria-checked", "true");
  });

  it("Fullscreen shows the mod fullscreen", function startsFullscreen(): void {
    render(<MoreActionsHarness isNarrow />);
    openMenu();

    fireEvent.click(screen.getByRole("menuitem", { name: "Fullscreen" }));

    expect(onFullscreen).toHaveBeenCalledOnce();
  });

  it("No Fullscreen without a running mod frame", function hidesFullscreen(): void {
    render(<MoreActionsHarness isNarrow hasModFrame={false} />);

    openMenu();

    expect(screen.queryByRole("menuitem", { name: "Fullscreen" })).toBeNull();
    expect(
      screen.getByRole("menuitemcheckbox", { name: "Theater mode" }),
    ).toBeInTheDocument();
  });
});
