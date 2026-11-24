import type { CaseContext, CaseRequest } from "../../mod_api.d.ts";
import { listOwnLookDeclarations, readTokenAs } from "./look_probes.ts";

/**
 * The fixture mod the cases list, by its address in the default mods
 * folder: a case has no mod source to resolve against (default_mods/README.md).
 */
const LISTED_MOD_REFERENCE = "./default_mods/mod_explorer/fixtures/listed_mod";

/** The end of the listed mod's source, whatever the app's address. */
const LISTED_MOD_FILE_PATH =
  "/default_mods/mod_explorer/fixtures/listed_mod/mod_conf.yaml";

/** A fixture path with no mod, which `mods.inspect` answers with an error. */
const MISSING_MOD_REFERENCE =
  "./default_mods/mod_explorer/fixtures/missing_mod";

/** The viewer of the explorer's own config. */
const CONFIG_VIEWER = "mod_viewer";

/** Answers `catalog.list` with `sources` as the catalog's mods, then mounts the explorer. */
function mountWithMods(context: CaseContext, sources: string[]): Promise<void> {
  const mods: { source: string }[] = [];
  for (const source of sources) {
    mods.push({ source });
  }
  context.answer("catalog.list", { mods });
  const mounting = context.mount();
  return mounting;
}

function findElement(context: CaseContext, selector: string): HTMLElement {
  const element = context.root.querySelector<HTMLElement>(selector);
  if (element === null) {
    throw new Error(`The explorer draws no element matching "${selector}".`);
  }
  return element;
}

function findRequest(
  context: CaseContext,
  method: string,
): CaseRequest | undefined {
  for (const request of context.requests) {
    if (request.method === method) {
      return request;
    }
  }
  return undefined;
}

/** The source the explorer got from `mods.inspect` for the listed mod. */
function readInspectedSource(context: CaseContext): string {
  const inspectRequest = findRequest(context, "mods.inspect");
  const result = inspectRequest?.result as { source?: unknown } | undefined;
  if (typeof result?.source !== "string") {
    throw new Error("The explorer's mods.inspect has no source in its result.");
  }
  return result.source;
}

export async function listsModsAsCards(context: CaseContext): Promise<void> {
  await mountWithMods(context, [LISTED_MOD_REFERENCE]);

  const card = findElement(context, "li > article");
  context.expect(card.querySelector("h2")?.textContent).toBe("Listed Mod");
  context
    .expect(card.querySelector("p")?.textContent)
    .toBe("A fixture mod that the explorer's tests list.");
  const viewButton = card.querySelector("button");
  context.expect(viewButton?.textContent).toBe("View");
  context.expect(viewButton?.ariaLabel).toBe("View Listed Mod");
  context
    .expect(findElement(context, 'section[aria-label="Mods"]').ariaBusy)
    .toBe(null);
}

export async function listsFailureAsAlert(context: CaseContext): Promise<void> {
  await mountWithMods(context, [MISSING_MOD_REFERENCE]);

  const alert = findElement(context, 'li > [role="alert"]');
  context
    .expect(alert.querySelector("code")?.textContent)
    .toBe(MISSING_MOD_REFERENCE);
  context.expect(alert.textContent).toContain("404");
}

function findOpenRequest(context: CaseContext): CaseRequest | undefined {
  const openRequest = findRequest(context, "mods.open");
  if (openRequest === undefined || !("result" in openRequest)) {
    return undefined;
  }
  return openRequest;
}

export async function opensViewerForSelectedMod(
  context: CaseContext,
): Promise<void> {
  await mountWithMods(context, [LISTED_MOD_REFERENCE]);
  context.answer("mods.open", null);

  findElement(context, "article button").click();

  const openRequest = await context.waitFor(
    findOpenRequest.bind(undefined, context),
  );
  const inspectedSource = readInspectedSource(context);
  context.expect(inspectedSource.endsWith(LISTED_MOD_FILE_PATH)).toBe(true);
  context.expect(openRequest.params).toEqual({
    mod: CONFIG_VIEWER,
    params: { target: inspectedSource },
  });
  context.expect(findElement(context, '[role="status"]').textContent).toBe("");
}

export async function keepsOwnStylesToLayout(
  context: CaseContext,
): Promise<void> {
  await mountWithMods(context, [LISTED_MOD_REFERENCE]);

  context.expect(listOwnLookDeclarations()).toEqual([]);
}

export async function drawsCardBackground(context: CaseContext): Promise<void> {
  await mountWithMods(context, [LISTED_MOD_REFERENCE]);

  const card = findElement(context, "li > article");
  context
    .expect(getComputedStyle(card).backgroundColor)
    .toBe(readTokenAs("--tes-card", "color"));
}
