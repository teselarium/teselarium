import type { YamlValue } from "../files/index.ts";
import type { LoadedMosaic } from "../mosaic/index.ts";

/** A top-level field of a mosaic that the save confirmation compares as text. */
export type MosaicTextField = "title" | "description" | "mod" | "collection";

/** One change of a draft against its saved version, as the save confirmation lists it. */
export type MosaicChange =
  | {
      kind: "field";
      field: MosaicTextField;
      before: string | null;
      after: string | null;
    }
  | {
      kind: "alias";
      field: string;
      before: string[] | null;
      after: string[] | null;
    }
  | {
      kind: "config";
      key: string;
      before: YamlValue | null;
      after: YamlValue | null;
    }
  | {
      kind: "show";
      change: "added" | "removed";
      host: string;
      reason: string;
    };

const TEXT_FIELDS: readonly MosaicTextField[] = [
  "title",
  "description",
  "mod",
  "collection",
];

function readTextField(
  mosaic: LoadedMosaic | null,
  field: MosaicTextField,
): string | null {
  if (mosaic === null) {
    return null;
  }
  const value = mosaic[field];
  if (value === "" || value === null) {
    return null;
  }
  return value;
}

function isSameValue(first: unknown, second: unknown): boolean {
  return JSON.stringify(first) === JSON.stringify(second);
}

function listKeys(
  saved: Record<string, unknown> | null,
  draft: Record<string, unknown>,
): string[] {
  const keys = new Set<string>(Object.keys(saved ?? {}));
  for (const key of Object.keys(draft)) {
    keys.add(key);
  }
  const allKeys = [...keys];
  return allKeys;
}

function listFieldChanges(
  saved: LoadedMosaic | null,
  draft: LoadedMosaic,
): MosaicChange[] {
  const changes: MosaicChange[] = [];
  for (const field of TEXT_FIELDS) {
    const before = readTextField(saved, field);
    const after = readTextField(draft, field);
    if (before !== after) {
      changes.push({ kind: "field", field, before, after });
    }
  }
  return changes;
}

function listAliasChanges(
  saved: LoadedMosaic | null,
  draft: LoadedMosaic,
): MosaicChange[] {
  const changes: MosaicChange[] = [];
  const savedAliases = saved?.aliases ?? null;
  for (const field of listKeys(savedAliases, draft.aliases)) {
    const before = savedAliases?.[field] ?? null;
    const after = draft.aliases[field] ?? null;
    if (!isSameValue(before, after)) {
      changes.push({ kind: "alias", field, before, after });
    }
  }
  return changes;
}

function listConfigChanges(
  saved: LoadedMosaic | null,
  draft: LoadedMosaic,
): MosaicChange[] {
  const changes: MosaicChange[] = [];
  const savedConfig = saved?.config ?? null;
  for (const key of listKeys(savedConfig, draft.config)) {
    const before = savedConfig?.[key] ?? null;
    const after = draft.config[key] ?? null;
    if (!isSameValue(before, after)) {
      changes.push({ kind: "config", key, before, after });
    }
  }
  return changes;
}

function hasShowLine(
  mosaic: LoadedMosaic | null,
  host: string,
  reason: string,
): boolean {
  for (const line of mosaic?.permissions ?? []) {
    if (line.host === host && line.reason === reason) {
      return true;
    }
  }
  return false;
}

function listShowChanges(
  saved: LoadedMosaic | null,
  draft: LoadedMosaic,
): MosaicChange[] {
  const changes: MosaicChange[] = [];
  for (const line of draft.permissions) {
    if (!hasShowLine(saved, line.host, line.reason)) {
      changes.push({
        kind: "show",
        change: "added",
        host: line.host,
        reason: line.reason,
      });
    }
  }
  for (const line of saved?.permissions ?? []) {
    if (!hasShowLine(draft, line.host, line.reason)) {
      changes.push({
        kind: "show",
        change: "removed",
        host: line.host,
        reason: line.reason,
      });
    }
  }
  return changes;
}

/**
 * What a draft changes from its saved version, or, for a new mosaic
 * (`saved` `null`), all it holds: the title, description, mod and
 * collection, the aliases by field, the config by top-level key, and each
 * `show` line, by host and reason, added or removed.
 */
export function diffMosaics(
  saved: LoadedMosaic | null,
  draft: LoadedMosaic,
): MosaicChange[] {
  const changes = [
    ...listFieldChanges(saved, draft),
    ...listAliasChanges(saved, draft),
    ...listConfigChanges(saved, draft),
    ...listShowChanges(saved, draft),
  ];
  return changes;
}
