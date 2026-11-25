import { act, fireEvent, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/vendor/shadcn/ui/tooltip.tsx";
import {
  buildFakeMatchMedia,
  changePrimaryPointer,
  createFakeHoverDevice,
} from "../test/fake_hover_queries.ts";
import type { FakeHoverDevice } from "../test/fake_hover_queries.ts";
import { HoverTooltip } from "./HoverTooltip.tsx";

function stubDevice(canHover: boolean): FakeHoverDevice {
  const device = createFakeHoverDevice(canHover);
  vi.stubGlobal("matchMedia", buildFakeMatchMedia(device));
  return device;
}

function renderTooltip(element: ReactElement): void {
  render(<TooltipProvider>{element}</TooltipProvider>);
}

function renderGuidesTooltip(): void {
  renderTooltip(
    <HoverTooltip content="Guides">
      <button type="button" aria-label="Guides">
        G
      </button>
    </HoverTooltip>,
  );
}

function guidesButton(): HTMLElement {
  return screen.getByRole("button", { name: "Guides" });
}

describe("HoverTooltip", function describeHoverTooltip(): void {
  afterEach(function restoreMatchMedia(): void {
    vi.unstubAllGlobals();
  });

  it("Opens on focus where the pointer can hover", async function opensWithHover(): Promise<void> {
    stubDevice(true);
    renderGuidesTooltip();

    act(function focusTrigger(): void {
      guidesButton().focus();
    });

    expect(await screen.findByRole("tooltip")).toHaveTextContent("Guides");
  });

  it("Stays closed on a tap where the pointer cannot hover", function staysClosedOnTouch(): void {
    stubDevice(false);
    renderGuidesTooltip();

    act(function tapTrigger(): void {
      guidesButton().focus();
    });
    fireEvent.click(guidesButton());

    expect(screen.queryByRole("tooltip")).toBeNull();
    expect(guidesButton()).toBeInTheDocument();
  });

  it("Follows a change of the primary pointer", async function followsChange(): Promise<void> {
    const device = stubDevice(false);
    renderGuidesTooltip();
    const button = guidesButton();

    act(function dockMouse(): void {
      changePrimaryPointer(device, true);
    });
    act(function focusTrigger(): void {
      guidesButton().focus();
    });

    expect(await screen.findByRole("tooltip")).toHaveTextContent("Guides");
    expect(guidesButton()).toBe(button);
  });

  it("Shows a pinned tooltip on every device", async function showsPinned(): Promise<void> {
    stubDevice(false);
    renderTooltip(
      <HoverTooltip content="Link copied" isPinnedOpen>
        <button type="button" aria-label="More actions">
          …
        </button>
      </HoverTooltip>,
    );

    expect(await screen.findByRole("tooltip")).toHaveTextContent("Link copied");
  });
});
