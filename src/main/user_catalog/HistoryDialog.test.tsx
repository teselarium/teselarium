import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { strFromU8, unzipSync } from "fflate";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SAMPLE_MOD_SOURCE } from "../../test/sample_mods.ts";
import {
  buildDialogFixture,
  renderCatalogDialog,
  SHOWN_ID,
} from "../../test/user_catalog_dialogs.tsx";
import type { DialogFixture } from "../../test/user_catalog_dialogs.tsx";
import type { UserCatalogEntry } from "../../lib/user_catalog/index.ts";
import { readUserCatalogSnapshot } from "./user_catalog_store.ts";

const ADDRESS = "teselarium-browser:///r1/maps/nobel_map.yaml";
const IMPORT_TIME = "2026-11-20T10:00:00.000Z";
const SAVE_TIME = "2026-11-21T10:00:00.000Z";

function writeDraft(title: string): string {
  const draft = `mosaic:\n  title: "${title}"\n  mod: "${SAMPLE_MOD_SOURCE}"\n`;
  return draft;
}

const IMPORTED_TEXT = writeDraft("Nobel map");
const EDITED_TEXT = writeDraft("Nobel map, mine");

const ENTRY: UserCatalogEntry = {
  address: ADDRESS,
  place: "browser",
  root: "r1",
  provenance: {
    folder: "my-mosaics",
    path: "maps/nobel_map.yaml",
    addedAt: IMPORT_TIME,
    updatedAt: SAVE_TIME,
    changedSinceExport: true,
    copiedFrom: null,
  },
  syncedAt: IMPORT_TIME,
};

/** A stored mosaic imported, then saved with an edit. */
async function buildEditedFixture(): Promise<DialogFixture> {
  const fixture = await buildDialogFixture(
    [ENTRY],
    new Map([[ADDRESS, IMPORTED_TEXT]]),
  );
  await fixture.database.apply({
    putFiles: [{ address: ADDRESS, text: EDITED_TEXT }],
    putEntries: [],
    putVersions: [
      {
        address: ADDRESS,
        savedAt: SAVE_TIME,
        kind: "saved",
        text: EDITED_TEXT,
      },
    ],
    deleteAddresses: [],
  });
  return fixture;
}

function readVersionKinds(list: HTMLElement): string[] {
  const kinds: string[] = [];
  for (const item of within(list).getAllByRole("listitem")) {
    kinds.push(item.getAttribute("data-version-kind") ?? "");
  }
  return kinds;
}

describe("HistoryDialog", function describeHistoryDialog(): void {
  it("lists the versions newest first, with their kind", async function listsVersions(): Promise<void> {
    const fixture = await buildEditedFixture();
    renderCatalogDialog(fixture, { kind: "catalogHistory", address: ADDRESS });

    const list = await screen.findByRole("list", { name: "Versions" });

    expect(
      await screen.findByRole("heading", {
        name: "History of Nobel map, mine",
      }),
    ).toBeInTheDocument();
    expect(readVersionKinds(list)).toEqual(["saved", "imported"]);
    const [current, imported] = within(list).getAllByRole("listitem");
    expect(current).toHaveTextContent("Saved");
    expect(current).toHaveTextContent("Current");
    expect(within(current).queryByRole("button")).toBeNull();
    expect(imported).toHaveTextContent("Imported");
    expect(within(imported).getByRole("button")).toHaveTextContent("Restore");
  });

  it("Restore the imported text", async function restoresImported(): Promise<void> {
    const fixture = await buildEditedFixture();
    renderCatalogDialog(fixture, { kind: "catalogHistory", address: ADDRESS });
    const list = await screen.findByRole("list", { name: "Versions" });
    const imported = within(list).getAllByRole("listitem")[1];

    fireEvent.click(within(imported).getByRole("button", { name: /Restore/ }));
    expect(
      await screen.findByRole("heading", { name: "Save mosaic" }),
    ).toBeInTheDocument();
    await screen.findByRole("list", { name: "Changes" });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(function answered(): void {
      expect(fixture.onAnswer).toHaveBeenCalledExactlyOnceWith(SHOWN_ID, true);
    });
    expect(await fixture.database.readText(ADDRESS)).toBe(IMPORTED_TEXT);
    const versions = await fixture.database.readVersions(ADDRESS);
    expect(versions[0].kind).toBe("restored");
    const [entry] = readUserCatalogSnapshot(fixture.store).entries;
    expect(entry.provenance.changedSinceExport).toBe(false);
  });

  it("comes back to the list when the restore is cancelled", async function cancelsRestore(): Promise<void> {
    const fixture = await buildEditedFixture();
    renderCatalogDialog(fixture, { kind: "catalogHistory", address: ADDRESS });
    const list = await screen.findByRole("list", { name: "Versions" });

    fireEvent.click(
      within(within(list).getAllByRole("listitem")[1]).getByRole("button"),
    );
    await screen.findByRole("list", { name: "Changes" });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(
      await screen.findByRole("list", { name: "Versions" }),
    ).toBeInTheDocument();
    expect(fixture.onAnswer).not.toHaveBeenCalled();
  });

  it("answers false on Close", async function closes(): Promise<void> {
    const fixture = await buildEditedFixture();
    renderCatalogDialog(fixture, { kind: "catalogHistory", address: ADDRESS });
    await screen.findByRole("list", { name: "Versions" });

    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    expect(fixture.onAnswer).toHaveBeenCalledExactlyOnceWith(SHOWN_ID, false);
  });
});

describe("ExportFolderDialog", function describeExportFolderDialog(): void {
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

  it("Exported folder", async function exportsFolder(): Promise<void> {
    const fixture = await buildEditedFixture();
    renderCatalogDialog(fixture, {
      kind: "catalogExportFolder",
      folder: "my-mosaics",
    });

    const saveButton = await screen.findByRole("button", { name: "Save" });
    expect(document.querySelector("dialog")).toHaveTextContent(
      "my-mosaics.zip",
    );
    fireEvent.click(saveButton);

    await waitFor(function answered(): void {
      expect(fixture.onAnswer).toHaveBeenCalledExactlyOnceWith(SHOWN_ID, true);
    });
    const blob = vi.mocked(URL.createObjectURL).mock.calls[0][0] as Blob;
    expect(blob.type).toBe("application/zip");
    const files = unzipSync(new Uint8Array(await blob.arrayBuffer()));
    expect(Object.keys(files)).toEqual(["maps/nobel_map.yaml"]);
    expect(strFromU8(files["maps/nobel_map.yaml"])).toBe(EDITED_TEXT);
    const [entry] = readUserCatalogSnapshot(fixture.store).entries;
    expect(entry.provenance.changedSinceExport).toBe(false);
    expect(entry.syncedAt).toBe(SAVE_TIME);
  });

  it("says when the folder has no stored mosaic", async function showsGoneFolder(): Promise<void> {
    const fixture = await buildDialogFixture();
    renderCatalogDialog(fixture, {
      kind: "catalogExportFolder",
      folder: "my-mosaics",
    });

    expect(
      await screen.findByText(
        "No mosaic of this folder is stored in this browser any more.",
      ),
    ).toBeInTheDocument();
  });
});
