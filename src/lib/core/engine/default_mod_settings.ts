import { resolveModReference } from "../../mod/index.ts";

/** The default mods of an instantiation. `folder` and the references are relative to the app's address. */
export interface DefaultModSettings {
  /** The default mods folder, e.g. `./default_mods/`. */
  folder: string;
  /** The mod reference opened for `#/`. */
  home: string;
  /** Default mod names that cannot be opened. */
  switchedOff: string[];
}

export interface SwitchedOffMod {
  name: string;
  source: string;
}

/** Default mod settings with the folder and the switched-off mods resolved. */
export interface ResolvedDefaultModSettings {
  /** Absolute URL with a trailing `/`. */
  folder: string;
  home: string;
  switchedOff: SwitchedOffMod[];
}

function resolveFolder(folder: string, baseUrl: string): string {
  const folderUrl = new URL(folder, baseUrl);
  if (!folderUrl.pathname.endsWith("/")) {
    folderUrl.pathname = `${folderUrl.pathname}/`;
  }
  return folderUrl.href;
}

/**
 * Resolves the default mods folder against the app's address, and each
 * switched-off name to the source of its mod file.
 */
export function resolveDefaultModSettings(
  settings: DefaultModSettings,
  baseUrl: string,
): ResolvedDefaultModSettings {
  const folder = resolveFolder(settings.folder, baseUrl);
  const switchedOff: SwitchedOffMod[] = [];
  for (const name of settings.switchedOff) {
    const source = resolveModReference(name, {
      baseUrl,
      defaultModsFolder: folder,
    });
    switchedOff.push({ name, source });
  }
  const resolvedSettings: ResolvedDefaultModSettings = {
    folder,
    home: settings.home,
    switchedOff,
  };
  return resolvedSettings;
}

/**
 * The name of the switched-off default mod with this source, or `null`.
 * Sources are compared, so a mod is found whatever reference named it.
 */
export function findSwitchedOffMod(
  source: string,
  defaults: ResolvedDefaultModSettings,
): string | null {
  for (const switchedOffMod of defaults.switchedOff) {
    if (switchedOffMod.source === source) {
      return switchedOffMod.name;
    }
  }
  return null;
}
