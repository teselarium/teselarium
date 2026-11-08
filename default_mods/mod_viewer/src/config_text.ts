import type { ModYamlMapping, ModYamlValue } from "../../mod_api.d.ts";

function formatScalar(value: ModYamlValue): string {
  if (typeof value === "string") {
    return JSON.stringify(value);
  }
  return String(value);
}

function isMapping(value: ModYamlValue): value is ModYamlMapping {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function addEntryLines(
  lines: string[],
  label: string,
  value: ModYamlValue,
  indent: string,
): void {
  if (isMapping(value) || Array.isArray(value)) {
    lines.push(`${indent}${label}`);
    addConfigLines(lines, value, `${indent}  `);
    return;
  }
  lines.push(`${indent}${label} ${formatScalar(value)}`);
}

/** Adds the config as indented `key: value` lines, and `- value` lines for lists. */
function addConfigLines(
  lines: string[],
  value: ModYamlMapping | ModYamlValue[],
  indent: string,
): void {
  if (Array.isArray(value)) {
    for (const item of value) {
      addEntryLines(lines, "-", item, indent);
    }
    return;
  }
  for (const [key, entryValue] of Object.entries(value)) {
    addEntryLines(lines, `${key}:`, entryValue, indent);
  }
}

/** The config as a `<pre>` of indented `key: value` lines, or "(none)". */
export function buildConfigText(config: ModYamlMapping): HTMLElement {
  const lines: string[] = [];
  addConfigLines(lines, config, "");
  const preformatted = document.createElement("pre");
  preformatted.textContent = lines.length === 0 ? "(none)" : lines.join("\n");
  return preformatted;
}
