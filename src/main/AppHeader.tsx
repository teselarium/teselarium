import type { ReactElement } from "react";
import { HamburgerButton } from "./sidebar/HamburgerButton.tsx";
import type { SidebarLayoutStore } from "./sidebar/sidebar_layout.ts";

interface AppHeaderProps {
  layout: SidebarLayoutStore;
}

/** The hamburger button and the app's name, above the sidebar and the main area. */
export function AppHeader({ layout }: AppHeaderProps): ReactElement {
  return (
    <header className="flex items-center gap-2 border-b px-2 py-2">
      <HamburgerButton layout={layout} />
      <h1 className="text-xl font-semibold tracking-tight">OpenTesela</h1>
    </header>
  );
}
