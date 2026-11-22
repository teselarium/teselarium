import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  SAMPLE_COLLECTION_SOURCE,
  SAMPLE_MOD_SOURCE,
} from "../../test/sample_mods.ts";
import { testTexts } from "../../test/test_files.ts";
import {
  buildDialogFixture,
  pressEscape,
  renderCatalogDialog,
  SHOWN_ID,
} from "../../test/user_catalog_dialogs.tsx";
import type { UserCatalogEntry } from "../../lib/user_catalog/index.ts";
import { readSiteDecisionsSnapshot } from "../settings/site_decisions.ts";
import { readUserCatalogSnapshot } from "./user_catalog_store.ts";

const SAMPLE_ADDRESS =
  "https://example.org/samples/mosaics/nobel_laureates_map.yaml";
const STORED_ADDRESS = "opentesela-browser:///r1/books.yaml";
const PORTRAITS_HOST = "https://upload.wikimedia.org";

function writeDraft(lines: string[]): string {
  const draft = `${["mosaic:", ...lines].join("\n")}\n`;
  return draft;
}

const SAVED_TEXT = writeDraft([
  '  title: "Books"',
  `  mod: "${SAMPLE_MOD_SOURCE}"`,
  `  collection: "${SAMPLE_COLLECTION_SOURCE}"`,
]);

const DRAFT_WITH_PORTRAITS = writeDraft([
  '  title: "Books"',
  `  mod: "${SAMPLE_MOD_SOURCE}"`,
  `  collection: "${SAMPLE_COLLECTION_SOURCE}"`,
  "  permissions:",
  "    show:",
  `      - host: "${PORTRAITS_HOST}"`,
  '        reason: "Shows the portraits"',
]);

const STORED_ENTRY: UserCatalogEntry = {
  address: STORED_ADDRESS,
  place: "browser",
  root: "r1",
  provenance: {
    folder: null,
    path: "books.yaml",
    addedAt: "2026-11-20T10:00:00.000Z",
    updatedAt: null,
    changedSinceExport: false,
    copiedFrom: null,
  },
  syncedAt: "2026-11-20T10:00:00.000Z",
};

function buildStoredFixture(): ReturnType<typeof buildDialogFixture> {
  return buildDialogFixture(
    [STORED_ENTRY],
    new Map([[STORED_ADDRESS, SAVED_TEXT]]),
  );
}

afterEach(function clearTexts(): void {
  testTexts.clear();
});

describe("SaveMosaicDialog", function describeSaveMosaicDialog(): void {
  it("New host", async function highlightsNewHost(): Promise<void> {
    const fixture = await buildStoredFixture();
    renderCatalogDialog(fixture, {
      kind: "catalogSave",
      content: DRAFT_WITH_PORTRAITS,
      address: STORED_ADDRESS,
      copiedFrom: null,
    });

    const list = await screen.findByRole("list", { name: "Changes" });
    expect(
      screen.getByRole("heading", { name: "Save mosaic" }),
    ).toBeInTheDocument();
    const host = within(list).getByText(PORTRAITS_HOST);
    expect(host).toHaveAttribute("data-variant", "warning");
    expect(
      within(list).getByText("added: Shows the portraits"),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(function answered(): void {
      expect(fixture.onAnswer).toHaveBeenCalledExactlyOnceWith(
        SHOWN_ID,
        STORED_ADDRESS,
      );
    });
    expect(await fixture.database.readText(STORED_ADDRESS)).toBe(
      DRAFT_WITH_PORTRAITS,
    );
    const versions = await fixture.database.readVersions(STORED_ADDRESS);
    expect(versions.map(readKind)).toEqual(["saved", "imported"]);
  });

  it("shows a removed host as an outline badge", async function showsRemovedHost(): Promise<void> {
    const fixture = await buildDialogFixture(
      [STORED_ENTRY],
      new Map([[STORED_ADDRESS, DRAFT_WITH_PORTRAITS]]),
    );
    renderCatalogDialog(fixture, {
      kind: "catalogSave",
      content: SAVED_TEXT,
      address: STORED_ADDRESS,
      copiedFrom: null,
    });

    const list = await screen.findByRole("list", { name: "Changes" });

    expect(within(list).getByText(PORTRAITS_HOST)).toHaveAttribute(
      "data-variant",
      "outline",
    );
  });

  it("Draft with errors", async function refusesErrors(): Promise<void> {
    const fixture = await buildStoredFixture();
    renderCatalogDialog(fixture, {
      kind: "catalogSave",
      content: writeDraft([`  mod: "${SAMPLE_MOD_SOURCE}"`]),
      address: STORED_ADDRESS,
      copiedFrom: null,
    });

    const errors = await screen.findByRole("list", { name: "Errors" });

    expect(errors).toHaveTextContent('"title" must be a non-empty string');
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(fixture.onAnswer).toHaveBeenCalledExactlyOnceWith(SHOWN_ID, false);
    expect(await fixture.database.readText(STORED_ADDRESS)).toBe(SAVED_TEXT);
  });

  it("Cancel saves nothing", async function cancels(): Promise<void> {
    const fixture = await buildStoredFixture();
    renderCatalogDialog(fixture, {
      kind: "catalogSave",
      content: DRAFT_WITH_PORTRAITS,
      address: STORED_ADDRESS,
      copiedFrom: null,
    });
    await screen.findByRole("list", { name: "Changes" });

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(fixture.onAnswer).toHaveBeenCalledExactlyOnceWith(SHOWN_ID, false);
    expect(await fixture.database.readText(STORED_ADDRESS)).toBe(SAVED_TEXT);
  });

  it("Escape saves nothing", async function escapes(): Promise<void> {
    const fixture = await buildStoredFixture();
    const dialog = renderCatalogDialog(fixture, {
      kind: "catalogSave",
      content: DRAFT_WITH_PORTRAITS,
      address: STORED_ADDRESS,
      copiedFrom: null,
    });
    await screen.findByRole("list", { name: "Changes" });

    const cancelEvent = pressEscape(dialog);

    expect(fixture.onAnswer).toHaveBeenCalledExactlyOnceWith(SHOWN_ID, false);
    expect(cancelEvent.defaultPrevented).toBe(true);
  });

  it("Saved from a copy", async function savesNewMosaic(): Promise<void> {
    const fixture = await buildDialogFixture();
    const copy = DRAFT_WITH_PORTRAITS.replace('"Books"', '"Laureates, my way"');
    renderCatalogDialog(fixture, {
      kind: "catalogSave",
      content: copy,
      address: null,
      copiedFrom: SAMPLE_ADDRESS,
    });

    const list = await screen.findByRole("list", { name: "Changes" });
    expect(
      within(list).getByText("Title: Laureates, my way"),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(function answered(): void {
      expect(fixture.onAnswer).toHaveBeenCalledOnce();
    });
    const [id, answer] = fixture.onAnswer.mock.calls[0];
    expect(id).toBe(SHOWN_ID);
    expect(answer).toMatch(
      /^opentesela-browser:\/\/\/[^/]+\/laureates_my_way\.yaml$/,
    );
    const [entry] = readUserCatalogSnapshot(fixture.store).entries;
    expect(entry.address).toBe(answer);
    expect(entry.provenance).toMatchObject({
      folder: null,
      path: "laureates_my_way.yaml",
      changedSinceExport: true,
      copiedFrom: SAMPLE_ADDRESS,
    });
  });

  it("Saved, then opened", async function allowsSavedLines(): Promise<void> {
    const fixture = await buildStoredFixture();
    renderCatalogDialog(fixture, {
      kind: "catalogSave",
      content: DRAFT_WITH_PORTRAITS,
      address: STORED_ADDRESS,
      copiedFrom: null,
    });
    await screen.findByRole("list", { name: "Changes" });

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(function answered(): void {
      expect(fixture.onAnswer).toHaveBeenCalledOnce();
    });
    expect(readSiteDecisionsSnapshot(fixture.store.siteDecisions)).toEqual([
      {
        mosaic: STORED_ADDRESS,
        title: "Books",
        category: "show",
        host: PORTRAITS_HOST,
        allowed: true,
      },
    ]);
  });

  it("Relative collection in a new mosaic", async function refusesRelative(): Promise<void> {
    const fixture = await buildDialogFixture();
    renderCatalogDialog(fixture, {
      kind: "catalogSave",
      content: writeDraft([
        '  title: "Laureates"',
        `  mod: "${SAMPLE_MOD_SOURCE}"`,
        '  collection: "../tiles/laureates"',
      ]),
      address: null,
      copiedFrom: null,
    });

    const errors = await screen.findByRole("list", { name: "Errors" });

    expect(errors).toHaveTextContent(
      '"collection" must be an absolute address in a new mosaic',
    );
  });
});

function readKind(version: { kind: string }): string {
  return version.kind;
}
