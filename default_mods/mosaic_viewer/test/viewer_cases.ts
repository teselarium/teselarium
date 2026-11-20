import type { CaseContext } from "../../mod_api.d.ts";
import {
  FIXTURE_PATHS,
  FIXTURE_REFERENCES,
  findButton,
  findElement,
  findSection,
  listTexts,
  mountWithTarget,
  readBadge,
  readDefinition,
  listWrongTableRoles,
} from "./case_helpers.ts";

function listRequestMethods(context: CaseContext): string[] {
  const methods: string[] = [];
  for (const request of context.requests) {
    methods.push(request.method);
  }
  return methods;
}

export async function showsTargetMosaic(context: CaseContext): Promise<void> {
  await mountWithTarget(context, FIXTURE_REFERENCES.shownMosaic);

  const card = findElement(context, "article");
  context.expect(card.querySelector("h1")?.textContent).toBe("Shown mosaic");
  context
    .expect(readDefinition(card, "Description").textContent)
    .toBe("A fixture mosaic that the viewer's tests show.");
  context
    .expect(
      readDefinition(card, "Source").textContent?.endsWith(
        FIXTURE_PATHS.shownMosaic,
      ),
    )
    .toBe(true);
  context
    .expect(findSection(context, "Config").querySelector("pre")?.textContent)
    .toBe("columns: 8");
  context
    .expect(listTexts(findSection(context, "Aliases").querySelectorAll("li")))
    .toEqual(["title ← name, label"]);
  context
    .expect(listRequestMethods(context).sort())
    .toEqual(["collections.inspect", "mods.inspect", "mosaics.inspect"]);
}

export async function showsPermissionBadges(
  context: CaseContext,
): Promise<void> {
  await mountWithTarget(context, FIXTURE_REFERENCES.shownMosaic);

  const cells = findSection(context, "Permissions").querySelectorAll(
    "tbody tr td",
  );
  context.expect(cells.length).toBe(4);
  context.expect(cells[0].textContent).toBe("show");
  context.expect(cells[1].textContent).toBe("https://images.example.org");
  context.expect(cells[2].textContent).toBe("Shows the fixture images");
  context
    .expect(readBadge(cells[3].querySelector("span")))
    .toEqual({ text: "granted", variant: "success" });
}

export async function showsTargetMod(context: CaseContext): Promise<void> {
  await mountWithTarget(context, FIXTURE_REFERENCES.shownMosaic);

  const modSection = findSection(context, "Mod");
  context
    .expect(
      readDefinition(modSection, "Title").querySelector("button")?.textContent,
    )
    .toBe("Fixture Mod");
  context
    .expect(readBadge(readDefinition(modSection, "Version").firstElementChild))
    .toEqual({ text: "2.0.0", variant: "secondary" });
  const apiRange = readDefinition(modSection, "API range");
  context.expect(apiRange.querySelector("code")?.textContent).toBe("^0.1.0");
  context
    .expect(readBadge(apiRange.querySelector("span[data-ot-variant]")))
    .toEqual({ text: "matches", variant: "success" });
  context.expect(modSection.ariaBusy).toBe(null);
}

export async function showsTargetCollection(
  context: CaseContext,
): Promise<void> {
  await mountWithTarget(context, FIXTURE_REFERENCES.shownMosaic);

  const collectionSection = findSection(context, "Collection");
  context
    .expect(
      readDefinition(collectionSection, "Title").querySelector("button")
        ?.textContent,
    )
    .toBe("Fixture collection");
  context
    .expect(readDefinition(collectionSection, "Tiles").textContent)
    .toBe("2 tiles");
  context.expect(collectionSection.ariaBusy).toBe(null);
}

export async function saysNoCollection(context: CaseContext): Promise<void> {
  await mountWithTarget(context, FIXTURE_REFERENCES.noCollection);

  context
    .expect(findSection(context, "Collection").querySelector("p")?.textContent)
    .toBe("This mosaic has no collection.");
  context
    .expect(findSection(context, "Config").querySelector("pre")?.textContent)
    .toBe("(none)");
  context
    .expect(findSection(context, "Aliases").querySelector("p")?.textContent)
    .toBe("(none)");
  context
    .expect(findSection(context, "Permissions").querySelector("p")?.textContent)
    .toBe("(none)");
}

export async function showsFailingCollection(
  context: CaseContext,
): Promise<void> {
  await mountWithTarget(context, FIXTURE_REFERENCES.missingCollection);

  const alert = findSection(context, "Collection").querySelector(
    '[role="alert"]',
  );
  context
    .expect(
      alert
        ?.querySelector("code")
        ?.textContent?.endsWith(FIXTURE_PATHS.missingCollection),
    )
    .toBe(true);
  context.expect(alert?.textContent).toContain("404");
  context
    .expect(findElement(context, "article h1").textContent)
    .toBe("Missing collection");
  context
    .expect(readDefinition(findSection(context, "Mod"), "Title").textContent)
    .toBe("Fixture Mod");
}

function expectNoMosaicGiven(context: CaseContext): void {
  context
    .expect(findElement(context, '[role="status"]').textContent)
    .toBe("No mosaic was given.");
  context.expect(context.requests.length).toBe(0);
  context.expect(findButton(context, "Open mosaic")).toBe(null);
  context.expect(findButton(context, "Check mosaic")).toBe(null);
}

export async function saysNoTarget(context: CaseContext): Promise<void> {
  await context.mount({ params: {} });

  expectNoMosaicGiven(context);
}

export async function saysEmptyTarget(context: CaseContext): Promise<void> {
  await mountWithTarget(context, "");

  expectNoMosaicGiven(context);
}

export async function showsMissingTargetError(
  context: CaseContext,
): Promise<void> {
  await mountWithTarget(context, FIXTURE_REFERENCES.missingMosaic);

  context
    .expect(findElement(context, '[role="alert"]').textContent)
    .toContain("404");
  context.expect(findButton(context, "Open mosaic")).toBe(null);
}

export async function showsTargetFormatError(
  context: CaseContext,
): Promise<void> {
  await mountWithTarget(context, FIXTURE_REFERENCES.untitledMosaic);

  context
    .expect(findElement(context, '[role="alert"]').textContent)
    .toContain('"title" must be a non-empty string');
}

export async function givesTableRoles(context: CaseContext): Promise<void> {
  await mountWithTarget(context, FIXTURE_REFERENCES.shownMosaic);

  const table = findElement(context, "table");
  context.expect(listWrongTableRoles(table)).toEqual([]);
}
