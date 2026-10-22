import type { ColorScheme } from "./theme_tokens.ts";

/** What the user picks in the Theme control. System follows the operating system. */
export type ThemeChoice = "system" | "light" | "dark";

/** The part of `Storage` the theme choice uses. The app passes `localStorage`. */
export type ThemeStorage = Pick<Storage, "getItem" | "setItem">;

/** Outside the `opentesela.mod-storage:` keys, so no mod storage slot can reach it. */
export const THEME_CHOICE_KEY = "opentesela.theme-choice";

const THEME_CHOICES: readonly string[] = ["system", "light", "dark"];

function isThemeChoice(value: string | null): value is ThemeChoice {
  return value !== null && THEME_CHOICES.includes(value);
}

/** Light and Dark resolve to themselves, System to the operating system's preference. */
export function resolveColorScheme(
  choice: ThemeChoice,
  systemPrefersDark: boolean,
): ColorScheme {
  if (choice === "system") {
    return systemPrefersDark ? "dark" : "light";
  }
  return choice;
}

/** The stored choice. A missing or unknown value, or a storage that cannot be read, gives System. */
export function readThemeChoice(storage: ThemeStorage): ThemeChoice {
  try {
    const storedChoice = storage.getItem(THEME_CHOICE_KEY);
    if (isThemeChoice(storedChoice)) {
      return storedChoice;
    }
  } catch {
    // A blocked storage counts as no stored choice.
  }
  return "system";
}

/** Stores the choice. A storage that cannot be written is ignored: the caller keeps the choice. */
export function writeThemeChoice(
  storage: ThemeStorage,
  choice: ThemeChoice,
): void {
  try {
    storage.setItem(THEME_CHOICE_KEY, choice);
  } catch {
    // The choice still applies until the page is closed.
  }
}
