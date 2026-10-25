import { useEffect, useRef } from "react";
import type { ReactElement, ReactNode, RefObject, SyntheticEvent } from "react";

/**
 * The dialog box: centered in the viewport (`m-auto` undoes Tailwind's
 * margin reset of the native `<dialog>`), in the popover colors.
 */
const DIALOG_CLASSES =
  "m-auto w-full max-w-[calc(100%-2rem)] rounded-lg border bg-popover p-6 text-popover-foreground shadow-lg backdrop:bg-black/50 sm:max-w-lg";

interface StageDialogProps {
  /** Identifies what the dialog asks, or `null` to keep it closed. Cancel gets the focus again when it changes. */
  shownKey: string | number | null;
  /** The id of the element that names the dialog, while it is shown. */
  labelledBy?: string;
  /** The Cancel button of the content. */
  cancelRef: RefObject<HTMLButtonElement | null>;
  /** Escape: answers as Cancel. */
  onCancel: () => void;
  children?: ReactNode;
}

/**
 * The mechanics the app's dialogs share. It is a modal `<dialog>` in the
 * app's page, which a mod's frame cannot reach, and `showModal` makes the rest
 * of the page inert, frames included. It is open while `shownKey` is not
 * `null`, and Cancel has the focus, so a key pressed for the mod cannot
 * accept. Escape answers as Cancel, and only the stage closes the dialog: the
 * page closes it once the answer removed what was shown.
 */
export function StageDialog({
  shownKey,
  labelledBy,
  cancelRef,
  onCancel,
  children,
}: StageDialogProps): ReactElement {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(
    function showOrCloseDialog(): void {
      const dialog = dialogRef.current;
      if (dialog === null) {
        return;
      }
      if (shownKey === null) {
        if (dialog.open) {
          dialog.close();
        }
        return;
      }
      if (!dialog.open) {
        dialog.showModal();
      }
      cancelRef.current?.focus();
    },
    [shownKey, cancelRef],
  );

  function handleDialogCancel(event: SyntheticEvent<HTMLDialogElement>): void {
    event.preventDefault();
    if (shownKey === null) {
      return;
    }
    onCancel();
  }

  // A browser can close the dialog on a repeated Escape even though the cancel
  // was prevented; the cancel already answered, so the dialog opens again for
  // what is now shown.
  function handleDialogClose(): void {
    const dialog = dialogRef.current;
    if (shownKey !== null && dialog !== null && !dialog.open) {
      dialog.showModal();
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className={DIALOG_CLASSES}
      aria-labelledby={shownKey === null ? undefined : labelledBy}
      onCancel={handleDialogCancel}
      onClose={handleDialogClose}
    >
      {shownKey === null ? null : children}
    </dialog>
  );
}
