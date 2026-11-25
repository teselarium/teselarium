import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { testTexts } from "../../test/test_files.ts";
import { SAMPLE_MOSAIC_SOURCE } from "../../test/sample_mods.ts";
import {
  buildDialogFixture,
  buildPickedFile,
  pickWithInput,
  renderCatalogDialog,
  SHOWN_ID,
  writeTestMosaic,
} from "../../test/user_catalog_dialogs.tsx";
import type { DialogFixture } from "../../test/user_catalog_dialogs.tsx";
import type { UserCatalogEntry } from "../../lib/user_catalog/index.ts";
import { readUserCatalogSnapshot } from "./user_catalog_store.ts";

const NOBEL_TEXT = writeTestMosaic("Nobel map", "https://tiles.example.net/a/");
const CHANGED_TEXT = writeTestMosaic(
  "Nobel map 2",
  "https://tiles.example.net/a/",
);
const REMOTE_ADDRESS = "https://mosaics.example.net/maps/laureates.yml";

const STORED_ENTRY: UserCatalogEntry = {
  address: "teselarium-browser:///r1/maps/nobel_map.yaml",
  place: "browser",
  root: "r1",
  provenance: {
    folder: "my-mosaics",
    path: "maps/nobel_map.yaml",
    addedAt: "2026-11-20T10:00:00.000Z",
    updatedAt: null,
    changedSinceExport: false,
    copiedFrom: null,
  },
  syncedAt: "2026-11-20T10:00:00.000Z",
};

const REMOTE_ENTRY: UserCatalogEntry = {
  address: REMOTE_ADDRESS,
  place: "remote",
  root: null,
  provenance: {
    folder: null,
    path: null,
    addedAt: "2026-11-20T11:00:00.000Z",
    updatedAt: null,
    changedSinceExport: false,
    copiedFrom: null,
  },
  syncedAt: null,
};

function buildStoredFixture(): Promise<DialogFixture> {
  return buildDialogFixture(
    [STORED_ENTRY, REMOTE_ENTRY],
    new Map([[STORED_ENTRY.address, NOBEL_TEXT]]),
  );
}

function typeAddress(address: string): void {
  fireEvent.change(screen.getByLabelText("Mosaic address"), {
    target: { value: address },
  });
}

afterEach(function clearTexts(): void {
  testTexts.clear();
});

describe("UpdateDialog", function describeUpdateDialog(): void {
  it("Update from a file", async function updatesFromFile(): Promise<void> {
    const fixture = await buildStoredFixture();
    renderCatalogDialog(fixture, {
      kind: "catalogUpdate",
      address: STORED_ENTRY.address,
    });
    expect(
      screen.getByRole("heading", { name: "Update a mosaic" }),
    ).toBeInTheDocument();

    pickWithInput("Mosaic file", [
      buildPickedFile("nobel_map (2).yaml", CHANGED_TEXT),
    ]);
    const list = await screen.findByRole("list", { name: "Picked files" });
    expect(within(list).getByText("Changed")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Update" }));

    await waitFor(function answered(): void {
      expect(fixture.onAnswer).toHaveBeenCalledExactlyOnceWith(SHOWN_ID, true);
    });
    expect(await fixture.database.readText(STORED_ENTRY.address)).toBe(
      CHANGED_TEXT,
    );
    const [entry] = readUserCatalogSnapshot(fixture.store).entries;
    expect(entry.address).toBe(STORED_ENTRY.address);
    expect(entry.provenance.addedAt).toBe(STORED_ENTRY.provenance.addedAt);
    expect(entry.provenance.updatedAt).not.toBeNull();
  });

  it("Unchanged file", async function disablesUnchanged(): Promise<void> {
    const fixture = await buildStoredFixture();
    renderCatalogDialog(fixture, {
      kind: "catalogUpdate",
      address: STORED_ENTRY.address,
    });

    pickWithInput("Mosaic file", [buildPickedFile("copy.yaml", NOBEL_TEXT)]);
    const list = await screen.findByRole("list", { name: "Picked files" });

    expect(within(list).getByText("Unchanged")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Update" })).toBeDisabled();
  });
});

describe("UpdateDialog over local edits", function describeUpdateOverEdits(): void {
  it("Update over local edits", async function warnsAboutLocalEdits(): Promise<void> {
    const edited: UserCatalogEntry = {
      ...STORED_ENTRY,
      provenance: { ...STORED_ENTRY.provenance, changedSinceExport: true },
    };
    const fixture = await buildDialogFixture(
      [edited],
      new Map([[STORED_ENTRY.address, NOBEL_TEXT]]),
    );
    renderCatalogDialog(fixture, {
      kind: "catalogUpdate",
      address: STORED_ENTRY.address,
    });

    pickWithInput("Mosaic file", [
      buildPickedFile("nobel_map (2).yaml", CHANGED_TEXT),
    ]);
    await screen.findByRole("list", { name: "Picked files" });

    expect(
      screen.getByText(
        "The changes made here since the last export are replaced. They stay in the history.",
      ),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Update" }));
    await waitFor(function answered(): void {
      expect(fixture.onAnswer).toHaveBeenCalledExactlyOnceWith(SHOWN_ID, true);
    });
    const versions = await fixture.database.readVersions(STORED_ENTRY.address);
    expect(versions[1].text).toBe(NOBEL_TEXT);
  });
});

describe("AddMosaicDialog", function describeAddMosaicDialog(): void {
  it("Added", async function addsRemoteMosaic(): Promise<void> {
    testTexts.set(
      REMOTE_ADDRESS,
      writeTestMosaic("Laureates", "https://a.example/"),
    );
    const fixture = await buildDialogFixture();
    renderCatalogDialog(fixture, { kind: "catalogAdd", suggested: null });
    expect(
      screen.getByRole("heading", { name: "Add a mosaic" }),
    ).toBeInTheDocument();

    typeAddress(REMOTE_ADDRESS);
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(function answered(): void {
      expect(fixture.onAnswer).toHaveBeenCalledExactlyOnceWith(SHOWN_ID, true);
    });
    expect(readUserCatalogSnapshot(fixture.store).entries).toEqual([
      expect.objectContaining({
        address: REMOTE_ADDRESS,
        place: "remote",
        provenance: expect.objectContaining({ folder: null, path: null }),
      }),
    ]);
  });

  it("Add with a suggested address", async function fillsSuggestion(): Promise<void> {
    const fixture = await buildDialogFixture();
    renderCatalogDialog(fixture, {
      kind: "catalogAdd",
      suggested: REMOTE_ADDRESS,
    });

    expect(screen.getByLabelText("Mosaic address")).toHaveValue(REMOTE_ADDRESS);
    expect(readUserCatalogSnapshot(fixture.store).entries).toEqual([]);
  });

  it("Already listed", async function refusesListed(): Promise<void> {
    const fixture = await buildDialogFixture();
    renderCatalogDialog(fixture, { kind: "catalogAdd", suggested: null });

    typeAddress(SAMPLE_MOSAIC_SOURCE);
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The catalog already lists this mosaic.",
    );
    expect(readUserCatalogSnapshot(fixture.store).entries).toEqual([]);
    expect(fixture.onAnswer).not.toHaveBeenCalled();
  });

  it("Missing file", async function showsNotFound(): Promise<void> {
    const fixture = await buildDialogFixture();
    renderCatalogDialog(fixture, { kind: "catalogAdd", suggested: null });

    typeAddress(REMOTE_ADDRESS);
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(REMOTE_ADDRESS);
    expect(alert).toHaveTextContent("404");
    expect(readUserCatalogSnapshot(fixture.store).entries).toEqual([]);
  });

  it("Wrong scheme", async function refusesScheme(): Promise<void> {
    const fixture = await buildDialogFixture();
    renderCatalogDialog(fixture, { kind: "catalogAdd", suggested: null });

    typeAddress("ftp://mosaics.example.net/maps/laureates.yml");
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The address must start with http:// or https://.",
    );
  });
});

describe("RemoveMosaicDialog", function describeRemoveMosaicDialog(): void {
  it("Stored entry removed", async function removesStored(): Promise<void> {
    const fixture = await buildStoredFixture();
    const dialog = renderCatalogDialog(fixture, {
      kind: "catalogRemove",
      address: STORED_ENTRY.address,
    });

    await waitFor(function namesTitle(): void {
      expect(dialog).toHaveTextContent(
        'Remove "Nobel map" from your catalog? Its file is deleted from this browser.',
      );
    });
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));

    await waitFor(function answered(): void {
      expect(fixture.onAnswer).toHaveBeenCalledExactlyOnceWith(SHOWN_ID, true);
    });
    expect(readUserCatalogSnapshot(fixture.store).entries).toEqual([
      REMOTE_ENTRY,
    ]);
    expect(await fixture.database.readText(STORED_ENTRY.address)).toBeNull();
  });

  it("says that a remote mosaic stays on its site", async function namesRemote(): Promise<void> {
    testTexts.set(
      REMOTE_ADDRESS,
      writeTestMosaic("Laureates", "https://a.example/"),
    );
    const fixture = await buildStoredFixture();
    const dialog = renderCatalogDialog(fixture, {
      kind: "catalogRemove",
      address: REMOTE_ADDRESS,
    });

    await waitFor(function namesTitle(): void {
      expect(dialog).toHaveTextContent(
        'Remove "Laureates" from your catalog? The mosaic stays on its site.',
      );
    });
  });

  it("Cancelled", async function keepsEntry(): Promise<void> {
    const fixture = await buildStoredFixture();
    renderCatalogDialog(fixture, {
      kind: "catalogRemove",
      address: STORED_ENTRY.address,
    });

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(fixture.onAnswer).toHaveBeenCalledExactlyOnceWith(SHOWN_ID, false);
    expect(readUserCatalogSnapshot(fixture.store).entries).toHaveLength(2);
  });
});

describe("ExportMosaicDialog", function describeExportMosaicDialog(): void {
  beforeEach(function stubDownloads(): void {
    URL.createObjectURL = vi
      .fn<(blob: Blob) => string>()
      .mockReturnValue("blob:https://example.org/1");
    URL.revokeObjectURL = vi.fn<(url: string) => void>();
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockReturnValue(undefined);
  });

  afterEach(function restoreDownloads(): void {
    vi.restoreAllMocks();
  });

  it("Exported", async function exportsStoredFile(): Promise<void> {
    const fixture = await buildStoredFixture();
    renderCatalogDialog(fixture, {
      kind: "catalogExport",
      address: STORED_ENTRY.address,
    });

    const saveButton = await screen.findByRole("button", { name: "Save" });
    expect(document.querySelector("dialog")).toHaveTextContent(
      "wants to save a file:nobel_map.yaml",
    );
    fireEvent.click(saveButton);

    await waitFor(function answered(): void {
      expect(fixture.onAnswer).toHaveBeenCalledExactlyOnceWith(SHOWN_ID, true);
    });
    const blob = vi.mocked(URL.createObjectURL).mock.calls[0][0] as Blob;
    expect(blob.type).toBe("application/yaml");
    expect(await blob.text()).toBe(NOBEL_TEXT);
  });

  it("Saved, then exported", async function syncsExportedEntry(): Promise<void> {
    const edited: UserCatalogEntry = {
      ...STORED_ENTRY,
      provenance: { ...STORED_ENTRY.provenance, changedSinceExport: true },
    };
    const fixture = await buildDialogFixture(
      [edited],
      new Map([[STORED_ENTRY.address, NOBEL_TEXT]]),
    );
    renderCatalogDialog(fixture, {
      kind: "catalogExport",
      address: STORED_ENTRY.address,
    });

    fireEvent.click(await screen.findByRole("button", { name: "Save" }));

    await waitFor(function answered(): void {
      expect(fixture.onAnswer).toHaveBeenCalledExactlyOnceWith(SHOWN_ID, true);
    });
    const [entry] = readUserCatalogSnapshot(fixture.store).entries;
    expect(entry.provenance.changedSinceExport).toBe(false);
    expect(entry.syncedAt).toBe(STORED_ENTRY.syncedAt);
  });
});
