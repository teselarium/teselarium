import type {
  ModGrants,
  ModInspection,
  ModPermission,
} from "../../mod_api.d.ts";
import { buildConfigText } from "./config_text.ts";
import { buildBadge, buildCell } from "./page_elements.ts";

/** The column headings of the permission table. */
const PERMISSION_COLUMNS = ["Category", "Host", "Reason", "Status"];

function buildPermissionRow(
  permission: ModPermission,
  isGranted: boolean,
): HTMLElement {
  const row = document.createElement("tr");
  row.setAttribute("role", "row");
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

/** The declared permissions as a plain `<table>`, each with a badge saying whether it would be granted. */
function buildPermissionTable(permissions: ModGrants): HTMLElement {
  const rows = buildPermissionRows(permissions);
  if (rows.length === 0) {
    const none = document.createElement("p");
    none.textContent = "(none)";
    return none;
  }
  const header = document.createElement("tr");
  header.setAttribute("role", "row");
  for (const label of PERMISSION_COLUMNS) {
    header.append(buildCell("th", label));
  }
  const table = document.createElement("table");
  table.setAttribute("role", "table");
  const head = document.createElement("thead");
  head.setAttribute("role", "rowgroup");
  head.append(header);
  const body = document.createElement("tbody");
  body.setAttribute("role", "rowgroup");
  body.append(...rows);
  table.append(head, body);
  return table;
}

/**
 * The mod's `api` range with a badge telling whether it matches the app's mod
 * API version, which is shown too when it does not.
 */
function buildApiRangeDescription(
  inspection: ModInspection,
  apiVersion: string,
): HTMLElement {
  const description = document.createElement("span");
  if (inspection.api === null) {
    description.textContent = "The mod declares no API range.";
    return description;
  }
  const range = document.createElement("code");
  range.textContent = inspection.api;
  if (inspection.apiCompatible) {
    description.append(range, " ", buildBadge("matches", "success"));
    return description;
  }
  description.append(
    range,
    " ",
    buildBadge("does not match", "warning"),
    ` This app has mod API ${apiVersion}.`,
  );
  return description;
}

function addDefinition(
  list: HTMLElement,
  term: string,
  description: string | Node,
): void {
  const termElement = document.createElement("dt");
  termElement.textContent = term;
  const descriptionElement = document.createElement("dd");
  descriptionElement.append(description);
  list.append(termElement, descriptionElement);
}

function buildMetadataList(
  inspection: ModInspection,
  apiVersion: string,
): HTMLElement {
  const list = document.createElement("dl");
  addDefinition(list, "Title", inspection.title);
  addDefinition(list, "Description", inspection.description);
  addDefinition(list, "Source", inspection.source);
  addDefinition(
    list,
    "API range",
    buildApiRangeDescription(inspection, apiVersion),
  );
  addDefinition(list, "Tile type", inspection.typeSource ?? "(none)");
  addDefinition(list, "Default mosaic", inspection.defaultMosaic ?? "(none)");
  addDefinition(list, "Config", buildConfigText(inspection.config));
  return list;
}

/** The mod's metadata and permissions as a card: an `<article>`. */
export function buildMetadataCard(
  inspection: ModInspection,
  apiVersion: string,
): HTMLElement {
  const card = document.createElement("article");
  const permissionsHeading = document.createElement("h2");
  permissionsHeading.textContent = "Permissions";
  card.append(
    buildMetadataList(inspection, apiVersion),
    permissionsHeading,
    buildPermissionTable(inspection.permissions),
  );
  return card;
}

/** The title with the version as a secondary badge. */
export function buildHeader(inspection: ModInspection): HTMLElement {
  const header = document.createElement("header");
  const heading = document.createElement("h1");
  heading.textContent = inspection.title;
  header.append(heading, buildBadge(inspection.version, "secondary"));
  return header;
}
