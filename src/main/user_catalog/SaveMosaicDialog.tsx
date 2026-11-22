import { useEffect, useState } from "react";
import type { ReactElement } from "react";
import { createDraftLoadCache } from "../../lib/core/engine/index.ts";
import type {
  ActionAnswer,
  DraftLoadCache,
  DraftProblem,
} from "../../lib/core/engine/index.ts";
import type { SiteDecision } from "../../lib/core/permissions/index.ts";
import type { ActionMod } from "../../lib/core/stage/index.ts";
import type { YamlValue } from "../../lib/files/index.ts";
import type { LoadedMosaic } from "../../lib/mosaic/index.ts";
import {
  diffMosaics,
  findStoredEntry,
  planSave,
} from "../../lib/user_catalog/index.ts";
import type {
  MosaicChange,
  MosaicTextField,
  UserCatalogEntry,
} from "../../lib/user_catalog/index.ts";
import { rememberSiteDecisions } from "../settings/site_decisions.ts";
import { CatalogDialogFrame } from "./CatalogDialogFrame.tsx";
import {
  cancelTicket,
  createReadTicket,
  keepIfCurrent,
} from "./read_tickets.ts";
import { StatusBadge } from "./StatusBadge.tsx";
import { GONE_ENTRY_MESSAGE } from "./UpdateDialog.tsx";
import { readDraftMosaic, validateUserDraft } from "./user_catalog_reads.ts";
import {
  applyUserCatalogChanges,
  readUserCatalogText,
  readUserCatalogVersions,
  waitForUserCatalogStart,
} from "./user_catalog_store.ts";
import type { UserCatalogStore } from "./user_catalog_store.ts";

/** What a save writes: a save of a draft, or a version restored from the history. */
export type SaveKind = "saved" | "restored";

interface SaveMosaicDialogProps {
  shownId: number;
  mod: ActionMod;
  /** The draft's text. */
  content: string;
  /** The stored entry it replaces, or `null` for a new mosaic. */
  address: string | null;
  /** For a new mosaic, the address it is a copy of, or `null`. */
  copiedFrom: string | null;
  kind: SaveKind;
  userCatalog: UserCatalogStore;
  /** Answered with the saved address, or `false` when nothing was saved. */
  onAnswer: (id: number, answer: ActionAnswer) => void;
}

/** What the confirmation found once the draft was checked. */
interface SaveCheck {
  errors: DraftProblem[];
  warnings: DraftProblem[];
  changes: MosaicChange[];
  /** The draft as the loader reads it, or `null` with errors. */
  draft: LoadedMosaic | null;
  /** The stored entry the save replaces, or `null` for a new mosaic. */
  entry: UserCatalogEntry | null;
}

type SaveState =
  { kind: "checking" } | { kind: "gone" } | { kind: "ready"; check: SaveCheck };

const FIELD_LABELS: Record<MosaicTextField, string> = {
  title: "Title",
  description: "Description",
  mod: "Mod",
  collection: "Collection",
};

function readSavedMosaic(
  store: UserCatalogStore,
  text: string | null,
  address: string,
): LoadedMosaic | null {
  if (text === null) {
    return null;
  }
  return readDraftMosaic(store, text, address);
}

async function readSaveState(
  store: UserCatalogStore,
  content: string,
  address: string | null,
  loads: DraftLoadCache,
): Promise<SaveState> {
  await waitForUserCatalogStart(store);
  const entry =
    address === null ? null : findStoredEntry(store.snapshot.entries, address);
  if (address !== null && entry === null) {
    const gone: SaveState = { kind: "gone" };
    return gone;
  }
  const validation = await validateUserDraft(store, content, address, loads);
  const draft =
    validation.errors.length > 0
      ? null
      : readDraftMosaic(store, content, address);
  let saved: LoadedMosaic | null = null;
  if (address !== null) {
    const savedText = await readUserCatalogText(store, address);
    saved = readSavedMosaic(store, savedText, address);
  }
  const ready: SaveState = {
    kind: "ready",
    check: {
      errors: validation.errors,
      warnings: validation.warnings,
      changes: draft === null ? [] : diffMosaics(saved, draft),
      draft,
      entry,
    },
  };
  return ready;
}

/** Allow, remembered for the saved address, for each `show` line of the saved mosaic. */
function buildSaveDecisions(
  draft: LoadedMosaic,
  address: string,
): SiteDecision[] {
  const decisions: SiteDecision[] = [];
  for (const line of draft.permissions) {
    decisions.push({
      mosaic: address,
      title: draft.title,
      category: "show",
      host: line.host,
      allowed: true,
    });
  }
  return decisions;
}

/**
 * Remembers Allow for the saved lines. A failure leaves the mosaic saved,
 * and its lines are asked when it opens, which is the safe direction.
 */
function rememberSavedLines(
  store: UserCatalogStore,
  draft: LoadedMosaic,
  address: string,
): void {
  try {
    rememberSiteDecisions(
      store.siteDecisions,
      buildSaveDecisions(draft, address),
    );
  } catch {
    // The lines are asked when the mosaic opens.
  }
}

/** Writes the save, then allows its lines. Resolves with the saved address. */
async function saveDraft(
  store: UserCatalogStore,
  content: string,
  check: SaveCheck,
  copiedFrom: string | null,
  kind: SaveKind,
): Promise<string> {
  const draft = check.draft as LoadedMosaic;
  const versions =
    check.entry === null
      ? []
      : await readUserCatalogVersions(store, check.entry.address);
  const plan = planSave({
    draft: content,
    title: draft.title,
    entry: check.entry,
    copiedFrom: check.entry === null ? copiedFrom : null,
    versions,
    now: new Date(),
    kind,
  });
  await applyUserCatalogChanges(store, plan.changes);
  rememberSavedLines(store, draft, plan.address);
  return plan.address;
}

function describeValue(value: string | null): string {
  return value ?? "none";
}

function describeNames(names: string[] | null): string {
  return names === null ? "none" : names.join(", ");
}

function describeConfigValue(value: YamlValue | null): string {
  return value === null ? "none" : JSON.stringify(value);
}

/** "Before → after", or the new value alone when there was none. */
function describeTransition(
  before: string,
  after: string,
  isNew: boolean,
): string {
  if (isNew) {
    return after;
  }
  return `${before} → ${after}`;
}

function describeChange(change: MosaicChange, isNew: boolean): string {
  if (change.kind === "field") {
    return `${FIELD_LABELS[change.field]}: ${describeTransition(describeValue(change.before), describeValue(change.after), isNew)}`;
  }
  if (change.kind === "alias") {
    return `Names for ${change.field}: ${describeTransition(describeNames(change.before), describeNames(change.after), isNew)}`;
  }
  if (change.kind === "config") {
    return `Config ${change.key}: ${describeTransition(describeConfigValue(change.before), describeConfigValue(change.after), isNew)}`;
  }
  return `${change.change === "added" ? "added" : "removed"}: ${change.reason}`;
}

function renderChange(
  change: MosaicChange,
  index: number,
  isNew: boolean,
): ReactElement {
  if (change.kind !== "show") {
    return (
      <li key={index} className="py-1" data-mosaic-change={change.kind}>
        {describeChange(change, isNew)}
      </li>
    );
  }
  return (
    <li
      key={index}
      className="flex flex-wrap items-center gap-2 py-1"
      data-mosaic-change="show"
      data-show-change={change.change}
    >
      <span>Show</span>
      <StatusBadge variant={change.change === "added" ? "warning" : "outline"}>
        {change.host}
      </StatusBadge>
      <span>{describeChange(change, isNew)}</span>
    </li>
  );
}

function describeProblem(problem: DraftProblem): string {
  if (problem.line === null) {
    return problem.message;
  }
  return `Line ${problem.line}: ${problem.message}`;
}

function renderProblems(
  problems: DraftProblem[],
  label: string,
  className: string,
): ReactElement | null {
  if (problems.length === 0) {
    return null;
  }
  const items: ReactElement[] = [];
  for (const [index, problem] of problems.entries()) {
    items.push(<li key={index}>{describeProblem(problem)}</li>);
  }
  return (
    <ul
      aria-label={label}
      className={`m-0 max-h-[30vh] list-none overflow-y-auto p-0 text-sm [overflow-wrap:anywhere] ${className}`}
    >
      {items}
    </ul>
  );
}

function describeIntro(check: SaveCheck): string {
  if (check.entry === null) {
    return "The mosaic is stored in this browser as a new mosaic:";
  }
  if (check.changes.length === 0) {
    return "Nothing changes from the saved version.";
  }
  return "These changes are saved:";
}

function renderChanges(check: SaveCheck): ReactElement {
  const isNew = check.entry === null;
  const items: ReactElement[] = [];
  for (const [index, change] of check.changes.entries()) {
    items.push(renderChange(change, index, isNew));
  }
  const hasShowLines = (check.draft?.permissions.length ?? 0) > 0;
  return (
    <>
      <p className="m-0 text-sm">{describeIntro(check)}</p>
      {items.length === 0 ? null : (
        <ul
          aria-label="Changes"
          data-save-changes=""
          className="m-0 max-h-[40vh] min-h-0 list-none divide-y overflow-y-auto p-0 text-sm [overflow-wrap:anywhere]"
        >
          {items}
        </ul>
      )}
      {hasShowLines ? (
        <p className="m-0 text-sm text-muted-foreground">
          Saving allows the sites of its show lines for this mosaic, so opening
          it asks nothing about them. Settings lists them under the mosaic.
        </p>
      ) : null}
      {renderProblems(check.warnings, "Warnings", "text-warning")}
    </>
  );
}

function renderBody(state: SaveState): ReactElement | null {
  if (state.kind === "checking") {
    return (
      <p role="status" className="m-0 text-sm text-muted-foreground">
        Checking the mosaic…
      </p>
    );
  }
  if (state.kind === "gone") {
    return null;
  }
  if (state.check.errors.length > 0) {
    return (
      <>
        <p className="m-0 text-sm">
          The mosaic has errors, so it cannot be saved:
        </p>
        {renderProblems(state.check.errors, "Errors", "text-destructive")}
      </>
    );
  }
  return renderChanges(state.check);
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * `userCatalog.save`, and a restore from the history: "Save mosaic". It
 * validates the draft and lists what changes from the saved version, or the
 * whole mosaic for a new one, with each added `show` line's host as a
 * warning badge and each removed one as an outline badge. A draft with
 * errors lists them and offers only "Close". "Save" writes the file, its
 * entry and a version, then remembers Allow for each of its `show` lines for
 * the saved address, and answers that address. Cancel and Escape answer
 * `false`.
 */
export function SaveMosaicDialog({
  shownId,
  mod,
  content,
  address,
  copiedFrom,
  kind,
  userCatalog,
  onAnswer,
}: SaveMosaicDialogProps): ReactElement {
  const [state, setState] = useState<SaveState>({ kind: "checking" });
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(
    function checkDraft(): () => void {
      const ticket = createReadTicket();
      void readSaveState(
        userCatalog,
        content,
        address,
        createDraftLoadCache(),
      ).then((keepIfCurrent<SaveState>).bind(undefined, ticket, setState));
      return cancelTicket.bind(undefined, ticket);
    },
    [userCatalog, content, address],
  );

  async function save(check: SaveCheck): Promise<void> {
    setIsSaving(true);
    setError(null);
    try {
      const saved = await saveDraft(
        userCatalog,
        content,
        check,
        copiedFrom,
        kind,
      );
      onAnswer(shownId, saved);
    } catch (saveError) {
      setError(describeError(saveError));
      setIsSaving(false);
    }
  }

  function handleSave(): void {
    if (state.kind === "ready") {
      void save(state.check);
    }
  }

  function handleCancel(): void {
    onAnswer(shownId, false);
  }

  const canSave = state.kind === "ready" && state.check.errors.length === 0;
  return (
    <CatalogDialogFrame
      shownId={shownId}
      title="Save mosaic"
      mod={mod}
      error={state.kind === "gone" ? GONE_ENTRY_MESSAGE : error}
      acceptLabel={canSave ? "Save" : null}
      cancelLabel={canSave || state.kind === "checking" ? "Cancel" : "Close"}
      isAcceptDisabled={isSaving}
      onAccept={handleSave}
      onCancel={handleCancel}
    >
      {renderBody(state)}
    </CatalogDialogFrame>
  );
}
