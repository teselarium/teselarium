import type { CaseContext, CaseRequest } from "../../mod_api.d.ts";
import {
  clickButton,
  FIXTURE_PATHS,
  FIXTURE_REFERENCES,
  findButton,
  findElement,
  findRequests,
  findSettledRequest,
} from "./case_helpers.ts";

/** How long edit mode's validation may take: its half-second pause, then the loads. */
const VALIDATION_TIMEOUT_MS = 6000;

/** A fixture's address, resolved against the app's address, as a link gives it. */
function resolveFixture(reference: string): string {
  return new URL(reference, document.baseURI).href;
}

function mountInMode(
  context: CaseContext,
  params: Record<string, string>,
): Promise<void> {
  return context.mount({ params });
}

/** Mounts edit mode for a copy of the shown fixture mosaic. */
function mountCopy(context: CaseContext): Promise<void> {
  return mountInMode(context, {
    target: FIXTURE_REFERENCES.shownMosaic,
    mode: "copy",
  });
}

/** Mounts edit mode for a new mosaic of the typed fixture mod on the fixture collection. */
function mountNewTypedMosaic(context: CaseContext): Promise<void> {
  return mountInMode(context, {
    mode: "new",
    draft_mod: resolveFixture(FIXTURE_REFERENCES.typedMod),
    draft_collection: resolveFixture(FIXTURE_REFERENCES.fixtureCollection),
  });
}

function readTextarea(context: CaseContext): HTMLTextAreaElement {
  return findElement(
    context,
    'textarea[name="content"]',
  ) as HTMLTextAreaElement;
}

function readHeading(context: CaseContext): string {
  return findElement(context, "h1").textContent ?? "";
}

function readHints(context: CaseContext): string {
  return (
    findElement(context, "#draft-yaml ~ div [role=status]").textContent ?? ""
  );
}

/** The input of the Form tab named `name`, once the form is drawn. */
function findFormInput(
  context: CaseContext,
  name: string,
): HTMLInputElement | null {
  return context.root.querySelector<HTMLInputElement>(
    `#draft-form input[name="${name}"]`,
  );
}

/** Types `text` in the YAML tab, as the user does. */
function typeYaml(context: CaseContext, text: string): void {
  clickButton(context, "YAML");
  const textarea = readTextarea(context);
  textarea.value = text;
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
}

/** Changes a field of the Form tab, as the user does when leaving it. */
function changeField(input: HTMLInputElement, value: string): void {
  input.value = value;
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function hasSettledValidation(context: CaseContext): boolean {
  for (const request of findRequests(context, "mosaics.validate")) {
    if ("result" in request || "error" in request) {
      return true;
    }
  }
  return false;
}

function waitForValidation(context: CaseContext): Promise<true> {
  return context.waitFor(
    hasSettledValidation.bind(undefined, context),
    VALIDATION_TIMEOUT_MS,
  );
}

function readMatchingCount(context: CaseContext): string | null {
  const hints = context.root.querySelector("#draft-yaml ~ div [role=status]");
  const text = hints?.textContent ?? "";
  return text.includes("tiles match") ? text : null;
}

function hasHints(context: CaseContext, expected: string): boolean {
  return readMatchingCount(context) === expected;
}

function readAlert(context: CaseContext): string | null {
  return context.root.querySelector('[role="alert"]')?.textContent ?? null;
}

function findEditRequest(
  context: CaseContext,
  key: string,
): CaseRequest | undefined {
  for (const request of findRequests(context, "mosaics.edit")) {
    const edits = request.params.edits as Record<string, unknown> | undefined;
    if (
      edits !== undefined &&
      Object.hasOwn(edits, key) &&
      "result" in request
    ) {
      return request;
    }
  }
  return undefined;
}

export async function editsCopyOfMosaic(context: CaseContext): Promise<void> {
  await context.mount({ params: { target: FIXTURE_REFERENCES.shownMosaic } });
  const editButton = await context.waitFor(
    findButton.bind(undefined, context, "Edit a copy"),
  );

  editButton.click();

  await context.waitFor(findFormInput.bind(undefined, context, "title"));
  context.expect(readHeading(context)).toBe('Copy of "Shown mosaic"');
  context
    .expect(readTextarea(context).value)
    .toContain(FIXTURE_PATHS.fixtureMod);
  context
    .expect(readTextarea(context).value)
    .toContain(FIXTURE_PATHS.fixtureCollection);
  context.expect(readTextarea(context).value).toContain("columns: 8");
}

export async function startsCopyFromLink(context: CaseContext): Promise<void> {
  await mountCopy(context);

  await context.waitFor(findFormInput.bind(undefined, context, "title"));
  context.expect(readHeading(context)).toBe('Copy of "Shown mosaic"');
  context.expect(findFormInput(context, "title")?.value).toBe("Shown mosaic");
}

export async function refusesEditOfRemoteMosaic(
  context: CaseContext,
): Promise<void> {
  await mountInMode(context, {
    target: FIXTURE_REFERENCES.shownMosaic,
    mode: "edit",
  });

  context
    .expect(readAlert(context))
    .toBe(
      'Only mosaics stored in this browser can be edited. Use "Edit a copy" to save a copy of your own.',
    );
  context.expect(findButton(context, "Edit a copy")).toBeTruthy();
  context
    .expect(findElement(context, "article h1").textContent)
    .toBe("Shown mosaic");
}

export async function refusesUnknownMode(context: CaseContext): Promise<void> {
  await mountInMode(context, {
    target: FIXTURE_REFERENCES.shownMosaic,
    mode: "draw",
  });

  context
    .expect(readAlert(context))
    .toBe('The mode "draw" is not one of edit, copy, new.');
}

export async function startsNewMosaic(context: CaseContext): Promise<void> {
  await mountNewTypedMosaic(context);

  await context.waitFor(findFormInput.bind(undefined, context, "title"));
  context.expect(readHeading(context)).toBe("New mosaic");
  const text = readTextarea(context).value;
  context.expect(text).toContain('title: "Untitled mosaic"');
  context
    .expect(text)
    .toContain("/default_mods/mosaic_viewer/fixtures/typed_mod");
  context.expect(text).toContain(FIXTURE_PATHS.fixtureCollection);
}

export async function aliasesFromSuggestion(
  context: CaseContext,
): Promise<void> {
  await mountNewTypedMosaic(context);
  await context.waitFor(
    hasHints.bind(undefined, context, "0 of 2 tiles match"),
    VALIDATION_TIMEOUT_MS,
  );
  const suggestions = context.root.querySelectorAll(
    "#collection-fields option",
  );
  context.expect(suggestions[0]?.getAttribute("value")).toBe("name");
  const row = await context.waitFor(
    findFormInput.bind(undefined, context, "alias-title"),
  );

  changeField(row, "name");

  const edit = await context.waitFor(
    findEditRequest.bind(undefined, context, "aliases"),
  );
  context.expect(edit.params.edits).toEqual({ aliases: { title: ["name"] } });
  context.expect(readTextarea(context).value).toContain('title: ["name"]');
  await context.waitFor(
    hasHints.bind(undefined, context, "2 of 2 tiles match"),
    VALIDATION_TIMEOUT_MS,
  );
}

function readFormTabDisabled(context: CaseContext): boolean {
  const tab = context.root.querySelector<HTMLButtonElement>("#draft-form-tab");
  return tab?.disabled === true;
}

function findLineProblem(context: CaseContext): string | null {
  const problems = context.root.querySelector('ul[aria-label="Problems"]');
  const text = problems?.textContent ?? "";
  return text.includes("Line 3") ? text : null;
}

export async function showsBrokenYaml(context: CaseContext): Promise<void> {
  await mountCopy(context);
  await waitForValidation(context);

  typeYaml(context, 'mosaic:\n  title: "Broken"\n\tmod: "mod_viewer"\n');

  const problem = await context.waitFor(
    findLineProblem.bind(undefined, context),
    VALIDATION_TIMEOUT_MS,
  );
  context.expect(problem).toContain("tab");
  context.expect(readFormTabDisabled(context)).toBe(true);
  context
    .expect(findElement(context, "#draft-form-tab").textContent)
    .toBe("Form");
  context
    .expect(context.root.textContent)
    .toContain("The form is unavailable until the YAML can be read");
}

function hasMoreRequests(
  context: CaseContext,
  method: string,
  count: number,
): boolean {
  return findRequests(context, method).length > count;
}

function hasDraftText(context: CaseContext, text: string): boolean {
  return readTextarea(context).value.includes(text);
}

function hasTitleHint(context: CaseContext, title: string): boolean {
  return findFormInput(context, "title")?.value === title;
}

export async function ignoresStaleValidation(
  context: CaseContext,
): Promise<void> {
  await mountCopy(context);
  await waitForValidation(context);
  const sent = findRequests(context, "mosaics.validate").length;

  typeYaml(context, 'mosaic:\n  title: "First"\n  mod: "mod_viewer"\n');
  await context.waitFor(
    hasMoreRequests.bind(undefined, context, "mosaics.validate", sent),
    VALIDATION_TIMEOUT_MS,
  );
  typeYaml(context, 'mosaic:\n  title: "Second"\n  mod: "mod_viewer"\n');
  clickButton(context, "Form");

  await context.waitFor(
    hasTitleHint.bind(undefined, context, "Second"),
    VALIDATION_TIMEOUT_MS,
  );
  context.expect(findFormInput(context, "title")?.value).toBe("Second");
}

export async function restoresKeptDraft(context: CaseContext): Promise<void> {
  const source = resolveFixture(FIXTURE_REFERENCES.shownMosaic);
  const kept = 'mosaic:\n  title: "Kept title"\n  mod: "mod_viewer"\n';
  await context.storage.set(`draft:copy:${source}`, kept);
  await mountCopy(context);

  const restoreButton = await context.waitFor(
    findButton.bind(undefined, context, "Restore draft"),
  );
  context.expect(findButton(context, "Discard")).toBeTruthy();
  restoreButton.click();

  await context.waitFor(
    hasTitleHint.bind(undefined, context, "Kept title"),
    VALIDATION_TIMEOUT_MS,
  );
  context.expect(readTextarea(context).value).toBe(kept);
  context.expect(findButton(context, "Restore draft")).toBe(null);
}

export async function asksBeforeCancel(context: CaseContext): Promise<void> {
  await mountCopy(context);
  await waitForValidation(context);
  typeYaml(context, 'mosaic:\n  title: "Changed"\n  mod: "mod_viewer"\n');
  context.answer("ui.confirm", false);

  clickButton(context, "Cancel");

  const confirm = await context.waitFor(
    findSettledRequest.bind(undefined, context, "ui.confirm"),
  );
  context.expect(confirm.result).toBe(false);
  context.expect(readHeading(context)).toBe('Copy of "Shown mosaic"');
}

export async function leavesWithoutChanges(
  context: CaseContext,
): Promise<void> {
  await mountCopy(context);
  await context.waitFor(findFormInput.bind(undefined, context, "title"));

  clickButton(context, "Cancel");

  await context.waitFor(findButton.bind(undefined, context, "Open mosaic"));
  context.expect(findRequests(context, "ui.confirm")).toEqual([]);
}

/** The address a case answers `userCatalog.save` with: a fixture, which nothing opens. */
const SAVED_FIXTURE_ADDRESS =
  "opentesela-browser:///fixture/shown_mosaic_copy.yaml";

export async function savesCopy(context: CaseContext): Promise<void> {
  await mountCopy(context);
  const title = await context.waitFor(
    findFormInput.bind(undefined, context, "title"),
  );
  context.answer("userCatalog.save", SAVED_FIXTURE_ADDRESS);
  context.answer("mods.open", null);

  changeField(title, "My copy");
  await context.waitFor(
    hasDraftText.bind(undefined, context, 'title: "My copy"'),
  );
  clickButton(context, "Save");

  const save = await context.waitFor(
    findSettledRequest.bind(undefined, context, "userCatalog.save"),
  );
  context
    .expect(findEditRequest(context, "title")?.params.edits)
    .toEqual({ title: "My copy" });
  context
    .expect(save.params.copiedFrom)
    .toBe(resolveFixture(FIXTURE_REFERENCES.shownMosaic));
  context.expect(save.params.content).toContain('title: "My copy"');
  context.expect(save.params.mosaic).toBe(undefined);
  const open = await context.waitFor(
    findSettledRequest.bind(undefined, context, "mods.open"),
  );
  context.expect(open.params.params).toEqual({ target: SAVED_FIXTURE_ADDRESS });
  context.expect(open.params.replace).toBe(true);
}

export async function keepsEditModeWhenNotSaved(
  context: CaseContext,
): Promise<void> {
  await mountCopy(context);
  await context.waitFor(findFormInput.bind(undefined, context, "title"));

  document.dispatchEvent(
    new KeyboardEvent("keydown", { key: "s", ctrlKey: true, bubbles: true }),
  );

  const save = await context.waitFor(
    findSettledRequest.bind(undefined, context, "userCatalog.save"),
  );
  context.expect(save.result).toBe(null);
  context.expect(readHeading(context)).toBe('Copy of "Shown mosaic"');
  context.expect(findButton(context, "Save")?.disabled).toBe(false);
}

export async function showsHints(context: CaseContext): Promise<void> {
  await mountNewTypedMosaic(context);

  await context.waitFor(
    hasHints.bind(undefined, context, "0 of 2 tiles match"),
    VALIDATION_TIMEOUT_MS,
  );
  context.expect(readHints(context)).toBe("0 of 2 tiles match");
  context
    .expect(
      findElement(
        context,
        '#draft-form label input[name="alias-title"]',
      ).closest("label")?.textContent,
    )
    .toContain("title (required)");
}
