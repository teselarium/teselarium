import { describe, expect, it } from "vitest";
import {
  buildAskingContext,
  catchMethodError,
} from "../../../test/method_contexts.ts";
import type { RequestActionSpy } from "../../../test/method_contexts.ts";
import { APP_BASE_URL } from "../../../test/sample_files.ts";
import type { UserCatalogEntry } from "../../user_catalog/index.ts";
import { createMemoryBrowserDatabase } from "../storage/index.ts";
import { INVALID_PARAMS, PERMISSION_DENIED } from "./mod_messages.ts";
import type { ActionAnswer } from "./app_actions.ts";
import type { ModMethodContext } from "./mod_methods.ts";
import { USER_CATALOG_METHODS } from "./user_catalog_methods.ts";

const STORED_ADDRESS = "opentesela-browser:///r1/maps/nobel_map.yaml";
const REMOTE_ADDRESS = "https://mosaics.example.net/maps/laureates.yml";
const SAMPLE_MOSAIC = `${APP_BASE_URL}samples/mosaics/nobel_books_list.yaml`;

const STORED_ENTRY: UserCatalogEntry = {
  address: STORED_ADDRESS,
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

interface UserCatalogContext {
  context: ModMethodContext;
  requestSpy: RequestActionSpy;
}

function returnEntries(
  entries: readonly UserCatalogEntry[],
): readonly UserCatalogEntry[] {
  return entries;
}

function returnNoEntries(): null {
  return null;
}

/** A context whose user catalog holds the stored and the remote entry, read from a memory database. */
async function buildUserCatalogContext(
  answer: ActionAnswer | null,
): Promise<UserCatalogContext> {
  const database = createMemoryBrowserDatabase<UserCatalogEntry>();
  await database.apply({
    putFiles: [{ address: STORED_ADDRESS, text: "mosaic: {}\n" }],
    putEntries: [STORED_ENTRY, REMOTE_ENTRY],
    deleteAddresses: [],
  });
  const asking = buildAskingContext(answer);
  asking.context.readUserCatalog = returnEntries.bind(
    undefined,
    await database.readEntries(),
  );
  return asking;
}

function sendRequest(
  context: ModMethodContext,
  method: string,
  params: object,
): Promise<unknown> {
  return USER_CATALOG_METHODS[method](context, params as never);
}

describe("userCatalog.import", function describeImport(): void {
  it("asks for the import dialog and ignores its params", async function asksImport(): Promise<void> {
    const { context, requestSpy } = await buildUserCatalogContext(true);

    const result = await sendRequest(context, "userCatalog.import", {
      mosaic: 3,
    });

    expect(result).toBe(true);
    expect(requestSpy).toHaveBeenCalledExactlyOnceWith({
      kind: "catalogImport",
    });
  });

  it("Cancelled", async function answersCancel(): Promise<void> {
    const { context } = await buildUserCatalogContext(false);

    const result = await sendRequest(context, "userCatalog.import", {});

    expect(result).toBe(false);
  });

  it("Hidden mod", async function refusesHidden(): Promise<void> {
    const { context } = await buildUserCatalogContext(null);

    const error = await catchMethodError(
      sendRequest.bind(undefined, context, "userCatalog.import", {}),
    );

    expect(error.code).toBe(PERMISSION_DENIED);
    expect(error.message).toBe(
      "userCatalog.import: only the visible mod can ask the user",
    );
  });
});

describe("userCatalog.update and userCatalog.export", function describeStoredRequests(): void {
  it("asks for the update dialog of a stored entry", async function asksUpdate(): Promise<void> {
    const { context, requestSpy } = await buildUserCatalogContext(true);

    const result = await sendRequest(context, "userCatalog.update", {
      mosaic: STORED_ADDRESS,
    });

    expect(result).toBe(true);
    expect(requestSpy).toHaveBeenCalledExactlyOnceWith({
      kind: "catalogUpdate",
      address: STORED_ADDRESS,
    });
  });

  it("asks for the save dialog of a stored entry", async function asksExport(): Promise<void> {
    const { context, requestSpy } = await buildUserCatalogContext(true);

    await sendRequest(context, "userCatalog.export", {
      mosaic: STORED_ADDRESS,
    });

    expect(requestSpy).toHaveBeenCalledExactlyOnceWith({
      kind: "catalogExport",
      address: STORED_ADDRESS,
    });
  });

  it("Missing mosaic", async function refusesMissingMosaic(): Promise<void> {
    const { context, requestSpy } = await buildUserCatalogContext(true);

    const error = await catchMethodError(
      sendRequest.bind(undefined, context, "userCatalog.export", {}),
    );

    expect(error.code).toBe(INVALID_PARAMS);
    expect(error.message).toBe(
      'userCatalog.export: "mosaic" must be a non-empty string',
    );
    expect(requestSpy).not.toHaveBeenCalled();
  });

  it("Not a stored entry", async function refusesUnstored(): Promise<void> {
    const { context, requestSpy } = await buildUserCatalogContext(true);

    const error = await catchMethodError(
      sendRequest.bind(undefined, context, "userCatalog.update", {
        mosaic: SAMPLE_MOSAIC,
      }),
    );

    expect(error.code).toBe(INVALID_PARAMS);
    expect(error.message).toBe(
      `userCatalog.update: the mosaic "${SAMPLE_MOSAIC}" is not stored in this browser`,
    );
    expect(requestSpy).not.toHaveBeenCalled();
  });

  it("refuses a remote user entry", async function refusesRemoteEntry(): Promise<void> {
    const { context } = await buildUserCatalogContext(true);

    const error = await catchMethodError(
      sendRequest.bind(undefined, context, "userCatalog.export", {
        mosaic: REMOTE_ADDRESS,
      }),
    );

    expect(error.code).toBe(INVALID_PARAMS);
    expect(error.message).toContain("is not stored in this browser");
  });

  it("resolves the mosaic against the app's address", async function resolvesMosaic(): Promise<void> {
    const { context } = await buildUserCatalogContext(true);

    const error = await catchMethodError(
      sendRequest.bind(undefined, context, "userCatalog.update", {
        mosaic: "./samples/mosaics/nobel_books_list.yaml",
      }),
    );

    expect(error.message).toContain(`"${SAMPLE_MOSAIC}"`);
  });

  it("Hidden mod with a stored entry", async function refusesHiddenUpdate(): Promise<void> {
    const { context } = await buildUserCatalogContext(null);

    const error = await catchMethodError(
      sendRequest.bind(undefined, context, "userCatalog.update", {
        mosaic: STORED_ADDRESS,
      }),
    );

    expect(error.code).toBe(PERMISSION_DENIED);
  });
});

describe("userCatalog.add", function describeAdd(): void {
  it("asks for the dialog with an empty field", async function asksAdd(): Promise<void> {
    const { context, requestSpy } = await buildUserCatalogContext(true);

    await sendRequest(context, "userCatalog.add", {});

    expect(requestSpy).toHaveBeenCalledExactlyOnceWith({
      kind: "catalogAdd",
      suggested: null,
    });
  });

  it("Add with a suggested address", async function asksWithSuggestion(): Promise<void> {
    const { context, requestSpy } = await buildUserCatalogContext(true);

    await sendRequest(context, "userCatalog.add", { mosaic: REMOTE_ADDRESS });

    expect(requestSpy).toHaveBeenCalledExactlyOnceWith({
      kind: "catalogAdd",
      suggested: REMOTE_ADDRESS,
    });
  });

  it("refuses a mosaic that is not a string", async function refusesNonString(): Promise<void> {
    const { context } = await buildUserCatalogContext(true);

    const error = await catchMethodError(
      sendRequest.bind(undefined, context, "userCatalog.add", { mosaic: 3 }),
    );

    expect(error.code).toBe(INVALID_PARAMS);
    expect(error.message).toBe('userCatalog.add: "mosaic" must be a string');
  });
});

describe("userCatalog.remove", function describeRemove(): void {
  it("asks to remove a stored or remote entry", async function asksRemove(): Promise<void> {
    const { context, requestSpy } = await buildUserCatalogContext(true);

    await sendRequest(context, "userCatalog.remove", {
      mosaic: STORED_ADDRESS,
    });
    await sendRequest(context, "userCatalog.remove", {
      mosaic: REMOTE_ADDRESS,
    });

    expect(requestSpy.mock.calls).toEqual([
      [{ kind: "catalogRemove", address: STORED_ADDRESS }],
      [{ kind: "catalogRemove", address: REMOTE_ADDRESS }],
    ]);
  });

  it("Instance mosaic", async function refusesInstanceMosaic(): Promise<void> {
    const { context } = await buildUserCatalogContext(true);

    const error = await catchMethodError(
      sendRequest.bind(undefined, context, "userCatalog.remove", {
        mosaic: SAMPLE_MOSAIC,
      }),
    );

    expect(error.code).toBe(INVALID_PARAMS);
    expect(error.message).toBe(
      `userCatalog.remove: the mosaic "${SAMPLE_MOSAIC}" is not in the user catalog`,
    );
  });
});

describe("user catalog requests in a check", function describeInCheck(): void {
  it("does not check entries without a user catalog", async function skipsEntryCheck(): Promise<void> {
    const { context, requestSpy } = buildAskingContext(false);
    context.readUserCatalog = returnNoEntries;

    const result = await sendRequest(context, "userCatalog.remove", {
      mosaic: SAMPLE_MOSAIC,
    });

    expect(result).toBe(false);
    expect(requestSpy).toHaveBeenCalledExactlyOnceWith({
      kind: "catalogRemove",
      address: SAMPLE_MOSAIC,
    });
  });
});

const DRAFT = 'mosaic:\n  title: "Laureates, my way"\n  mod: "mod_viewer"\n';
const SAVED_ADDRESS = "opentesela-browser:///r9/laureates_my_way.yaml";

describe("userCatalog.save", function describeSave(): void {
  it("New mosaic saved", async function savesNewMosaic(): Promise<void> {
    const { context, requestSpy } =
      await buildUserCatalogContext(SAVED_ADDRESS);

    const result = await sendRequest(context, "userCatalog.save", {
      content: DRAFT,
      copiedFrom: SAMPLE_MOSAIC,
    });

    expect(result).toBe(SAVED_ADDRESS);
    expect(requestSpy).toHaveBeenCalledExactlyOnceWith({
      kind: "catalogSave",
      content: DRAFT,
      address: null,
      copiedFrom: SAMPLE_MOSAIC,
    });
  });

  it("saves a stored mosaic", async function savesStoredMosaic(): Promise<void> {
    const { context, requestSpy } =
      await buildUserCatalogContext(STORED_ADDRESS);

    const result = await sendRequest(context, "userCatalog.save", {
      content: DRAFT,
      mosaic: STORED_ADDRESS,
    });

    expect(result).toBe(STORED_ADDRESS);
    expect(requestSpy).toHaveBeenCalledExactlyOnceWith({
      kind: "catalogSave",
      content: DRAFT,
      address: STORED_ADDRESS,
      copiedFrom: null,
    });
  });

  it("answers null when nothing was saved", async function answersNull(): Promise<void> {
    const { context } = await buildUserCatalogContext(false);

    const result = await sendRequest(context, "userCatalog.save", {
      content: DRAFT,
    });

    expect(result).toBeNull();
  });

  it("Missing content", async function refusesMissingContent(): Promise<void> {
    const { context, requestSpy } = await buildUserCatalogContext(true);

    const error = await catchMethodError(
      sendRequest.bind(undefined, context, "userCatalog.save", {
        mosaic: "opentesela-browser:///r1/a.yaml",
      }),
    );

    expect(error.code).toBe(INVALID_PARAMS);
    expect(error.message).toBe(
      'userCatalog.save: "content" must be a non-empty string',
    );
    expect(requestSpy).not.toHaveBeenCalled();
  });

  it("refuses a mosaic that is not stored", async function refusesRemoteMosaic(): Promise<void> {
    const { context } = await buildUserCatalogContext(true);

    const error = await catchMethodError(
      sendRequest.bind(undefined, context, "userCatalog.save", {
        content: DRAFT,
        mosaic: REMOTE_ADDRESS,
      }),
    );

    expect(error.code).toBe(INVALID_PARAMS);
    expect(error.message).toBe(
      `userCatalog.save: the mosaic "${REMOTE_ADDRESS}" is not stored in this browser`,
    );
  });

  it("refuses a copiedFrom that is not a string", async function refusesWrongCopy(): Promise<void> {
    const { context } = await buildUserCatalogContext(true);

    const error = await catchMethodError(
      sendRequest.bind(undefined, context, "userCatalog.save", {
        content: DRAFT,
        copiedFrom: 3,
      }),
    );

    expect(error.code).toBe(INVALID_PARAMS);
    expect(error.message).toBe(
      'userCatalog.save: "copiedFrom" must be a non-empty string',
    );
  });

  it("Hidden mod asks to save", async function refusesHiddenSave(): Promise<void> {
    const { context } = await buildUserCatalogContext(null);

    const error = await catchMethodError(
      sendRequest.bind(undefined, context, "userCatalog.save", {
        content: DRAFT,
      }),
    );

    expect(error.code).toBe(PERMISSION_DENIED);
    expect(error.message).toBe(
      "userCatalog.save: only the visible mod can ask the user",
    );
  });
});

describe("userCatalog.history", function describeHistory(): void {
  it("asks for the history of a stored entry", async function asksHistory(): Promise<void> {
    const { context, requestSpy } = await buildUserCatalogContext(true);

    const result = await sendRequest(context, "userCatalog.history", {
      mosaic: STORED_ADDRESS,
    });

    expect(result).toBe(true);
    expect(requestSpy).toHaveBeenCalledExactlyOnceWith({
      kind: "catalogHistory",
      address: STORED_ADDRESS,
    });
  });

  it("refuses a remote entry", async function refusesRemoteHistory(): Promise<void> {
    const { context } = await buildUserCatalogContext(true);

    const error = await catchMethodError(
      sendRequest.bind(undefined, context, "userCatalog.history", {
        mosaic: REMOTE_ADDRESS,
      }),
    );

    expect(error.code).toBe(INVALID_PARAMS);
  });
});

describe("userCatalog.exportFolder", function describeExportFolder(): void {
  it("asks to export an imported folder", async function asksExportFolder(): Promise<void> {
    const { context, requestSpy } = await buildUserCatalogContext(true);

    const result = await sendRequest(context, "userCatalog.exportFolder", {
      folder: "my-mosaics",
    });

    expect(result).toBe(true);
    expect(requestSpy).toHaveBeenCalledExactlyOnceWith({
      kind: "catalogExportFolder",
      folder: "my-mosaics",
    });
  });

  it("Unknown folder", async function refusesUnknownFolder(): Promise<void> {
    const { context, requestSpy } = await buildUserCatalogContext(true);

    const error = await catchMethodError(
      sendRequest.bind(undefined, context, "userCatalog.exportFolder", {
        folder: "nowhere",
      }),
    );

    expect(error.code).toBe(INVALID_PARAMS);
    expect(error.message).toBe(
      'userCatalog.exportFolder: no stored mosaic comes from the folder "nowhere"',
    );
    expect(requestSpy).not.toHaveBeenCalled();
  });

  it("refuses a missing folder", async function refusesMissingFolder(): Promise<void> {
    const { context } = await buildUserCatalogContext(true);

    const error = await catchMethodError(
      sendRequest.bind(undefined, context, "userCatalog.exportFolder", {}),
    );

    expect(error.message).toBe(
      'userCatalog.exportFolder: "folder" must be a non-empty string',
    );
  });

  it("answers false when the zip was not saved", async function answersFalse(): Promise<void> {
    const { context } = await buildUserCatalogContext(false);

    const result = await sendRequest(context, "userCatalog.exportFolder", {
      folder: "my-mosaics",
    });

    expect(result).toBe(false);
  });
});
