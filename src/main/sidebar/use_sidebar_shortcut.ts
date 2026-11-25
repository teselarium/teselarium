import { useEffect } from "react";
import { toggleSidebar } from "./sidebar_layout.ts";
import type { SidebarLayoutStore } from "./sidebar_layout.ts";

/** Fields where `Ctrl+B` belongs to the text, not to the app. */
function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  return (
    target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  );
}

function isSidebarShortcut(event: KeyboardEvent): boolean {
  return (
    event.key.toLowerCase() === "b" &&
    (event.ctrlKey || event.metaKey) &&
    !event.altKey &&
    !event.shiftKey
  );
}

function handleShortcutKey(
  layout: SidebarLayoutStore,
  event: KeyboardEvent,
): void {
  if (!isSidebarShortcut(event) || isEditableTarget(event.target)) {
    return;
  }
  // Firefox otherwise opens its bookmarks sidebar.
  event.preventDefault();
  toggleSidebar(layout);
}

function removeShortcutListener(
  listener: (event: KeyboardEvent) => void,
): void {
  window.removeEventListener("keydown", listener);
}

/**
 * `Ctrl+B`, or `Cmd+B` on macOS, toggles the sidebar between expanded and
 * collapsed while the app's page has focus. Inside a mod's frame the frame
 * gets the keystrokes, as a sandbox should.
 */
export function useSidebarShortcut(layout: SidebarLayoutStore): void {
  useEffect(
    function listenForShortcut(): () => void {
      const listener = handleShortcutKey.bind(undefined, layout);
      window.addEventListener("keydown", listener);
      return removeShortcutListener.bind(undefined, listener);
    },
    [layout],
  );
}
