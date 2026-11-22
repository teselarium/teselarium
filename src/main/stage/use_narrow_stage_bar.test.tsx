import { act, render, screen } from "@testing-library/react";
import { useRef } from "react";
import type { ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  FakeResizeObserver,
  forgetFakeResizeObservers,
  resizeObservedElements,
} from "../../test/fake_resize_observer.ts";
import {
  followBarFold,
  useNarrowStageBar,
  WIDE_BAR,
} from "./use_narrow_stage_bar.ts";
import type { BarFold } from "./use_narrow_stage_bar.ts";

/** How much wider the harness's left side's content is than its box: above 0, it overflows. */
let leftSideOverflow = 0;

/** The same for the capsule row inside it, which can overflow while the left side does not. */
let capsuleRowOverflow = 0;

function readLeftScrollWidth(this: HTMLElement): number {
  return 100 + leftSideOverflow;
}

function readRowScrollWidth(this: HTMLElement): number {
  return 100 + capsuleRowOverflow;
}

function readLeftClientWidth(): number {
  return 100;
}

function refuseRoom(): boolean {
  return false;
}

interface HarnessProps {
  contentKey?: string;
  onAskRoom?: () => boolean;
}

/** A bar and its left side, whose overflow the test sets, since jsdom lays nothing out. */
function BarHarness({
  contentKey = "sandbox-1",
  onAskRoom = refuseRoom,
}: HarnessProps): ReactElement {
  const barRef = useRef<HTMLElement>(null);
  const leftSideRef = useRef<HTMLDivElement>(null);
  const form = useNarrowStageBar(barRef, leftSideRef, contentKey, onAskRoom);
  return (
    <section ref={barRef} aria-label="Stage bar">
      <div ref={leftSideRef} data-testid="left-side">
        <div data-capsule-row="" data-testid="capsule-row" />
        {form.isNarrow ? "narrow" : "wide"}
      </div>
      <p data-testid="phone-width">
        {form.isUnderPhoneWidth ? "under phone width" : "phone width or more"}
      </p>
    </section>
  );
}

function stubLeftSideOverflow(): void {
  const left = screen.getByTestId("left-side");
  Object.defineProperty(left, "scrollWidth", {
    configurable: true,
    get: readLeftScrollWidth,
  });
  Object.defineProperty(left, "clientWidth", {
    configurable: true,
    get: readLeftClientWidth,
  });
  const row = screen.getByTestId("capsule-row");
  Object.defineProperty(row, "scrollWidth", {
    configurable: true,
    get: readRowScrollWidth,
  });
  Object.defineProperty(row, "clientWidth", {
    configurable: true,
    get: readLeftClientWidth,
  });
}

function readForm(): string {
  return screen.getByTestId("left-side").textContent ?? "";
}

function showAtWidth(width: number): string {
  act(resizeObservedElements.bind(undefined, "section", width));
  return readForm();
}

function renderBar(
  onAskRoom: () => boolean = refuseRoom,
): ReturnType<typeof render> {
  vi.stubGlobal("ResizeObserver", FakeResizeObserver);
  const rendered = render(<BarHarness onAskRoom={onAskRoom} />);
  stubLeftSideOverflow();
  return rendered;
}

describe("followBarFold", function describeFollowBarFold(): void {
  it("is narrow under 480px, wide from 480px", function foldsByWidth(): void {
    const measure = { leftSideOverflows: false, roomGiven: false };

    expect(followBarFold(WIDE_BAR, { ...measure, width: 479 }).isNarrow).toBe(
      true,
    );
    expect(followBarFold(WIDE_BAR, { ...measure, width: 480 })).toBe(WIDE_BAR);
  });

  it("folds when its left side overflows, recording the width", function foldsOnOverflow(): void {
    const fold = followBarFold(WIDE_BAR, {
      width: 640,
      leftSideOverflows: true,
      roomGiven: false,
    });

    expect(fold).toEqual({ isNarrow: true, foldedAt: 640 });
  });

  it("stays wide when its left side overflows and the sidebar gave room", function staysWideWithRoom(): void {
    const fold = followBarFold(WIDE_BAR, {
      width: 640,
      leftSideOverflows: true,
      roomGiven: true,
    });

    expect(fold).toBe(WIDE_BAR);
  });

  it("stays narrow up to the recorded width, and unfolds past it", function unfoldsPastRecord(): void {
    const folded: BarFold = { isNarrow: true, foldedAt: 640 };
    const measure = { leftSideOverflows: false, roomGiven: false };

    expect(followBarFold(folded, { ...measure, width: 640 })).toBe(folded);
    expect(followBarFold(folded, { ...measure, width: 641 })).toBe(WIDE_BAR);
  });
});

describe("useNarrowStageBar", function describeUseNarrowStageBar(): void {
  afterEach(function restoreObserver(): void {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    forgetFakeResizeObservers();
    leftSideOverflow = 0;
    capsuleRowOverflow = 0;
  });

  it("is narrow under 480px of content width, and follows resizes", function followsWidth(): void {
    renderBar();

    expect(showAtWidth(479)).toBe("narrow");
    expect(showAtWidth(480)).toBe("wide");
    expect(showAtWidth(481)).toBe("wide");
    expect(showAtWidth(479)).toBe("narrow");
  });

  it("is under phone width under 262px of content width, the bar of a 360px viewport", function followsPhoneWidth(): void {
    renderBar();

    showAtWidth(261);
    expect(screen.getByTestId("phone-width")).toHaveTextContent(
      "under phone width",
    );
    showAtWidth(262);
    expect(screen.getByTestId("phone-width")).toHaveTextContent(
      "phone width or more",
    );
  });

  it("folds when the capsules do not fit, until the bar is wider than where it folded", function foldsOnFit(): void {
    renderBar();
    leftSideOverflow = 30;

    expect(showAtWidth(640)).toBe("narrow");
    leftSideOverflow = 0;
    expect(showAtWidth(640)).toBe("narrow");
    expect(showAtWidth(641)).toBe("wide");
  });

  it("folds when the capsule row overflows under the items after it, though the left side does not", function foldsOnRowOverflow(): void {
    renderBar();
    capsuleRowOverflow = 28;

    expect(showAtWidth(625)).toBe("narrow");
    capsuleRowOverflow = 0;
    expect(showAtWidth(626)).toBe("wide");
  });

  it("folds again at once when the capsules still do not fit after unfolding", function refoldsWhenStillTooNarrow(): void {
    renderBar();
    leftSideOverflow = 30;
    showAtWidth(640);

    expect(showAtWidth(641)).toBe("narrow");
    leftSideOverflow = 0;
    expect(showAtWidth(641)).toBe("narrow");
    expect(showAtWidth(642)).toBe("wide");
  });

  it("asks for room once when the capsules do not fit, and stays wide when given it", function staysWideWithRoom(): void {
    const askRoom = vi.fn<() => boolean>().mockReturnValue(true);
    renderBar(askRoom);
    leftSideOverflow = 30;

    expect(showAtWidth(640)).toBe("wide");
    expect(askRoom).toHaveBeenCalledOnce();
  });

  it("folds when the sidebar gives no room", function foldsWithoutRoom(): void {
    const askRoom = vi.fn<() => boolean>().mockReturnValue(false);
    renderBar(askRoom);
    leftSideOverflow = 30;

    expect(showAtWidth(640)).toBe("narrow");
    expect(askRoom).toHaveBeenCalledOnce();
  });

  it("folds when the capsules still do not fit in the room given", function foldsAfterRoom(): void {
    const askRoom = vi
      .fn<() => boolean>()
      .mockReturnValueOnce(true)
      .mockReturnValue(false);
    renderBar(askRoom);
    leftSideOverflow = 30;

    expect(showAtWidth(640)).toBe("wide");
    expect(showAtWidth(700)).toBe("narrow");
    expect(askRoom).toHaveBeenCalledTimes(2);
  });

  it("never asks under 480px or while narrow", function asksOnlyWhenWide(): void {
    const askRoom = vi.fn<() => boolean>().mockReturnValue(false);
    renderBar(askRoom);
    leftSideOverflow = 30;

    expect(showAtWidth(479)).toBe("narrow");
    expect(askRoom).not.toHaveBeenCalled();
    expect(showAtWidth(640)).toBe("narrow");
    expect(askRoom).toHaveBeenCalledOnce();
    expect(showAtWidth(620)).toBe("narrow");
    expect(askRoom).toHaveBeenCalledOnce();
  });

  it("drops the recorded width when the bar's content changes", function forgetsOnContent(): void {
    const { rerender } = renderBar();
    leftSideOverflow = 30;
    showAtWidth(640);
    leftSideOverflow = 0;

    rerender(<BarHarness contentKey="sandbox-1|sites" />);

    expect(readForm()).toBe("wide");
  });

  it("stops observing once unmounted", function disconnects(): void {
    vi.stubGlobal("ResizeObserver", FakeResizeObserver);
    const disconnect = vi.spyOn(FakeResizeObserver.prototype, "disconnect");
    const { unmount } = render(<BarHarness />);

    unmount();

    expect(disconnect).toHaveBeenCalledOnce();
  });
});
