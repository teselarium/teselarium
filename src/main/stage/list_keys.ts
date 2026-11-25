import type { KeyboardEvent } from "react";

/**
 * Keeps the keys of a list's controls outside its rows, such as the
 * toolbar's buttons and menus and the details' Copy buttons, from the list:
 * cmdk's root would take Enter and the arrow keys as choosing and moving
 * between rows.
 */
export function stopKeyPropagation(event: KeyboardEvent): void {
  event.stopPropagation();
}
