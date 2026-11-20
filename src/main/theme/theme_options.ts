import type { ThemeChoice } from "../../lib/core/theme/index.ts";

/** One choice of a Theme control, as the user sees it. */
export interface ThemeOption {
  choice: ThemeChoice;
  label: string;
}

/** The choices of both Theme controls (Settings and the sidebar), in their order. */
export const THEME_OPTIONS: readonly ThemeOption[] = [
  { choice: "system", label: "System" },
  { choice: "light", label: "Light" },
  { choice: "dark", label: "Dark" },
];

/** The choice whose id is `value`, or `null` when no choice has it. */
export function findThemeChoice(value: string): ThemeChoice | null {
  for (const option of THEME_OPTIONS) {
    if (option.choice === value) {
      return option.choice;
    }
  }
  return null;
}

/** The label of `choice`, as both Theme controls show it. */
export function readThemeLabel(choice: ThemeChoice): string {
  for (const option of THEME_OPTIONS) {
    if (option.choice === choice) {
      return option.label;
    }
  }
  throw new Error(
    `Cannot label the theme choice "${choice}": it is not one of THEME_OPTIONS.`,
  );
}

/** The choice after `choice` in `THEME_OPTIONS`' order, back to the first after the last. */
export function readNextThemeChoice(choice: ThemeChoice): ThemeChoice {
  let index = 0;
  for (const [optionIndex, option] of THEME_OPTIONS.entries()) {
    if (option.choice === choice) {
      index = optionIndex;
    }
  }
  const next = THEME_OPTIONS[(index + 1) % THEME_OPTIONS.length];
  return next.choice;
}
