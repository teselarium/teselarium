import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  buildDialogFixture,
  buildPickedFile,
  pickWithInput,
  pressEscape,
  renderCatalogDialog,
  SHOWN_ID,
  writeTestMosaic,
} from "../../test/user_catalog_dialogs.tsx";
import type { UserCatalogEntry } from "../../lib/user_catalog/index.ts";
import { readUserCatalogSnapshot } from "./user_catalog_store.ts";

const IMPORT = { kind: "catalogImport" } as const;
const NOBEL_TEXT = writeTestMosaic("Nobel map", "https://tiles.example.net/a/");
const POETS_TEXT = writeTestMosaic("Poets", "https://tiles.example.net/b/");

const STORED_NOBEL: UserCatalogEntry = {
  address: "opentesela-browser:///r1/nobel_map.yaml",
  place: "browser",
  root: "r1",
  provenance: {
    folder: "my-mosaics",
    path: "nobel_map.yaml",
    addedAt: "2026-11-20T10:00:00.000Z",
    updatedAt: null,
  },
};

function findReviewRow(path: string): HTMLElement {
  const list = screen.getByRole("list", { name: "Picked files" });
  for (const item of within(list).getAllByRole("listitem")) {
    if (item.querySelector("code")?.textContent === path) {
      return item;
    }
  }
  throw new Error(`Expected a review row for "${path}"`);
}

async function waitForReview(): Promise<void> {
  await screen.findByRole("list", { name: "Picked files" });
}

function readImportButton(): HTMLButtonElement {
  return screen.getByRole("button", { name: "Import" });
}

describe("ImportDialog", function describeImportDialog(): void {
  it("shows the pickers and the drop zone", async function showsPickers(): Promise<void> {
    const fixture = await buildDialogFixture();

    const dialog = renderCatalogDialog(fixture, IMPORT);

    expect(dialog.open).toBe(true);
    expect(
      screen.getByRole("heading", { name: "Import mosaics" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Choose files…" })).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "Choose folder…" }),
    ).toBeEnabled();
    expect(dialog.querySelector("[data-drop-zone]")).not.toBeNull();
    expect(readImportButton()).toBeDisabled();
  });

  it("Folder with other files", async function picksFolder(): Promise<void> {
    const fixture = await buildDialogFixture();
    renderCatalogDialog(fixture, IMPORT);

    pickWithInput("Mosaic folder", [
      buildPickedFile(
        "nobel_map.yaml",
        NOBEL_TEXT,
        "my-mosaics/nobel_map.yaml",
      ),
      buildPickedFile("notes.md", "# Notes", "my-mosaics/notes.md"),
      buildPickedFile("a.md", "# A", "my-mosaics/tiles/a.md"),
    ]);
    await waitForReview();

    const list = screen.getByRole("list", { name: "Picked files" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(1);
    expect(findReviewRow("nobel_map.yaml")).toHaveTextContent("New");
    expect(screen.getByText("2 other files were ignored.")).toBeInTheDocument();
  });

  it("Picked again after a change", async function showsStatuses(): Promise<void> {
    const fixture = await buildDialogFixture(
      [STORED_NOBEL],
      new Map([[STORED_NOBEL.address, NOBEL_TEXT]]),
    );
    renderCatalogDialog(fixture, IMPORT);

    pickWithInput("Mosaic folder", [
      buildPickedFile(
        "nobel_map.yaml",
        POETS_TEXT,
        "my-mosaics/nobel_map.yaml",
      ),
      buildPickedFile("poets.yaml", POETS_TEXT, "my-mosaics/poets.yaml"),
      buildPickedFile("broken.yaml", "mosaic: {}\n", "my-mosaics/broken.yaml"),
    ]);
    await waitForReview();

    const changed = findReviewRow("nobel_map.yaml");
    const added = findReviewRow("poets.yaml");
    const broken = findReviewRow("broken.yaml");
    expect(within(changed).getByText("Changed")).toHaveAttribute(
      "data-variant",
      "warning",
    );
    expect(within(added).getByText("New")).toHaveAttribute(
      "data-variant",
      "success",
    );
    expect(within(broken).getByText("Not a mosaic")).toHaveAttribute(
      "data-variant",
      "destructive",
    );
    expect(broken).toHaveTextContent('"title" must be a non-empty string');
    expect(within(broken).getByRole("checkbox")).toBeDisabled();
    expect(within(changed).getByRole("checkbox")).toBeChecked();
  });

  it("File deleted from the folder", async function showsMissing(): Promise<void> {
    const fixture = await buildDialogFixture(
      [STORED_NOBEL],
      new Map([[STORED_NOBEL.address, NOBEL_TEXT]]),
    );
    renderCatalogDialog(fixture, IMPORT);

    pickWithInput("Mosaic folder", [
      buildPickedFile("poets.yaml", POETS_TEXT, "my-mosaics/poets.yaml"),
    ]);
    await waitForReview();

    const missing = findReviewRow("nobel_map.yaml");
    expect(within(missing).getByText("Not in the folder")).toHaveAttribute(
      "data-variant",
      "outline",
    );
    expect(within(missing).getByRole("checkbox")).not.toBeChecked();
  });

  it("disables Import with nothing checked", async function disablesImport(): Promise<void> {
    const fixture = await buildDialogFixture();
    renderCatalogDialog(fixture, IMPORT);
    pickWithInput("Mosaic files", [
      buildPickedFile("nobel_map.yaml", NOBEL_TEXT),
    ]);
    await waitForReview();
    expect(readImportButton()).toBeEnabled();

    fireEvent.click(
      screen.getByRole("checkbox", { name: "Import nobel_map.yaml" }),
    );

    expect(readImportButton()).toBeDisabled();
  });

  it("Applied", async function appliesImport(): Promise<void> {
    const fixture = await buildDialogFixture();
    renderCatalogDialog(fixture, IMPORT);
    pickWithInput("Mosaic files", [
      buildPickedFile("nobel_map.yaml", NOBEL_TEXT),
      buildPickedFile("poets.yaml", POETS_TEXT),
    ]);
    await waitForReview();

    fireEvent.click(readImportButton());

    await waitFor(function answered(): void {
      expect(fixture.onAnswer).toHaveBeenCalledExactlyOnceWith(SHOWN_ID, true);
    });
    const entries = readUserCatalogSnapshot(fixture.store).entries;
    expect(entries).toHaveLength(2);
    expect(entries[0].provenance).toMatchObject({
      folder: null,
      path: "nobel_map.yaml",
    });
    expect(await fixture.database.readText(entries[0].address)).toBe(
      NOBEL_TEXT,
    );
  });

  it("Cancelled", async function answersCancel(): Promise<void> {
    const fixture = await buildDialogFixture();
    renderCatalogDialog(fixture, IMPORT);

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(fixture.onAnswer).toHaveBeenCalledExactlyOnceWith(SHOWN_ID, false);
    expect(readUserCatalogSnapshot(fixture.store).entries).toEqual([]);
  });

  it("Escape answers false", async function answersEscape(): Promise<void> {
    const fixture = await buildDialogFixture();
    const dialog = renderCatalogDialog(fixture, IMPORT);

    const cancelEvent = pressEscape(dialog);

    expect(fixture.onAnswer).toHaveBeenCalledExactlyOnceWith(SHOWN_ID, false);
    expect(cancelEvent.defaultPrevented).toBe(true);
  });

  it("Store refused", async function showsRefusedStore(): Promise<void> {
    const fixture = await buildDialogFixture([], new Map(), null);
    renderCatalogDialog(fixture, IMPORT);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "This browser does not let the app store files",
    );
    expect(
      screen.getByRole("button", { name: "Choose files…" }),
    ).toBeDisabled();
    expect(readImportButton()).toBeDisabled();
  });
});
