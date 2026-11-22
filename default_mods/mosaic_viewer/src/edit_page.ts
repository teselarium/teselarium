import type {
  ModEngine,
  MosaicDraftEdits,
  MosaicDraftProblem,
  MosaicDraftValidation,
} from "../../mod_api.d.ts";
import { dropDraft, keepDraft, readKeptDraft } from "./draft_store.ts";
import { renderForm } from "./edit_form.ts";
import { hasUnsavedChanges, VALIDATION_DELAY_MS } from "./edit_view.ts";
import type { EditNodes, EditStart, EditView } from "./edit_view.ts";
import { describeError } from "./error_messages.ts";
import {
  buildBadge,
  buildButton,
  buildErrorAlert,
  buildStatusMessage,
} from "./page_elements.ts";

/** A default mod name, which `mods.inspect` resolves itself. */
const DEFAULT_MOD_NAME = /^[a-z][a-z0-9_]*$/;

type EditTab = "form" | "yaml";

function showEditError(view: EditView, error: unknown): void {
  view.nodes.messages.replaceChildren(buildErrorAlert(describeError(error)));
}

/** The mod reference `mods.inspect` reads the default config with, or `null` when there is none to read. */
function readModReference(view: EditView): string | null {
  const mod = view.validation?.draft?.mod ?? null;
  if (mod === null || mod === "") {
    return null;
  }
  if (DEFAULT_MOD_NAME.test(mod) || URL.canParse(mod)) {
    return mod;
  }
  if (view.address === null) {
    return null;
  }
  return new URL(mod, view.address).href;
}

function isFocusedIn(element: HTMLElement): boolean {
  return element.contains(document.activeElement);
}

/** Shows the form again, unless the user is typing in it: their field keeps its text and its focus. */
function refreshForm(view: EditView): void {
  if (!view.nodes.formPanel.hidden && !isFocusedIn(view.nodes.formPanel)) {
    renderForm(view);
  }
}

async function readDefaultConfig(
  view: EditView,
  reference: string,
): Promise<void> {
  try {
    const inspection = await view.engine.request("mods.inspect", {
      mod: reference,
    });
    view.defaultConfig = {
      reference,
      config: inspection.config,
      isLoaded: true,
    };
  } catch {
    view.defaultConfig = { reference, config: null, isLoaded: true };
  }
  refreshForm(view);
}

/** Reads the mod's default config again when the draft names another mod. */
function followDefaultConfig(view: EditView): void {
  const reference = readModReference(view);
  if (reference === null) {
    view.defaultConfig = null;
    return;
  }
  if (view.defaultConfig?.reference === reference) {
    return;
  }
  view.defaultConfig = { reference, config: null, isLoaded: false };
  void readDefaultConfig(view, reference);
}

function describeProblem(problem: MosaicDraftProblem): string {
  if (problem.line === null) {
    return problem.message;
  }
  return `Line ${problem.line}: ${problem.message}`;
}

function buildProblemItem(
  problem: MosaicDraftProblem,
  level: "Error" | "Warning",
): HTMLElement {
  const item = document.createElement("li");
  item.dataset.problem = level.toLowerCase();
  const text = document.createElement("span");
  text.textContent = describeProblem(problem);
  item.append(
    buildBadge(level, level === "Error" ? "destructive" : "warning"),
    " ",
    text,
  );
  return item;
}

function renderProblems(
  view: EditView,
  validation: MosaicDraftValidation,
): void {
  const items: HTMLElement[] = [];
  for (const error of validation.errors) {
    items.push(buildProblemItem(error, "Error"));
  }
  for (const warning of validation.warnings) {
    items.push(buildProblemItem(warning, "Warning"));
  }
  view.nodes.problems.replaceChildren(...items);
  view.nodes.problems.hidden = items.length === 0;
}

function describeTileCount(validation: MosaicDraftValidation): string {
  if (validation.tiles !== null) {
    return `${validation.tiles.matching} of ${validation.tiles.total} tiles match`;
  }
  if (validation.draft?.collection === null) {
    return "No collection: the mod gets no tiles.";
  }
  return "Count unavailable";
}

function selectTab(view: EditView, tab: EditTab): void {
  const isForm = tab === "form";
  view.nodes.formTab.setAttribute("aria-selected", String(isForm));
  view.nodes.yamlTab.setAttribute("aria-selected", String(!isForm));
  view.nodes.formTab.dataset.otVariant = isForm ? "secondary" : "ghost";
  view.nodes.yamlTab.dataset.otVariant = isForm ? "ghost" : "secondary";
  view.nodes.formPanel.hidden = !isForm;
  view.nodes.yamlPanel.hidden = isForm;
  if (isForm) {
    renderForm(view);
  } else {
    view.nodes.textarea.value = view.content;
  }
}

/** The Form tab is unavailable while the text cannot be read, and says why. */
function followReadability(
  view: EditView,
  validation: MosaicDraftValidation,
): void {
  const isReadable = validation.draft !== null;
  view.nodes.formTab.disabled = !isReadable;
  if (isReadable) {
    view.nodes.formNote.replaceChildren();
    return;
  }
  const reason = validation.errors[0];
  view.nodes.formNote.replaceChildren(
    buildStatusMessage(
      `The form is unavailable until the YAML can be read${reason === undefined ? "." : `: ${describeProblem(reason)}`}`,
    ),
  );
  if (!view.nodes.formPanel.hidden) {
    selectTab(view, "yaml");
  }
}

function showValidation(
  view: EditView,
  validation: MosaicDraftValidation,
): void {
  view.validation = validation;
  renderProblems(view, validation);
  view.nodes.hints.replaceChildren(
    buildStatusMessage(describeTileCount(validation)),
  );
  followReadability(view, validation);
  followDefaultConfig(view);
  refreshForm(view);
}

/** Validates the draft. An answer to an older request than the newest is ignored. */
async function validateDraft(view: EditView): Promise<void> {
  view.latestValidation += 1;
  const request = view.latestValidation;
  const content = view.content;
  const params =
    view.address === null ? { content } : { content, mosaic: view.address };
  try {
    const validation = await view.engine.request("mosaics.validate", params);
    if (request === view.latestValidation) {
      showValidation(view, validation);
    }
  } catch (error) {
    if (request === view.latestValidation) {
      showEditError(view, error);
    }
  }
}

function runScheduledValidation(view: EditView): void {
  view.validationTimer = null;
  void validateDraft(view);
}

/** Validates half a second after the last change, so typing sends one request. */
function scheduleValidation(view: EditView): void {
  if (view.validationTimer !== null) {
    clearTimeout(view.validationTimer);
  }
  view.validationTimer = setTimeout(
    runScheduledValidation.bind(undefined, view),
    VALIDATION_DELAY_MS,
  );
}

/** Replaces the draft's text, keeps it in the viewer's storage, and validates it after the pause. */
function changeContent(view: EditView, content: string): void {
  view.content = content;
  if (view.nodes.textarea.value !== content) {
    view.nodes.textarea.value = content;
  }
  if (hasUnsavedChanges(view)) {
    void keepDraft(view.engine, view.storageKey, content);
  } else {
    void dropDraft(view.engine, view.storageKey);
  }
  scheduleValidation(view);
}

async function applyEdits(
  view: EditView,
  edits: MosaicDraftEdits,
): Promise<void> {
  view.nodes.messages.replaceChildren();
  try {
    const result = await view.engine.request("mosaics.edit", {
      content: view.content,
      edits,
    });
    changeContent(view, result.content);
  } catch (error) {
    showEditError(view, error);
  }
}

function handleTextInput(view: EditView): void {
  changeContent(view, view.nodes.textarea.value);
}

function buildTab(label: string, panelId: string): HTMLButtonElement {
  const tab = document.createElement("button");
  tab.type = "button";
  tab.setAttribute("role", "tab");
  tab.id = `${panelId}-tab`;
  tab.setAttribute("aria-controls", panelId);
  tab.textContent = label;
  return tab;
}

function buildPanel(id: string): HTMLElement {
  const panel = document.createElement("section");
  panel.id = id;
  panel.setAttribute("role", "tabpanel");
  panel.setAttribute("aria-labelledby", `${id}-tab`);
  return panel;
}

function buildTextarea(): HTMLTextAreaElement {
  const textarea = document.createElement("textarea");
  textarea.name = "content";
  textarea.dataset.otVariant = "code";
  textarea.rows = 18;
  textarea.spellcheck = false;
  textarea.setAttribute("aria-label", "Mosaic file");
  return textarea;
}

function buildNodes(): EditNodes {
  const problems = document.createElement("ul");
  problems.setAttribute("aria-label", "Problems");
  problems.hidden = true;
  const saveButton = document.createElement("button");
  saveButton.type = "submit";
  saveButton.textContent = "Save";
  const nodes: EditNodes = {
    notice: document.createElement("div"),
    formTab: buildTab("Form", "draft-form"),
    yamlTab: buildTab("YAML", "draft-yaml"),
    formNote: document.createElement("div"),
    formPanel: buildPanel("draft-form"),
    yamlPanel: buildPanel("draft-yaml"),
    textarea: buildTextarea(),
    problems,
    hints: document.createElement("div"),
    saveButton,
    messages: document.createElement("div"),
  };
  return nodes;
}

function leaveEditMode(view: EditView): Promise<void> {
  document.removeEventListener("keydown", view.keyHandler);
  if (view.validationTimer !== null) {
    clearTimeout(view.validationTimer);
  }
  view.latestValidation += 1;
  return view.onLeave();
}

/** Sends `userCatalog.save`. A saved address shows the mosaic, and `null` keeps edit mode and the draft. */
async function saveDraft(view: EditView): Promise<void> {
  if (view.nodes.saveButton.disabled) {
    return;
  }
  view.nodes.saveButton.disabled = true;
  view.nodes.messages.replaceChildren();
  const params: { content: string; mosaic?: string; copiedFrom?: string } = {
    content: view.content,
  };
  if (view.address !== null) {
    params.mosaic = view.address;
  }
  if (view.copiedFrom !== null) {
    params.copiedFrom = view.copiedFrom;
  }
  try {
    const saved = await view.engine.request("userCatalog.save", params);
    view.nodes.saveButton.disabled = false;
    if (saved !== null) {
      await dropDraft(view.engine, view.storageKey);
      document.removeEventListener("keydown", view.keyHandler);
      view.latestValidation += 1;
      await view.onSaved(saved);
    }
  } catch (error) {
    view.nodes.saveButton.disabled = false;
    showEditError(view, error);
  }
}

function handleSaveClick(view: EditView, event: MouseEvent): void {
  // The sandbox has no `allow-forms`: the form is never submitted.
  event.preventDefault();
  void saveDraft(view);
}

/** Ctrl+S or Cmd+S saves, in the frame, so only while the viewer has the focus. */
function handleSaveKey(view: EditView, event: KeyboardEvent): void {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
    event.preventDefault();
    void saveDraft(view);
  }
}

/** "Cancel": with unsaved changes, asks first, then drops the kept draft and leaves edit mode. */
async function cancelEditing(view: EditView): Promise<void> {
  if (hasUnsavedChanges(view)) {
    try {
      const isConfirmed = await view.engine.request("ui.confirm", {
        message: "Discard your changes to this mosaic?",
        confirmLabel: "Discard",
        cancelLabel: "Keep editing",
      });
      if (isConfirmed !== true) {
        return;
      }
    } catch (error) {
      showEditError(view, error);
      return;
    }
  }
  await dropDraft(view.engine, view.storageKey);
  await leaveEditMode(view);
}

function buildActions(view: EditView): HTMLElement {
  const form = document.createElement("form");
  form.setAttribute("aria-label", "Draft");
  view.nodes.saveButton.addEventListener(
    "click",
    handleSaveClick.bind(undefined, view),
  );
  const cancelButton = buildButton(
    "Cancel",
    cancelEditing.bind(undefined, view),
  );
  form.append(view.nodes.saveButton, cancelButton);
  return form;
}

function restoreDraft(view: EditView, kept: string): void {
  view.nodes.notice.replaceChildren();
  changeContent(view, kept);
  void validateDraft(view);
}

function discardKeptDraft(view: EditView): void {
  view.nodes.notice.replaceChildren();
  void dropDraft(view.engine, view.storageKey);
}

/** "Restore draft" and "Discard", when a draft of this mosaic was kept and differs from what edit mode starts with. */
async function offerKeptDraft(view: EditView): Promise<void> {
  const kept = await readKeptDraft(view.engine, view.storageKey);
  if (kept === null || kept === view.baseContent) {
    return;
  }
  const notice = buildStatusMessage(
    "A draft of this mosaic was kept from your last visit.",
  );
  const restoreButton = buildButton(
    "Restore draft",
    restoreDraft.bind(undefined, view, kept),
  );
  restoreButton.dataset.otVariant = "outline";
  const discardButton = buildButton(
    "Discard",
    discardKeptDraft.bind(undefined, view),
  );
  discardButton.dataset.otVariant = "outline";
  const form = document.createElement("form");
  form.setAttribute("aria-label", "Kept draft");
  form.append(restoreButton, discardButton);
  view.nodes.notice.replaceChildren(notice, form);
}

function buildEditView(engine: ModEngine, start: EditStart): EditView {
  const view: EditView = {
    ...start,
    engine,
    baseContent: start.content,
    validation: null,
    latestValidation: 0,
    validationTimer: null,
    defaultConfig: null,
    nodes: buildNodes(),
    keyHandler: ignoreKey,
    sendEdits: ignoreEdits,
  };
  view.keyHandler = handleSaveKey.bind(undefined, view);
  view.sendEdits = sendEditsOf.bind(undefined, view);
  return view;
}

function sendEditsOf(view: EditView, edits: MosaicDraftEdits): void {
  void applyEdits(view, edits);
}

function ignoreKey(): void {
  // Replaced once the view is built.
}

function ignoreEdits(): void {
  // Replaced once the view is built.
}

function buildTabList(view: EditView): HTMLElement {
  const tabList = document.createElement("div");
  tabList.setAttribute("role", "tablist");
  tabList.setAttribute("aria-label", "Draft views");
  view.nodes.formTab.addEventListener(
    "click",
    selectTab.bind(undefined, view, "form"),
  );
  view.nodes.yamlTab.addEventListener(
    "click",
    selectTab.bind(undefined, view, "yaml"),
  );
  tabList.append(view.nodes.formTab, view.nodes.yamlTab);
  return tabList;
}

/**
 * Edit mode: the heading, a kept draft's notice, the "Form" and "YAML" tabs,
 * the problems and the tile count of the latest validation, "Save" (the
 * page's one primary action) and "Cancel", and the messages. The YAML text is
 * the draft: the form sends its changes with `mosaics.edit` and shows the
 * fields `mosaics.validate` reads.
 */
export async function showEditMode(
  engine: ModEngine,
  start: EditStart,
): Promise<void> {
  const view = buildEditView(engine, start);
  const heading = document.createElement("h1");
  heading.textContent = start.heading;
  view.nodes.textarea.value = view.content;
  view.nodes.textarea.addEventListener(
    "input",
    handleTextInput.bind(undefined, view),
  );
  view.nodes.yamlPanel.append(view.nodes.textarea);
  view.nodes.formPanel.append(buildStatusMessage("Reading the draft…"));
  document.body.replaceChildren(
    heading,
    view.nodes.notice,
    buildTabList(view),
    view.nodes.formNote,
    view.nodes.formPanel,
    view.nodes.yamlPanel,
    view.nodes.problems,
    view.nodes.hints,
    buildActions(view),
    view.nodes.messages,
  );
  selectTab(view, "form");
  document.addEventListener("keydown", view.keyHandler);
  await Promise.all([offerKeptDraft(view), validateDraft(view)]);
}
