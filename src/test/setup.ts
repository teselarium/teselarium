import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import {
  buildFakeMatchMedia,
  createFakeHoverDevice,
} from "./fake_hover_queries.ts";

// Vitest globals are off, so Testing Library cannot register its own cleanup.
afterEach(cleanup);

function showDialog(this: HTMLDialogElement): void {
  this.open = true;
}

function closeDialog(this: HTMLDialogElement): void {
  this.open = false;
}

// jsdom has no modal dialogs: `showModal` and `close` only set `open` here.
// The top layer and the inert page are checked in Playwright.
HTMLDialogElement.prototype.showModal ??= showDialog;
HTMLDialogElement.prototype.close ??= closeDialog;

/** jsdom lays nothing out, so nothing is ever resized. */
class NoLayoutResizeObserver implements ResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

// Radix places tooltips with a ResizeObserver, which jsdom lacks. Placement
// is checked in Playwright.
globalThis.ResizeObserver ??= NoLayoutResizeObserver;

function capturePointer(this: Element): void {
  // jsdom has no pointer capture: events are fired on the element directly.
}

// The sidebar's resize handle captures the pointer. Capture is checked in Playwright.
Element.prototype.setPointerCapture ??= capturePointer;
Element.prototype.releasePointerCapture ??= capturePointer;

function scrollNowhere(): void {
  // jsdom lays nothing out, so there is nothing to scroll.
}

// cmdk scrolls the selected entry of a list into view. Scrolling is checked in Playwright.
Element.prototype.scrollIntoView ??= scrollNowhere;

// jsdom has no `matchMedia`. The app's tests run as on a desktop, whose
// primary pointer can hover, so tooltips open as there. A test of a touch
// device stubs its own (fake_hover_queries.ts).
window.matchMedia ??= buildFakeMatchMedia(createFakeHoverDevice(true));
