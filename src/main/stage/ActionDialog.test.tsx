import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import type { ActionSnapshot, AppAction } from "../../lib/core/stage/index.ts";
import { ActionDialog } from "./ActionDialog.tsx";

const MOD = {
  title: "Book List",
  source: "https://example.org/samples/mods/book_list/mod_conf.yaml",
};

let onAnswer: Mock<(id: number, accepted: boolean) => void>;
let openSpy: Mock<typeof window.open>;
let createObjectUrlSpy: Mock<(blob: Blob) => string>;

beforeEach(function stubEffects(): void {
  onAnswer = vi.fn<(id: number, accepted: boolean) => void>();
  openSpy = vi.fn<typeof window.open>();
  openSpy.mockReturnValue(null);
  vi.spyOn(window, "open").mockImplementation(openSpy);
  createObjectUrlSpy = vi.fn<(blob: Blob) => string>();
  createObjectUrlSpy.mockReturnValue("blob:https://example.org/1");
  // jsdom has no object URLs, and following a link would log "not implemented".
  URL.createObjectURL = createObjectUrlSpy;
  URL.revokeObjectURL = vi.fn<(url: string) => void>();
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockReturnValue(undefined);
});

afterEach(function restoreEffects(): void {
  vi.restoreAllMocks();
});

function buildShown(action: AppAction, id: number = 3): ActionSnapshot {
  const shown: ActionSnapshot = { id, mod: MOD, action };
  return shown;
}

function buildConfirm(
  message: string,
  confirmLabel: string = "OK",
): ActionSnapshot {
  return buildShown({
    kind: "confirm",
    message,
    confirmLabel,
    cancelLabel: "Cancel",
  });
}

function renderDialog(shown: ActionSnapshot | null): HTMLDialogElement {
  render(<ActionDialog shown={shown} onAnswer={onAnswer} />);
  const dialog = document.querySelector("dialog");
  if (dialog === null) {
    throw new Error("Expected a dialog element");
  }
  return dialog;
}

describe("ActionDialog", function describeActionDialog(): void {
  it("stays closed without an action", function staysClosed(): void {
    const dialog = renderDialog(null);

    expect(dialog.open).toBe(false);
  });

  it("names the mod by its title and source", function namesMod(): void {
    const dialog = renderDialog(buildConfirm("Delete this list?"));

    expect(dialog.open).toBe(true);
    expect(
      screen.getByRole("heading", { name: "Book List" }),
    ).toBeInTheDocument();
    expect(dialog).toHaveTextContent(MOD.source);
  });

  it("shows a link with Open and Cancel", function showsLink(): void {
    const dialog = renderDialog(
      buildShown({ kind: "link", url: "https://example.org/books?id=1" }),
    );

    expect(dialog).toHaveTextContent(
      "wants to open this address in a new tab:",
    );
    expect(dialog).toHaveTextContent("https://example.org/books?id=1");
    expect(screen.getByRole("button", { name: "Open" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  it("shows a save with its name, size, Save and Cancel", function showsSave(): void {
    const dialog = renderDialog(
      buildShown({
        kind: "save",
        name: "books.csv",
        type: "text/csv",
        bytes: new Uint8Array(2048),
      }),
    );

    expect(dialog).toHaveTextContent("wants to save a file:");
    expect(dialog).toHaveTextContent("books.csv");
    expect(dialog).toHaveTextContent("2 KB");
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  it("shows a confirmation with its labels", function showsConfirm(): void {
    const dialog = renderDialog(buildConfirm("Delete this list?", "Delete"));

    expect(dialog).toHaveTextContent("asks:");
    expect(dialog).toHaveTextContent("Delete this list?");
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  it("Message is plain text", function showsPlainText(): void {
    const dialog = renderDialog(buildConfirm("<b>Delete</b>?"));

    expect(screen.getByText("<b>Delete</b>?")).toBeInTheDocument();
    expect(dialog.querySelector("b")).toBeNull();
  });

  it("focuses Cancel, so Enter does not accept", function focusesCancel(): void {
    renderDialog(buildConfirm("Delete this list?", "Delete"));

    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
  });

  it("Escape answers false", function answersEscape(): void {
    const dialog = renderDialog(buildConfirm("Delete this list?"));

    const cancelEvent = new Event("cancel", { cancelable: true });
    fireEvent(dialog, cancelEvent);

    expect(onAnswer).toHaveBeenCalledExactlyOnceWith(3, false);
    expect(cancelEvent.defaultPrevented).toBe(true);
  });

  it("opens again when the browser closes it while an action is shown", function reopens(): void {
    const dialog = renderDialog(buildConfirm("Delete this list?"));

    dialog.close();
    fireEvent(dialog, new Event("close"));

    expect(dialog.open).toBe(true);
    expect(onAnswer).not.toHaveBeenCalled();
  });

  it("Cancel answers false and performs nothing", function answersCancel(): void {
    renderDialog(
      buildShown({ kind: "link", url: "https://example.org/books?id=1" }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onAnswer).toHaveBeenCalledExactlyOnceWith(3, false);
    expect(openSpy).not.toHaveBeenCalled();
  });

  it("opens the link before answering true", function opensBeforeAnswer(): void {
    renderDialog(
      buildShown({ kind: "link", url: "https://example.org/books?id=1" }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Open" }));

    expect(openSpy).toHaveBeenCalledExactlyOnceWith(
      "https://example.org/books?id=1",
      "_blank",
      "noopener,noreferrer",
    );
    expect(onAnswer).toHaveBeenCalledExactlyOnceWith(3, true);
    expect(openSpy.mock.invocationCallOrder[0]).toBeLessThan(
      onAnswer.mock.invocationCallOrder[0],
    );
  });

  it("downloads the file before answering true", function savesBeforeAnswer(): void {
    renderDialog(
      buildShown({
        kind: "save",
        name: "books.csv",
        type: "text/csv",
        bytes: new Uint8Array(4),
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(createObjectUrlSpy).toHaveBeenCalledOnce();
    expect(onAnswer).toHaveBeenCalledExactlyOnceWith(3, true);
    expect(createObjectUrlSpy.mock.invocationCallOrder[0]).toBeLessThan(
      onAnswer.mock.invocationCallOrder[0],
    );
  });

  it("answers true for a confirmation", function answersConfirm(): void {
    renderDialog(buildConfirm("Delete this list?", "Delete"));

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect(onAnswer).toHaveBeenCalledExactlyOnceWith(3, true);
  });

  it("closes when the action is gone", function closesWhenGone(): void {
    const { rerender } = render(
      <ActionDialog
        shown={buildConfirm("Delete this list?")}
        onAnswer={onAnswer}
      />,
    );

    rerender(<ActionDialog shown={null} onAnswer={onAnswer} />);

    expect(document.querySelector("dialog")?.open).toBe(false);
  });
});
