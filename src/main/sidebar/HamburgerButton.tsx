import { Menu } from "lucide-react";
import type { ReactElement } from "react";
import { Button } from "@/vendor/shadcn/ui/button.tsx";
import { useStoreSnapshot } from "../use_store_snapshot.ts";
import {
  pressHamburger,
  readSidebarSnapshot,
  subscribeSidebar,
} from "./sidebar_layout.ts";
import type { SidebarLayoutStore } from "./sidebar_layout.ts";
import { SIDEBAR_ID } from "./Sidebar.tsx";

interface HamburgerButtonProps {
  layout: SidebarLayoutStore;
}

/** Always visible at the header's left: hides the sidebar, and shows it again as it was. */
export function HamburgerButton({
  layout,
}: HamburgerButtonProps): ReactElement {
  const snapshot = useStoreSnapshot(
    layout,
    subscribeSidebar,
    readSidebarSnapshot,
  );

  function handleClick(): void {
    pressHamburger(layout);
  }

  const isShown = snapshot.state !== "hidden";
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-controls={SIDEBAR_ID}
      aria-expanded={isShown}
      aria-label={isShown ? "Hide sidebar" : "Show sidebar"}
      onClick={handleClick}
    >
      <Menu />
    </Button>
  );
}
