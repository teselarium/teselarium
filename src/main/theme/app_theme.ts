import { changeStageColorScheme } from "../../lib/core/stage/index.ts";
import type { Stage } from "../../lib/core/stage/index.ts";
import {
  readThemeChoice,
  resolveColorScheme,
  writeThemeChoice,
} from "../../lib/core/theme/index.ts";
import type {
  ColorScheme,
  ThemeChoice,
  ThemeStorage,
} from "../../lib/core/theme/index.ts";

/** The part of `matchMedia("(prefers-color-scheme: dark)")` the app theme uses. */
export interface SystemColorSchemeQuery {
  matches: boolean;
  addEventListener: (type: "change", listener: () => void) => void;
}

export interface AppThemeOptions {
  storage: ThemeStorage;
  systemQuery: SystemColorSchemeQuery;
  stage: Stage;
  /** The element that gets `data-tes-color-scheme`: the page's `<html>`. */
  root: HTMLElement;
}

/** What the Theme control renders. Frozen, and new after every change. */
export interface AppThemeSnapshot {
  choice: ThemeChoice;
  colorScheme: ColorScheme;
}

/**
 * The app's theme: the user's choice, the operating system's preference, the
 * page's color scheme attribute and the stage. Mutable.
 */
export interface AppTheme {
  choice: ThemeChoice;
  storage: ThemeStorage;
  systemQuery: SystemColorSchemeQuery;
  stage: Stage;
  root: HTMLElement;
  listeners: Set<() => void>;
  snapshot: AppThemeSnapshot;
}

function buildSnapshot(
  choice: ThemeChoice,
  colorScheme: ColorScheme,
): AppThemeSnapshot {
  const snapshot: AppThemeSnapshot = { choice, colorScheme };
  return Object.freeze(snapshot);
}

/** The color scheme the app starts with, for the stage created before the app theme. */
export function readStartColorScheme(
  storage: ThemeStorage,
  systemQuery: SystemColorSchemeQuery,
): ColorScheme {
  return resolveColorScheme(readThemeChoice(storage), systemQuery.matches);
}

/** Resolves the color scheme again, and applies it to the page and the stage. */
function applyAppTheme(appTheme: AppTheme): void {
  const colorScheme = resolveColorScheme(
    appTheme.choice,
    appTheme.systemQuery.matches,
  );
  appTheme.root.dataset.tesColorScheme = colorScheme;
  changeStageColorScheme(appTheme.stage, colorScheme);
  appTheme.snapshot = buildSnapshot(appTheme.choice, colorScheme);
  for (const listener of appTheme.listeners) {
    listener();
  }
}

/** Reads the stored choice, applies it, and follows the operating system's preference. */
export function createAppTheme(options: AppThemeOptions): AppTheme {
  const choice = readThemeChoice(options.storage);
  const appTheme: AppTheme = {
    choice,
    storage: options.storage,
    systemQuery: options.systemQuery,
    stage: options.stage,
    root: options.root,
    listeners: new Set(),
    snapshot: buildSnapshot(
      choice,
      resolveColorScheme(choice, options.systemQuery.matches),
    ),
  };
  applyAppTheme(appTheme);
  options.systemQuery.addEventListener(
    "change",
    applyAppTheme.bind(undefined, appTheme),
  );
  return appTheme;
}

/** The user picked a theme: it is stored, when the storage allows, and applied at once. */
export function chooseTheme(appTheme: AppTheme, choice: ThemeChoice): void {
  writeThemeChoice(appTheme.storage, choice);
  appTheme.choice = choice;
  applyAppTheme(appTheme);
}

export function readAppThemeSnapshot(appTheme: AppTheme): AppThemeSnapshot {
  return appTheme.snapshot;
}

function unsubscribeAppTheme(appTheme: AppTheme, listener: () => void): void {
  appTheme.listeners.delete(listener);
}

/** Calls `listener` after every change. Returns the function that unsubscribes it. */
export function subscribeAppTheme(
  appTheme: AppTheme,
  listener: () => void,
): () => void {
  appTheme.listeners.add(listener);
  return unsubscribeAppTheme.bind(undefined, appTheme, listener);
}
