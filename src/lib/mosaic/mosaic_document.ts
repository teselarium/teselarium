import { isMap, isScalar, isSeq, parseDocument, YAMLMap } from "yaml";
import type { Document, Node as YamlNode, YAMLSeq } from "yaml";
import { isYamlMapping, parseYaml, YamlParseError } from "../files/index.ts";
import type { YamlMapping } from "../files/index.ts";
import { isDefaultModName } from "../mod/index.ts";
import type { MosaicAliases } from "./mosaic_aliases.ts";
import { MosaicEditError, MosaicFormatError } from "./mosaic_errors.ts";
import { buildLoadedMosaic } from "./mosaic_loader.ts";

/**
 * The address a draft without one is read at. Relative references resolve
 * against it, so they can be read, but they name nothing a launch could load.
 */
export const DRAFT_ADDRESS = "opentesela-draft:///mosaic.yaml";

/** The default mods folder a draft's default mod name is read against when it is checked. */
const DRAFT_DEFAULT_MODS_FOLDER = "opentesela-draft:///default_mods/";

/** A `show` line of a draft, as the form edits it. */
export interface MosaicShowLine {
  host: string;
  reason: string;
}

/**
 * The form's edits of a draft. Each key is optional. `null` removes the
 * key, as do an empty `aliases` mapping and an empty `show` list.
 */
export interface MosaicEdits {
  title?: string;
  description?: string | null;
  mod?: string;
  collection?: string | null;
  aliases?: MosaicAliases;
  show?: MosaicShowLine[];
}

/**
 * The fields a draft holds as written, so a form can show them without
 * reading YAML. A text is `null` when it is missing or not a string.
 */
export interface MosaicDraftFields {
  title: string | null;
  description: string | null;
  mod: string | null;
  collection: string | null;
  /** The mosaic's own config, `{}` when it is missing or not a mapping. */
  config: YamlMapping;
  /** The fields whose value is a list of names. */
  aliases: MosaicAliases;
  /** The lines with a string host and reason, in file order. */
  show: MosaicShowLine[];
}

/** The keys of the `mosaic` mapping, in the order a new key is placed in. */
const MOSAIC_KEY_ORDER = [
  "title",
  "description",
  "mod",
  "collection",
  "config",
  "aliases",
  "permissions",
];

/** The keys a draft's edits may set. */
const EDIT_KEYS = [
  "title",
  "description",
  "mod",
  "collection",
  "aliases",
  "show",
];

const SHOW_PATH = ["mosaic", "permissions", "show"];

const NEW_DRAFT_TEXT = 'mosaic:\n  title: "Untitled mosaic"\n';

/** Output options that keep a parsed mosaic file as it was written. */
const TEXT_OPTIONS = { lineWidth: 0, flowCollectionPadding: false };

function readTextEdit(
  edits: { [key: string]: unknown },
  key: string,
  nullable: boolean,
): void {
  const value = edits[key];
  if (typeof value === "string" || (nullable && value === null)) {
    return;
  }
  const expected = nullable ? "a string or null" : "a string";
  throw new MosaicEditError(`"edits.${key}" must be ${expected}`);
}

function isStringList(value: unknown): value is string[] {
  if (!Array.isArray(value)) {
    return false;
  }
  for (const item of value) {
    if (typeof item !== "string") {
      return false;
    }
  }
  return true;
}

function readAliasesEdit(value: unknown): MosaicAliases {
  if (!isYamlMapping(value)) {
    throw new MosaicEditError('"edits.aliases" must be a mapping');
  }
  const aliases: MosaicAliases = {};
  for (const [field, names] of Object.entries(value)) {
    if (!isStringList(names)) {
      throw new MosaicEditError(
        `"edits.aliases.${field}" must be a list of strings`,
      );
    }
    aliases[field] = [...names];
  }
  return aliases;
}

function readShowLineEdit(value: unknown, index: number): MosaicShowLine {
  if (
    !isYamlMapping(value) ||
    typeof value.host !== "string" ||
    typeof value.reason !== "string"
  ) {
    throw new MosaicEditError(
      `"edits.show[${index}]" must be a mapping with a string "host" and a string "reason"`,
    );
  }
  const line: MosaicShowLine = { host: value.host, reason: value.reason };
  return line;
}

function readShowEdit(value: unknown): MosaicShowLine[] {
  if (!Array.isArray(value)) {
    throw new MosaicEditError('"edits.show" must be a list');
  }
  const lines: MosaicShowLine[] = [];
  for (const [index, item] of value.entries()) {
    lines.push(readShowLineEdit(item, index));
  }
  return lines;
}

function checkEditKeys(edits: { [key: string]: unknown }): void {
  for (const key of Object.keys(edits)) {
    if (!EDIT_KEYS.includes(key)) {
      throw new MosaicEditError(`"edits.${key}" is not a draft edit`);
    }
  }
}

/**
 * Reads the edits of a draft, as `mosaics.edit` receives them. Raises
 * `MosaicEditError` naming the key that is unknown or has the wrong type.
 */
export function readMosaicEdits(value: unknown): MosaicEdits {
  if (!isYamlMapping(value)) {
    throw new MosaicEditError('"edits" must be a mapping');
  }
  checkEditKeys(value);
  const edits: MosaicEdits = {};
  if (Object.hasOwn(value, "title")) {
    readTextEdit(value, "title", false);
    edits.title = value.title as string;
  }
  if (Object.hasOwn(value, "description")) {
    readTextEdit(value, "description", true);
    edits.description = value.description as string | null;
  }
  if (Object.hasOwn(value, "mod")) {
    readTextEdit(value, "mod", false);
    edits.mod = value.mod as string;
  }
  if (Object.hasOwn(value, "collection")) {
    readTextEdit(value, "collection", true);
    edits.collection = value.collection as string | null;
  }
  if (Object.hasOwn(value, "aliases")) {
    edits.aliases = readAliasesEdit(value.aliases);
  }
  if (Object.hasOwn(value, "show")) {
    edits.show = readShowEdit(value.show);
  }
  return edits;
}

/** Why the mosaic loader refuses a text, or `null` when it reads it. */
function readLoaderProblem(content: string): string | null {
  try {
    const parsedYaml = parseYaml({ source: DRAFT_ADDRESS, content });
    buildLoadedMosaic(parsedYaml, {
      defaultModsFolder: DRAFT_DEFAULT_MODS_FOLDER,
    });
    return null;
  } catch (error) {
    if (error instanceof YamlParseError || error instanceof MosaicFormatError) {
      return error.message;
    }
    throw error;
  }
}

/** Parses a draft with the loader's YAML rules and the `yaml` document API. Raises `MosaicEditError`. */
function readDraftDocument(content: string): Document {
  try {
    parseYaml({ source: DRAFT_ADDRESS, content });
  } catch (error) {
    if (!(error instanceof YamlParseError)) {
      throw error;
    }
    throw new MosaicEditError(`the draft cannot be read: ${error.message}`, {
      cause: error,
    });
  }
  const document = parseDocument(content);
  if (document.errors.length > 0) {
    throw new MosaicEditError(
      `the draft cannot be read: ${document.errors[0].message}`,
    );
  }
  return document;
}

function readMosaicNode(document: Document): YAMLMap {
  const mosaic = document.get("mosaic", true);
  if (!isMap(mosaic)) {
    throw new MosaicEditError(
      'the draft cannot be read: a "mosaic" mapping is required',
    );
  }
  return mosaic;
}

/** Writes every string scalar of a new node in double quotes, as mosaic files are written. */
function quoteStrings(node: unknown): void {
  if (isScalar(node)) {
    if (typeof node.value === "string") {
      node.type = "QUOTE_DOUBLE";
    }
    return;
  }
  if (isMap(node)) {
    for (const pair of node.items) {
      quoteStrings(pair.value);
    }
    return;
  }
  if (isSeq(node)) {
    for (const item of node.items) {
      quoteStrings(item);
    }
  }
}

function createQuotedNode(
  document: Document,
  value: unknown,
  flow: boolean,
): YamlNode {
  const node = document.createNode(value, { flow });
  quoteStrings(node);
  return node;
}

function readKeyRank(key: unknown): number {
  const name = isScalar(key) ? key.value : key;
  const rank = MOSAIC_KEY_ORDER.indexOf(String(name));
  if (rank === -1) {
    return MOSAIC_KEY_ORDER.length;
  }
  return rank;
}

/** Adds a key to the `mosaic` mapping before the first key that comes after it in the mosaic's order. */
function insertMosaicKey(
  document: Document,
  mosaic: YAMLMap,
  key: string,
  node: YamlNode,
): void {
  const rank = readKeyRank(key);
  const pair = document.createPair(key, node);
  for (const [index, item] of mosaic.items.entries()) {
    if (readKeyRank(item.key) > rank) {
      mosaic.items.splice(index, 0, pair);
      return;
    }
  }
  mosaic.items.push(pair);
}

/** Sets a string key of the `mosaic` mapping, keeping the quoting of a value it replaces. */
function setMosaicText(
  document: Document,
  mosaic: YAMLMap,
  key: string,
  value: string | null,
): void {
  if (value === null) {
    mosaic.delete(key);
    return;
  }
  const current = mosaic.get(key, true);
  if (isScalar(current)) {
    current.value = value;
    return;
  }
  const node = createQuotedNode(document, value, false);
  if (mosaic.has(key)) {
    mosaic.set(key, node);
    return;
  }
  insertMosaicKey(document, mosaic, key, node);
}

function haveSameNames(node: unknown, names: string[]): boolean {
  if (!isSeq(node) || node.items.length !== names.length) {
    return false;
  }
  for (const [index, item] of node.items.entries()) {
    if (!isScalar(item) || item.value !== names[index]) {
      return false;
    }
  }
  return true;
}

/** Sets the fields of an `aliases` mapping, keeping the fields whose names did not change. */
function updateAliasFields(
  document: Document,
  aliasesNode: YAMLMap,
  aliases: MosaicAliases,
): void {
  const keptFields: string[] = [];
  for (const pair of aliasesNode.items) {
    const field = isScalar(pair.key) ? String(pair.key.value) : "";
    keptFields.push(field);
  }
  for (const field of keptFields) {
    if (!Object.hasOwn(aliases, field)) {
      aliasesNode.delete(field);
    }
  }
  for (const [field, names] of Object.entries(aliases)) {
    if (!haveSameNames(aliasesNode.get(field, true), names)) {
      aliasesNode.set(field, createQuotedNode(document, names, true));
    }
  }
}

function setMosaicAliases(
  document: Document,
  mosaic: YAMLMap,
  aliases: MosaicAliases,
): void {
  if (Object.keys(aliases).length === 0) {
    mosaic.delete("aliases");
    return;
  }
  const aliasesNode = mosaic.get("aliases", true);
  if (isMap(aliasesNode)) {
    updateAliasFields(document, aliasesNode, aliases);
    return;
  }
  const newAliases: YAMLMap = new YAMLMap();
  for (const [field, names] of Object.entries(aliases)) {
    newAliases.set(field, createQuotedNode(document, names, true));
  }
  mosaic.delete("aliases");
  insertMosaicKey(document, mosaic, "aliases", newAliases);
}

function isSameShowLine(node: unknown, line: MosaicShowLine): boolean {
  if (!isMap(node) || node.items.length !== 2) {
    return false;
  }
  const isSame =
    node.get("host") === line.host && node.get("reason") === line.reason;
  return isSame;
}

function removeShowLines(document: Document, mosaic: YAMLMap): void {
  document.deleteIn(SHOW_PATH);
  const permissions = mosaic.get("permissions", true);
  if (isMap(permissions) && permissions.items.length === 0) {
    mosaic.delete("permissions");
  }
}

/** Replaces the `show` list's lines one by one, keeping each line that did not change. */
function updateShowLines(
  document: Document,
  showNode: YAMLSeq,
  lines: MosaicShowLine[],
): void {
  for (const [index, line] of lines.entries()) {
    if (!isSameShowLine(showNode.items[index], line)) {
      showNode.items[index] = createQuotedNode(document, line, false);
    }
  }
  showNode.items.splice(lines.length);
}

function setMosaicShowLines(
  document: Document,
  mosaic: YAMLMap,
  lines: MosaicShowLine[],
): void {
  if (lines.length === 0) {
    removeShowLines(document, mosaic);
    return;
  }
  const showNode = document.getIn(SHOW_PATH, true);
  if (isSeq(showNode)) {
    updateShowLines(document, showNode, lines);
    return;
  }
  if (!isMap(mosaic.get("permissions", true))) {
    mosaic.delete("permissions");
    insertMosaicKey(document, mosaic, "permissions", new YAMLMap());
  }
  document.setIn(SHOW_PATH, createQuotedNode(document, lines, false));
}

function applyEditsToDocument(document: Document, edits: MosaicEdits): void {
  const mosaic = readMosaicNode(document);
  const textKeys = ["title", "description", "mod", "collection"] as const;
  for (const key of textKeys) {
    const value = edits[key];
    if (value !== undefined) {
      setMosaicText(document, mosaic, key, value);
    }
  }
  if (edits.aliases !== undefined) {
    setMosaicAliases(document, mosaic, edits.aliases);
  }
  if (edits.show !== undefined) {
    setMosaicShowLines(document, mosaic, edits.show);
  }
}

/**
 * Applies the form's edits to a draft's text, changing only the keys they
 * set and keeping the other keys, their order, the comments and the quoting
 * of untouched values. The result goes back through the mosaic loader, so an
 * edit never makes a text the loader refuses for a reason the edit
 * introduced. Raises `MosaicEditError` for an unknown edit, a draft that
 * does not parse, or edits that make the mosaic invalid.
 */
export function applyMosaicEdits(content: string, edits: MosaicEdits): string {
  const checkedEdits = readMosaicEdits(edits);
  const document = readDraftDocument(content);
  applyEditsToDocument(document, checkedEdits);
  const editedContent = document.toString(TEXT_OPTIONS);
  const problem = readLoaderProblem(editedContent);
  if (problem !== null && problem !== readLoaderProblem(content)) {
    throw new MosaicEditError(`the edits make the mosaic invalid: ${problem}`);
  }
  return editedContent;
}

/** A reference that is resolved against the mosaic file: neither an absolute address nor a default mod name. */
function isRelativeReference(value: unknown, isMod: boolean): value is string {
  if (typeof value !== "string" || value === "" || URL.canParse(value)) {
    return false;
  }
  return !(isMod && isDefaultModName(value));
}

/**
 * The keys of a `mosaic` mapping, `mod` and `collection`, whose reference is
 * resolved against the mosaic file's address, which a new draft lacks.
 */
export function listRelativeReferences(
  mosaic: YamlMapping,
): ("mod" | "collection")[] {
  const keys: ("mod" | "collection")[] = [];
  if (isRelativeReference(mosaic.mod, true)) {
    keys.push("mod");
  }
  if (isRelativeReference(mosaic.collection, false)) {
    keys.push("collection");
  }
  return keys;
}

/** The `mosaic` mapping of a draft, read with the loader's YAML rules. Raises `MosaicEditError`. */
function readDraftMosaic(content: string): YamlMapping {
  readDraftDocument(content);
  const parsedYaml = parseYaml({ source: DRAFT_ADDRESS, content });
  const mosaic = parsedYaml.content.mosaic;
  if (!isYamlMapping(mosaic)) {
    throw new MosaicEditError(
      'the draft cannot be read: a "mosaic" mapping is required',
    );
  }
  return mosaic;
}

/**
 * The draft of a copy of the mosaic at `original`: its text, with a relative
 * `mod` and `collection` rewritten as the absolute addresses they resolve to
 * from `original`, so the copy opens from anywhere. Raises `MosaicEditError`
 * for a text that does not parse.
 */
export function makeCopyDraft(content: string, original: string): string {
  const mosaic = readDraftMosaic(content);
  const edits: MosaicEdits = {};
  for (const key of listRelativeReferences(mosaic)) {
    edits[key] = new URL(String(mosaic[key]), original).href;
  }
  const copy = applyMosaicEdits(content, edits);
  return copy;
}

function readFieldText(mosaic: YamlMapping, key: string): string | null {
  const value = mosaic[key];
  return typeof value === "string" ? value : null;
}

function readFieldAliases(value: unknown): MosaicAliases {
  const aliases: MosaicAliases = {};
  if (!isYamlMapping(value)) {
    return aliases;
  }
  for (const [field, names] of Object.entries(value)) {
    if (isStringList(names)) {
      aliases[field] = [...names];
    }
  }
  return aliases;
}

function readFieldShowLines(permissions: unknown): MosaicShowLine[] {
  const lines: MosaicShowLine[] = [];
  if (!isYamlMapping(permissions) || !Array.isArray(permissions.show)) {
    return lines;
  }
  for (const entry of permissions.show) {
    if (
      isYamlMapping(entry) &&
      typeof entry.host === "string" &&
      typeof entry.reason === "string"
    ) {
      lines.push({ host: entry.host, reason: entry.reason });
    }
  }
  return lines;
}

/**
 * The fields of a draft as written, read with the loader's YAML rules but
 * without its format checks, so a draft without a title still shows its
 * other fields. `null` when the text cannot be read: a YAML error, or no
 * `mosaic` mapping.
 */
export function readDraftFields(content: string): MosaicDraftFields | null {
  let mosaic: YamlMapping;
  try {
    mosaic = readDraftMosaic(content);
  } catch (error) {
    if (error instanceof MosaicEditError) {
      return null;
    }
    throw error;
  }
  const fields: MosaicDraftFields = {
    title: readFieldText(mosaic, "title"),
    description: readFieldText(mosaic, "description"),
    mod: readFieldText(mosaic, "mod"),
    collection: readFieldText(mosaic, "collection"),
    config: isYamlMapping(mosaic.config) ? mosaic.config : {},
    aliases: readFieldAliases(mosaic.aliases),
    show: readFieldShowLines(mosaic.permissions),
  };
  return fields;
}

/** The draft of a new mosaic, titled "Untitled mosaic", for a mod, a collection or none, and `show` lines. */
export function buildNewDraft(
  mod: string,
  collection: string | null,
  show: MosaicShowLine[],
): string {
  const edits: MosaicEdits = { mod };
  if (collection !== null) {
    edits.collection = collection;
  }
  if (show.length > 0) {
    edits.show = show;
  }
  const draft = applyMosaicEdits(NEW_DRAFT_TEXT, edits);
  return draft;
}
