import type {
  ModGrants,
  ModPermission,
  MosaicInspection,
} from "../../mod_api.d.ts";
import { buildConfigText } from "./config_text.ts";
import {
  addDefinition,
  buildBadge,
  buildCell,
  buildTitledSection,
} from "./page_elements.ts";

/** The column headings of the permission table. */
const PERMISSION_COLUMNS = ["Category", "Host", "Reason", "Status"];

/** The mosaic itself as a card: an `<article>` with its title, description and source. */
export function buildMosaicCard(inspection: MosaicInspection): HTMLElement {
  const card = document.createElement("article");
  const heading = document.createElement("h1");
  heading.textContent = inspection.title;
  const details = document.createElement("dl");
  addDefinition(details, "Description", inspection.description || "(none)");
  addDefinition(details, "Source", inspection.source);
  card.append(heading, details);
  return card;
}

/** "Config": the mosaic's own overrides as indented `key: value` lines. */
export function buildConfigSection(inspection: MosaicInspection): HTMLElement {
  const section = buildTitledSection("Config");
  section.append(buildConfigText(inspection.config));
  return section;
}

/** "Aliases": a `field ← name, name` line for each field the aliases rename. */
export function buildAliasesSection(inspection: MosaicInspection): HTMLElement {
  const section = buildTitledSection("Aliases");
  const entries = Object.entries(inspection.aliases);
  if (entries.length === 0) {
    const none = document.createElement("p");
    none.textContent = "(none)";
    section.append(none);
    return section;
  }
  const list = document.createElement("ul");
  for (const [field, names] of entries) {
    const item = document.createElement("li");
    item.textContent = `${field} ← ${names.join(", ")}`;
    list.append(item);
  }
  section.append(list);
  return section;
}

function buildPermissionRow(
  permission: ModPermission,
  isGranted: boolean,
): HTMLElement {
  const row = document.createElement("tr");
  const status = isGranted
    ? buildBadge("granted", "success")
    : buildBadge("not granted", "outline");
  row.append(
    buildCell("td", permission.category),
    buildCell("td", permission.host),
    buildCell("td", permission.reason),
    buildCell("td", status),
  );
  return row;
}

function buildPermissionRows(permissions: ModGrants): HTMLElement[] {
  const rows: HTMLElement[] = [];
  for (const permission of permissions.granted) {
    rows.push(buildPermissionRow(permission, true));
  }
  for (const permission of permissions.denied) {
    rows.push(buildPermissionRow(permission, false));
  }
  return rows;
}

/** The `show` lines as a plain `<table>`, each with a badge saying whether it would be granted, as the mod viewer draws permissions. */
function buildPermissionTable(permissions: ModGrants): HTMLElement {
  const rows = buildPermissionRows(permissions);
  if (rows.length === 0) {
    const none = document.createElement("p");
    none.textContent = "(none)";
    return none;
  }
  const header = document.createElement("tr");
  for (const label of PERMISSION_COLUMNS) {
    header.append(buildCell("th", label));
  }
  const table = document.createElement("table");
  const head = document.createElement("thead");
  head.append(header);
  const body = document.createElement("tbody");
  body.append(...rows);
  table.append(head, body);
  return table;
}

/** "Permissions": the mosaic's `show` lines. */
export function buildPermissionsSection(
  inspection: MosaicInspection,
): HTMLElement {
  const section = buildTitledSection("Permissions");
  section.append(buildPermissionTable(inspection.permissions));
  return section;
}
