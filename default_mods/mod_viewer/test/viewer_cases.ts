import type { CaseContext } from "../../mod_api.d.ts";
import {
  FIXTURE_REFERENCES,
  findElement,
  mountWithTarget,
  readBadge,
  readDefinition,
} from "./case_helpers.ts";

/** The end of the listed mod's source, whatever the app's address. */
const LISTED_MOD_FILE_PATH =
  "/default_mods/mod_viewer/fixtures/listed_mod/mod_conf.yaml";

/** The end of the listed mod's sample collection, which is never fetched. */
const LISTED_MOD_COLLECTION_PATH =
  "/default_mods/mod_viewer/fixtures/listed_mod/collection.yaml";

export async function showsTargetMetadata(context: CaseContext): Promise<void> {
  await mountWithTarget(context, FIXTURE_REFERENCES.listedMod);

  context
    .expect(findElement(context, "header h1").textContent)
    .toBe("Listed Mod");
  context
    .expect(readBadge(context.root.querySelector("header span")))
    .toEqual({ text: "1.0.0", variant: "secondary" });
  context
    .expect(readDefinition(context, "Description").textContent)
    .toBe("A fixture mod that the viewer's tests show.");
  context
    .expect(readDefinition(context, "Name").textContent)
    .toBe("listed_mod");
  context
    .expect(
      readDefinition(context, "Source").textContent?.endsWith(
        LISTED_MOD_FILE_PATH,
      ),
    )
    .toBe(true);
  context
    .expect(readDefinition(context, "Tile type").textContent)
    .toBe("(none)");
  context
    .expect(
      readDefinition(context, "Sample collection").textContent?.endsWith(
        LISTED_MOD_COLLECTION_PATH,
      ),
    )
    .toBe(true);
  context
    .expect(readDefinition(context, "Config").textContent)
    .toBe('show_covers: true\nshelves:\n  - "fiction"');
}

export async function marksMatchingApiRange(
  context: CaseContext,
): Promise<void> {
  await mountWithTarget(context, FIXTURE_REFERENCES.listedMod);

  const apiRange = readDefinition(context, "API range");
  context.expect(apiRange.querySelector("code")?.textContent).toBe("^0.1.0");
  context
    .expect(readBadge(apiRange.querySelector("span[data-ot-variant]")))
    .toEqual({ text: "matches", variant: "success" });
}

export async function marksOtherApiRange(context: CaseContext): Promise<void> {
  await mountWithTarget(context, FIXTURE_REFERENCES.otherApi);

  const apiRange = readDefinition(context, "API range");
  context.expect(apiRange.querySelector("code")?.textContent).toBe("^0.2.0");
  context
    .expect(readBadge(apiRange.querySelector("span[data-ot-variant]")))
    .toEqual({ text: "does not match", variant: "warning" });
  context
    .expect(
      /This app has mod API \d+\.\d+\.\d+\.$/.test(apiRange.textContent ?? ""),
    )
    .toBe(true);
}

export async function saysNoApiRange(context: CaseContext): Promise<void> {
  await mountWithTarget(context, FIXTURE_REFERENCES.noRange);

  context
    .expect(readDefinition(context, "API range").textContent)
    .toBe("The mod declares no API range.");
}

function expectNoModGiven(context: CaseContext): void {
  context
    .expect(findElement(context, '[role="status"]').textContent)
    .toBe("No mod was given.");
  context.expect(context.requests.length).toBe(0);
}

export async function saysNoTarget(context: CaseContext): Promise<void> {
  await context.mount({ params: {} });

  expectNoModGiven(context);
}

export async function saysEmptyTarget(context: CaseContext): Promise<void> {
  await mountWithTarget(context, "");

  expectNoModGiven(context);
}

export async function showsMissingTargetError(
  context: CaseContext,
): Promise<void> {
  await mountWithTarget(context, FIXTURE_REFERENCES.missingMod);

  context
    .expect(findElement(context, '[role="alert"]').textContent)
    .toContain("404");
}

export async function showsTargetFormatError(
  context: CaseContext,
): Promise<void> {
  await mountWithTarget(context, FIXTURE_REFERENCES.badTheme);

  context
    .expect(findElement(context, '[role="alert"]').textContent)
    .toContain('"theme" must be "default" or "none"');
}
