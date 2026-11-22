import type { CaseCatalogMosaicEntry, CaseContext } from "../../mod_api.d.ts";
import {
  clickButton,
  FIXTURE_REFERENCES,
  findButton,
  findSection,
  findSettledRequest,
  mountWithTarget,
  readDefinition,
} from "./case_helpers.ts";

/** The provenance of the shown mosaic as a fixture stored mosaic. */
const STORED_PROVENANCE = {
  folder: "my-mosaics",
  path: "maps/a/rather/long/path/to/shown_mosaic.yaml",
  addedAt: "2026-11-20T10:00:00.000Z",
  updatedAt: null,
};

/** The provenance of the shown mosaic as a fixture remote mosaic. */
const REMOTE_PROVENANCE = {
  folder: null,
  path: null,
  addedAt: "2026-11-20T11:00:00.000Z",
  updatedAt: null,
};

/**
 * The shown mosaic's address as the viewer reads it: resolved, since a
 * scripted catalog keeps its sources as given. A case frame's base is the
 * app's address.
 */
function readShownMosaicSource(): string {
  const source = new URL(FIXTURE_REFERENCES.shownMosaic, document.baseURI).href;
  return source;
}

/** Answers `catalog.list` with the shown mosaic as a user mosaic, then mounts the viewer with it. */
function mountAsUserMosaic(
  context: CaseContext,
  entry: Omit<CaseCatalogMosaicEntry, "source">,
): Promise<void> {
  context.answer("catalog.list", {
    mosaics: [{ source: readShownMosaicSource(), ...entry }],
  });
  return mountWithTarget(context, FIXTURE_REFERENCES.shownMosaic);
}

function mountAsStoredMosaic(context: CaseContext): Promise<void> {
  return mountAsUserMosaic(context, {
    place: "browser",
    provenance: STORED_PROVENANCE,
  });
}

function readStatusText(context: CaseContext): string {
  const status = context.root.querySelector('[role="status"]');
  const text = status?.textContent ?? "";
  return text;
}

export async function showsStoredProvenance(
  context: CaseContext,
): Promise<void> {
  await mountAsStoredMosaic(context);

  const section = findSection(context, "Where it comes from");
  context
    .expect(readDefinition(section, "Folder").textContent)
    .toBe("my-mosaics");
  context
    .expect(readDefinition(section, "Path").textContent)
    .toBe(STORED_PROVENANCE.path);
  context
    .expect(readDefinition(section, "Imported").querySelector("time")?.dateTime)
    .toBe(STORED_PROVENANCE.addedAt);
  context.expect(readDefinition(section, "Updated").textContent).toBe("Never");
  context.expect(section.textContent).toContain("kept only in this browser");
  context.expect(findButton(context, "Update from file…")).toBeTruthy();
  context.expect(findButton(context, "Export")).toBeTruthy();
  context
    .expect(findButton(context, "Remove")?.getAttribute("data-ot-variant"))
    .toBe("destructive");
}

export async function showsRemoteProvenance(
  context: CaseContext,
): Promise<void> {
  await mountAsUserMosaic(context, { provenance: REMOTE_PROVENANCE });

  const section = findSection(context, "Where it comes from");
  context.expect(section.textContent).toContain("You added it by URL on ");
  context
    .expect(section.querySelector("time")?.dateTime)
    .toBe(REMOTE_PROVENANCE.addedAt);
  context.expect(findButton(context, "Update from file…")).toBe(null);
  context.expect(findButton(context, "Export")).toBe(null);
  context.expect(findButton(context, "Remove")).toBeTruthy();
}

export async function showsNoProvenanceForOthers(
  context: CaseContext,
): Promise<void> {
  context.answer("catalog.list", {
    mosaics: [{ source: readShownMosaicSource() }],
  });
  await mountWithTarget(context, FIXTURE_REFERENCES.shownMosaic);

  context
    .expect(
      context.root.querySelector('section[aria-label="Where it comes from"]'),
    )
    .toBe(null);
}

export async function removesStoredMosaic(context: CaseContext): Promise<void> {
  await mountAsStoredMosaic(context);
  context.answer("userCatalog.remove", true);

  clickButton(context, "Remove");

  const removeRequest = await context.waitFor(
    findSettledRequest.bind(undefined, context, "userCatalog.remove"),
  );
  context
    .expect(removeRequest.params)
    .toEqual({ mosaic: readShownMosaicSource() });
  context
    .expect(await context.waitFor(readStatusText.bind(undefined, context)))
    .toBe("The mosaic was removed from your catalog.");
  context.expect(findButton(context, "Remove")).toBe(null);
  context.expect(findButton(context, "Export")).toBe(null);
}

export async function exportsStoredMosaic(context: CaseContext): Promise<void> {
  await mountAsStoredMosaic(context);
  context.answer("userCatalog.export", true);

  clickButton(context, "Export");

  const exportRequest = await context.waitFor(
    findSettledRequest.bind(undefined, context, "userCatalog.export"),
  );
  context
    .expect(exportRequest.params)
    .toEqual({ mosaic: readShownMosaicSource() });
  context.expect(exportRequest.result).toBe(true);
}

export async function updatesStoredMosaicWhenCancelled(
  context: CaseContext,
): Promise<void> {
  await mountAsStoredMosaic(context);
  context.answer("userCatalog.update", false);

  clickButton(context, "Update from file…");

  const updateRequest = await context.waitFor(
    findSettledRequest.bind(undefined, context, "userCatalog.update"),
  );
  context
    .expect(updateRequest.params)
    .toEqual({ mosaic: readShownMosaicSource() });
  context.expect(updateRequest.result).toBe(false);
  context.expect(findButton(context, "Update from file…")).toBeTruthy();
}

export async function showsChangedSinceExport(
  context: CaseContext,
): Promise<void> {
  await mountAsUserMosaic(context, {
    place: "browser",
    provenance: { ...STORED_PROVENANCE, changedSinceExport: true },
  });

  const section = findSection(context, "Where it comes from");
  const badge = section.querySelector("[data-ot-variant]");
  context.expect(badge?.textContent).toBe("Unexported changes");
  context.expect(badge?.getAttribute("data-ot-variant")).toBe("warning");
  context.expect(findButton(context, "Export folder")).toBeTruthy();
  context.expect(findButton(context, "History…")).toBeTruthy();
}

export async function exportsFolderOfStoredMosaic(
  context: CaseContext,
): Promise<void> {
  await mountAsStoredMosaic(context);
  context.answer("userCatalog.exportFolder", true);

  clickButton(context, "Export folder");

  const exportRequest = await context.waitFor(
    findSettledRequest.bind(undefined, context, "userCatalog.exportFolder"),
  );
  context.expect(exportRequest.params).toEqual({ folder: "my-mosaics" });
  context.expect(exportRequest.result).toBe(true);
}

export async function showsHistoryOfStoredMosaic(
  context: CaseContext,
): Promise<void> {
  await mountAsStoredMosaic(context);
  context.answer("userCatalog.history", false);

  clickButton(context, "History…");

  const historyRequest = await context.waitFor(
    findSettledRequest.bind(undefined, context, "userCatalog.history"),
  );
  context
    .expect(historyRequest.params)
    .toEqual({ mosaic: readShownMosaicSource() });
  context.expect(historyRequest.result).toBe(false);
}

export async function hasNoFolderExportForSingleFile(
  context: CaseContext,
): Promise<void> {
  await mountAsUserMosaic(context, {
    place: "browser",
    provenance: {
      ...STORED_PROVENANCE,
      folder: null,
      path: "shown_mosaic.yaml",
    },
  });

  context.expect(findButton(context, "History…")).toBeTruthy();
  context.expect(findButton(context, "Export folder")).toBe(null);
  const section = findSection(context, "Where it comes from");
  context.expect(section.textContent).not.toContain("Unexported changes");
}
