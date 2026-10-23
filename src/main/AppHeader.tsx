import type { ReactElement } from "react";
import type { AppTheme } from "./theme/app_theme.ts";
import { ThemeControl } from "./theme/ThemeControl.tsx";

interface AppHeaderProps {
  appTheme: AppTheme;
}

/** The app's name and the Theme control, above the stage. */
export function AppHeader({ appTheme }: AppHeaderProps): ReactElement {
  return (
    <header className="flex items-center justify-between gap-4 border-b px-4 py-2">
      <h1 className="text-xl font-semibold tracking-tight">OpenTesela</h1>
      <ThemeControl appTheme={appTheme} />
    </header>
  );
}
