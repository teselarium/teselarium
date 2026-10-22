import { useMemo, useSyncExternalStore } from "react";
import type { ChangeEvent, ReactElement } from "react";
import type { ThemeChoice } from "../../lib/core/theme/index.ts";
import {
  chooseTheme,
  readAppThemeSnapshot,
  subscribeAppTheme,
} from "./app_theme.ts";
import type { AppTheme, AppThemeSnapshot } from "./app_theme.ts";

interface ThemeControlProps {
  appTheme: AppTheme;
}

interface ThemeOption {
  choice: ThemeChoice;
  label: string;
}

const THEME_OPTIONS: readonly ThemeOption[] = [
  { choice: "system", label: "System" },
  { choice: "light", label: "Light" },
  { choice: "dark", label: "Dark" },
];

function findThemeChoice(value: string): ThemeChoice | null {
  for (const option of THEME_OPTIONS) {
    if (option.choice === value) {
      return option.choice;
    }
  }
  return null;
}

function renderThemeOption(option: ThemeOption): ReactElement {
  return (
    <option key={option.choice} value={option.choice}>
      {option.label}
    </option>
  );
}

/** The Theme control: System, Light or Dark, applied to the app and every mod at once. */
export function ThemeControl({ appTheme }: ThemeControlProps): ReactElement {
  const subscribe = useMemo(
    function bindSubscribe(): (listener: () => void) => () => void {
      return subscribeAppTheme.bind(undefined, appTheme);
    },
    [appTheme],
  );
  const getSnapshot = useMemo(
    function bindGetSnapshot(): () => AppThemeSnapshot {
      return readAppThemeSnapshot.bind(undefined, appTheme);
    },
    [appTheme],
  );
  const snapshot = useSyncExternalStore(subscribe, getSnapshot);

  function handleThemeChange(event: ChangeEvent<HTMLSelectElement>): void {
    const choice = findThemeChoice(event.currentTarget.value);
    if (choice !== null) {
      chooseTheme(appTheme, choice);
    }
  }

  const options: ReactElement[] = [];
  for (const option of THEME_OPTIONS) {
    options.push(renderThemeOption(option));
  }
  return (
    <label className="theme-control">
      Theme{" "}
      <select value={snapshot.choice} onChange={handleThemeChange}>
        {options}
      </select>
    </label>
  );
}
