import type { ModYamlMapping, ModYamlValue } from "../../mod_api.d.ts";
import { isWebAddress } from "./metadata_addresses.ts";
import { buildMetadataLink } from "./metadata_link.ts";

/** A list value as a `<ul>`, each item drawn as a value of its own. */
function buildValueList(values: ModYamlValue[]): HTMLElement {
  const list = document.createElement("ul");
  for (const value of values) {
    const item = document.createElement("li");
    item.append(buildMetadataValue(value));
    list.append(item);
  }
  return list;
}

function isMapping(value: ModYamlValue): value is ModYamlMapping {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** A value: a nested list for a mapping, a `<ul>` for a list, a link for a web address, text otherwise. */
function buildMetadataValue(value: ModYamlValue): Node {
  if (Array.isArray(value)) {
    return buildValueList(value);
  }
  if (isMapping(value)) {
    return buildMetadataList(value);
  }
  if (typeof value === "string" && isWebAddress(value)) {
    return buildMetadataLink(value);
  }
  return document.createTextNode(String(value));
}

/**
 * The metadata as a `<dl>` in frontmatter order: each key, then its value,
 * the two in a `<div>`, so a field can be hidden as one element.
 */
export function buildMetadataList(metadata: ModYamlMapping): HTMLElement {
  const list = document.createElement("dl");
  for (const [key, value] of Object.entries(metadata)) {
    const term = document.createElement("dt");
    term.textContent = key;
    const description = document.createElement("dd");
    description.append(buildMetadataValue(value));
    const field = document.createElement("div");
    field.append(term, description);
    list.append(field);
  }
  return list;
}
