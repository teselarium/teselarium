import { useLayoutEffect, useState } from "react";
import type { RefObject } from "react";

/** Under this content width, in CSS pixels, the stage bar is always narrow. */
export const NARROW_STAGE_BAR_WIDTH = 480;

/**
 * Whether the bar is narrow, and, when it folded because its capsules did
 * not fit, the bar's content width at that moment: it stays narrow until it
 * is wider. While narrow, the capsule row is hidden and cannot be measured.
 */
export interface BarFold {
  isNarrow: boolean;
  /** The content width at which the capsules did not fit, or `null`. */
  foldedAt: number | null;
}

/**
 * Under this content width, in CSS pixels, the bar is narrower than on a
 * 360px wide viewport (288px, minus its 24px of padding and 2px of border):
 * the edit button moves into "More actions".
 */
export const PHONE_STAGE_BAR_WIDTH = 262;

/** The bar's form: narrow or wide, and whether it is narrower than on a phone. */
export interface StageBarForm {
  isNarrow: boolean;
  isUnderPhoneWidth: boolean;
}

/**
 * What the bar measured: its content width, whether its left side
 * overflows, and whether the sidebar gave room for it.
 */
export interface BarMeasure {
  width: number;
  /** Only meaningful while the bar is wide: its capsules at their minimum do not fit. */
  leftSideOverflows: boolean;
  /** The sidebar stepped aside: the bar stays wide and is measured again once wider. */
  roomGiven: boolean;
}

export const WIDE_BAR: BarFold = Object.freeze({
  isNarrow: false,
  foldedAt: null,
});

/**
 * The bar's fold after a measure: narrow under 480px; narrow while it is no
 * wider than where its capsules did not fit; narrow when, wide, its left
 * side overflows and the sidebar gave no room, recording that width; wide
 * otherwise.
 */
export function followBarFold(fold: BarFold, measure: BarMeasure): BarFold {
  if (fold.foldedAt !== null && measure.width <= fold.foldedAt) {
    return fold;
  }
  if (measure.width < NARROW_STAGE_BAR_WIDTH) {
    const narrow: BarFold = { isNarrow: true, foldedAt: null };
    return narrow;
  }
  if (!fold.isNarrow && measure.leftSideOverflows && !measure.roomGiven) {
    const folded: BarFold = { isNarrow: true, foldedAt: measure.width };
    return folded;
  }
  return WIDE_BAR;
}

/** Keeps `fold` itself when the next one says the same, so React skips the render. */
function keepSameFold(fold: BarFold, next: BarFold): BarFold {
  const isSame =
    fold.isNarrow === next.isNarrow && fold.foldedAt === next.foldedAt;
  return isSame ? fold : next;
}

/**
 * The width of an observed content box. The container queries of the bar's
 * other steps compare the same box.
 */
function readContentWidth(entry: ResizeObserverEntry): number {
  const size = entry.contentBoxSize[0];
  return size === undefined ? entry.contentRect.width : size.inlineSize;
}

function followBarWidth(
  setWidth: (width: number) => void,
  entries: ResizeObserverEntry[],
): void {
  const entry = entries[entries.length - 1];
  if (entry !== undefined) {
    setWidth(readContentWidth(entry));
  }
}

/** Whether the element's content is wider than its box. */
function overflowsSideways(element: Element | null): boolean {
  return element !== null && element.scrollWidth > element.clientWidth;
}

/**
 * Whether the capsules do not fit: the left side overflows, or the capsule
 * row in it (`data-capsule-row`) does. The row shrinks with the left side,
 * so its capsules at their minimum can overflow it, under the items after
 * it, without the left side overflowing.
 */
function capsulesOverflow(leftSide: HTMLElement | null): boolean {
  if (leftSide === null) {
    return false;
  }
  const capsuleRow = leftSide.querySelector("[data-capsule-row]");
  return overflowsSideways(leftSide) || overflowsSideways(capsuleRow);
}

/**
 * Before the capsules of a wide bar of 480px or more fold because they do
 * not fit, the bar asks the sidebar for room. Returns its answer.
 */
function askRoomBeforeFold(
  width: number,
  leftSideOverflows: boolean,
  onAskRoom: () => boolean,
): boolean {
  if (!leftSideOverflows || width < NARROW_STAGE_BAR_WIDTH) {
    return false;
  }
  return onAskRoom();
}

interface FoldFollowing {
  contentKey: string;
  fold: BarFold;
}

/**
 * Whether the stage bar in `barRef` is narrow: under 480px of content
 * width, or, wider, when its left side in `leftSideRef`, or the capsule row
 * in it, overflows because its capsules at their minimum width do not fit. It then stays narrow until
 * the bar is wider than where it folded. A new `contentKey`, which names what
 * the bar holds besides its titles, drops that width, so the bar is measured
 * again. Before folding because its capsules do not fit, it calls
 * `onAskRoom`: when the sidebar makes room, the bar stays wide, and folds
 * only if its capsules still do not fit once wider. It also says whether the
 * bar is under 262px of content width, narrower than on a 360px viewport.
 * The observer, the layout effect and the sidebar's answer run before the
 * paint, so a bar is never drawn in the wrong form.
 */
export function useNarrowStageBar(
  barRef: RefObject<HTMLElement | null>,
  leftSideRef: RefObject<HTMLElement | null>,
  contentKey: string,
  onAskRoom: () => boolean,
): StageBarForm {
  const [width, setWidth] = useState<number | null>(null);
  const [following, setFollowing] = useState<FoldFollowing>({
    contentKey,
    fold: WIDE_BAR,
  });
  // New content drops the fold, while rendering, React's way of adjusting state to new props.
  if (following.contentKey !== contentKey) {
    setFollowing({ contentKey, fold: WIDE_BAR });
  }
  const fold = following.fold;

  useLayoutEffect(
    function observeBarWidth(): (() => void) | undefined {
      const bar = barRef.current;
      if (bar === null) {
        return undefined;
      }
      const observer = new ResizeObserver(
        followBarWidth.bind(undefined, setWidth),
      );
      observer.observe(bar);
      return observer.disconnect.bind(observer);
    },
    [barRef],
  );

  useLayoutEffect(
    function measureFold(): void {
      if (width === null) {
        return;
      }
      const leftSideOverflows =
        !fold.isNarrow && capsulesOverflow(leftSideRef.current);
      const measure: BarMeasure = {
        width,
        leftSideOverflows,
        roomGiven: askRoomBeforeFold(width, leftSideOverflows, onAskRoom),
      };
      const next = keepSameFold(fold, followBarFold(fold, measure));
      if (next !== fold) {
        setFollowing({ contentKey, fold: next });
      }
    },
    [width, fold, contentKey, leftSideRef, onAskRoom],
  );

  const form: StageBarForm = {
    isNarrow: fold.isNarrow,
    isUnderPhoneWidth: width !== null && width < PHONE_STAGE_BAR_WIDTH,
  };
  return form;
}
