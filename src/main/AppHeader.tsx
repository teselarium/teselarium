import type { ReactElement } from "react";
import type { AppTheme } from "./theme/app_theme.ts";
import { ThemeControl } from "./theme/ThemeControl.tsx";

interface AppHeaderProps {
  appTheme: AppTheme;
}

/** The app's name and the Theme control, above the stage. */
export function AppHeader({ appTheme }: AppHeaderProps): ReactElement {
  return (
    <header className="app-header">
      <h1>OpenTesela</h1>
      <ThemeControl appTheme={appTheme} />
    </header>
  );
}
