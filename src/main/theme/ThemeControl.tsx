import { useMemo, useSyncExternalStore } from "react";
import type { ChangeEvent, ReactElement } from "react";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/vendor/shadcn/ui/native-select.tsx";
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
    <NativeSelectOption key={option.choice} value={option.choice}>
      {option.label}
    </NativeSelectOption>
  );
}

/**
 * The Theme control: System, Light or Dark, applied to the app and every mod
 * at once. A native `<select>` (shadcn's NativeSelect), the better control on
 * mobile (docs/code_conventions.md, "UI components", exception 3).
 */
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
    <label className="flex items-center gap-2 text-sm text-muted-foreground">
      Theme{" "}
      <NativeSelect
        size="sm"
        className="text-foreground"
        value={snapshot.choice}
        onChange={handleThemeChange}
      >
        {options}
      </NativeSelect>
    </label>
  );
}
