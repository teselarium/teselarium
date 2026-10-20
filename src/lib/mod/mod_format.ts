import { isYamlMapping } from "../files/index.ts";
import type { ParsedYaml, YamlMapping, YamlValue } from "../files/index.ts";
import { ModFormatError } from "./mod_errors.ts";
import { readModPermissions } from "./mod_permissions.ts";
import type { ModPermission } from "./mod_permissions.ts";

/** The checked content of a mod file. Paths are not resolved yet. */
export interface ModFormat {
  name: string;
  title: string;
  version: string;
  description: string;
  entrypoint: string;
  typePath: string | null;
  sampleCollection: string | null;
  config: YamlMapping;
  permissions: ModPermission[];
}

function readModMapping(parsedYaml: ParsedYaml): YamlMapping {
  const mod = parsedYaml.content.mod;
  if (!isYamlMapping(mod)) {
    throw new ModFormatError(parsedYaml.source, 'a "mod" mapping is required');
  }
  return mod;
}

function isNonEmptyString(value: YamlValue | undefined): value is string {
  return typeof value === "string" && value !== "";
}

function readRequiredText(
  mod: YamlMapping,
  fieldName: string,
  source: string,
): string {
  const value = mod[fieldName];
  if (!isNonEmptyString(value)) {
    throw new ModFormatError(
      source,
      `"${fieldName}" must be a non-empty string`,
    );
  }
  return value;
}

function readOptionalText(
  mod: YamlMapping,
  fieldName: string,
  defaultText: string,
  source: string,
): string {
  const value = mod[fieldName];
  if (value === undefined) {
    return defaultText;
  }
  if (typeof value !== "string") {
    throw new ModFormatError(source, `"${fieldName}" must be a string`);
  }
  return value;
}

function readOptionalPath(
  mod: YamlMapping,
  fieldName: string,
  source: string,
): string | null {
  if (mod[fieldName] === undefined) {
    return null;
  }
  return readRequiredText(mod, fieldName, source);
}

function readModConfig(mod: YamlMapping, source: string): YamlMapping {
  const config = mod.config;
  if (config === undefined) {
    const emptyConfig: YamlMapping = {};
    return emptyConfig;
  }
  if (!isYamlMapping(config)) {
    throw new ModFormatError(source, '"config" must be a mapping');
  }
  return config;
}

function checkNoInlineSchema(mod: YamlMapping, source: string): void {
  if (Object.hasOwn(mod, "schema")) {
    throw new ModFormatError(
      source,
      'inline "schema" is not supported yet, use "type_path" with the path of a tile type file',
    );
  }
}

/**
 * Checks the structure of a parsed mod file: a `mod` mapping with non-empty
 * string `name`, `version` and `entrypoint`, optional string `title` (defaults
 * to `name`) and `description` (defaults to `""`), optional non-empty
 * `type_path` and `sample_collection`, an optional `config` mapping and
 * optional `permissions`. Other keys are ignored, and an inline `schema` is
 * rejected. Raises `ModFormatError` at the first failure.
 */
export function readModFormat(parsedYaml: ParsedYaml): ModFormat {
  const source = parsedYaml.source;
  const mod = readModMapping(parsedYaml);
  const name = readRequiredText(mod, "name", source);
  const version = readRequiredText(mod, "version", source);
  const entrypoint = readRequiredText(mod, "entrypoint", source);
  const title = readOptionalText(mod, "title", name, source);
  const description = readOptionalText(mod, "description", "", source);
  const typePath = readOptionalPath(mod, "type_path", source);
  const sampleCollection = readOptionalPath(mod, "sample_collection", source);
  const config = readModConfig(mod, source);
  checkNoInlineSchema(mod, source);
  const modFormat: ModFormat = {
    name,
    title,
    version,
    description,
    entrypoint,
    typePath,
    sampleCollection,
    config,
    permissions: readModPermissions(mod.permissions, source),
  };
  return modFormat;
}
