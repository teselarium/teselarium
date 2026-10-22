import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

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
