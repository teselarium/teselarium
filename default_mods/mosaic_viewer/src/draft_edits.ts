import type { MosaicShowLine } from "../../mod_api.d.ts";

/** A `show` line as the form holds it, possibly not filled in yet. */
export interface ShowRowValues {
  host: string;
  reason: string;
}

/** The names of an alias row, separated by commas: `"name, full_name"` gives `["name", "full_name"]`. */
export function readAliasNames(text: string): string[] {
  const names: string[] = [];
  for (const part of text.split(",")) {
    const name = part.trim();
    if (name !== "") {
      names.push(name);
    }
  }
  return names;
}

/** The `aliases` edit of the form's alias rows, by field: the rows with names, in row order. */
export function buildAliasesEdit(
  rows: readonly [string, string][],
): Record<string, string[]> {
  const aliases: Record<string, string[]> = {};
  for (const [field, text] of rows) {
    const names = readAliasNames(text);
    if (names.length > 0) {
      aliases[field] = names;
    }
  }
  return aliases;
}

/** The `show` edit of the form's rows: the rows with both a host and a reason, in row order. */
export function buildShowEdit(
  rows: readonly ShowRowValues[],
): MosaicShowLine[] {
  const lines: MosaicShowLine[] = [];
  for (const row of rows) {
    const host = row.host.trim();
    const reason = row.reason.trim();
    if (host !== "" && reason !== "") {
      lines.push({ host, reason });
    }
  }
  return lines;
}

/** The text of an optional field: an empty field removes its key. */
export function readOptionalText(value: string): string | null {
  const text = value.trim();
  return text === "" ? null : text;
}
