import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import { TooltipProvider } from "@/vendor/shadcn/ui/tooltip.tsx";
import { ShareMenu } from "./ShareMenu.tsx";

const RUN_HASH =
  "#/run?mod=./mods/book_list&collection=./books/collection.yaml";

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

/** The Share menu as the stage bar holds it: its open state, and the feedback it reports. */
function ShareMenuHarness(): ReactElement {
  const [isOpen, setIsOpen] = useState(false);
  const [feedback, setFeedback] = useState("");
  return (
    <TooltipProvider>
      <ShareMenu
        hash={RUN_HASH}
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        onFeedbackChange={setFeedback}
      />
      <p data-testid="feedback">{feedback}</p>
    </TooltipProvider>
  );
}

function findShareButton(): HTMLElement {
  return screen.getByRole("button", { name: "Share" });
}

function openMenu(): void {
  fireEvent.keyDown(findShareButton(), { key: "Enter" });
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

describe("ShareMenu", function describeShareMenu(): void {
  it("has a Share button named and titled Share", function namesButton(): void {
    render(<ShareMenuHarness />);

    expect(findShareButton()).toBeInTheDocument();
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("Keyboard", function opensWithKeyboard(): void {
    render(<ShareMenuHarness />);

    openMenu();

    const item = screen.getByRole("menuitem", { name: "Copy link" });
    expect(screen.getAllByRole("menuitem")).toEqual([item]);
    expect(item).toHaveFocus();
  });

  it("Copy the link", async function copiesLink(): Promise<void> {
    render(<ShareMenuHarness />);

    await chooseCopyLink();

    const { origin, pathname, search } = window.location;
    expect(writeText).toHaveBeenCalledExactlyOnceWith(
      `${origin}${pathname}${search}${RUN_HASH}`,
    );
    expect(screen.queryByRole("menu")).toBeNull();
    expect(readTooltip()).toBe("Link copied");
    expect(findShareButton()).toHaveAccessibleName("Share");
    expect(screen.getByTestId("feedback")).toHaveTextContent("Link copied");
  });

  it("says Link copied for 2 seconds", async function endsFeedback(): Promise<void> {
    render(<ShareMenuHarness />);
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
    render(<ShareMenuHarness />);

    await chooseCopyLink();

    expect(readTooltip()).toBe("Cannot copy the link");
    expect(screen.getByTestId("feedback")).toHaveTextContent(
      "Cannot copy the link",
    );
  });

  it("says Cannot copy the link without a clipboard", async function showsMissingClipboard(): Promise<void> {
    vi.stubGlobal("navigator", { ...navigator, clipboard: undefined });
    render(<ShareMenuHarness />);

    await chooseCopyLink();

    expect(readTooltip()).toBe("Cannot copy the link");
  });
});
