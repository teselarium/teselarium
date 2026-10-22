import { useEffect, useId, useRef } from "react";
import type { ReactElement, SyntheticEvent } from "react";
import type { ActionSnapshot, AppAction } from "../../lib/core/stage/index.ts";
import {
  downloadFile,
  formatFileSize,
  openLinkInNewTab,
} from "./action_effects.ts";

interface ActionDialogProps {
  /** The action to show, or `null` to keep the dialog closed. */
  shown: ActionSnapshot | null;
  onAnswer: (id: number, accepted: boolean) => void;
}

/** What the dialog says about an action, after the mod's name. */
interface ActionTexts {
  lead: string;
  detail: ReactElement;
  acceptLabel: string;
  cancelLabel: string;
}

function describeAction(action: AppAction): ActionTexts {
  if (action.kind === "link") {
    const linkTexts: ActionTexts = {
      lead: "wants to open this address in a new tab:",
      detail: <p className="action-dialog-url">{action.url}</p>,
      acceptLabel: "Open",
      cancelLabel: "Cancel",
    };
    return linkTexts;
  }
  if (action.kind === "save") {
    const saveTexts: ActionTexts = {
      lead: "wants to save a file:",
      detail: (
        <p className="action-dialog-file">
          <strong>{action.name}</strong>{" "}
          <span>{formatFileSize(action.bytes.length)}</span>
        </p>
      ),
      acceptLabel: "Save",
      cancelLabel: "Cancel",
    };
    return saveTexts;
  }
  const confirmTexts: ActionTexts = {
    lead: "asks:",
    detail: <p className="action-dialog-message">{action.message}</p>,
    acceptLabel: action.confirmLabel,
    cancelLabel: action.cancelLabel,
  };
  return confirmTexts;
}

/** Opens the tab or starts the download. Must run inside the accept click. */
function performAction(action: AppAction): void {
  if (action.kind === "link") {
    openLinkInNewTab(action.url);
  }
  if (action.kind === "save") {
    downloadFile(action);
  }
}

/**
 * The app's dialog for an action a mod asked for. It is a modal `<dialog>`
 * in the app's page, which a mod's frame cannot reach, and `showModal` makes
 * the rest of the page inert, frames included. It names the mod by its title
 * and source and shows the action as plain text. The accept button performs
 * the action inside its own click, because a browser only opens a tab or
 * starts a download from a click on the app's page, and then answers. Cancel
 * and Escape answer `false`. Cancel has the focus, so a key pressed for the
 * mod cannot accept.
 */
export function ActionDialog({
  shown,
  onAnswer,
}: ActionDialogProps): ReactElement {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const shownId = shown?.id ?? null;

  useEffect(
    function showOrCloseDialog(): void {
      const dialog = dialogRef.current;
      if (dialog === null) {
        return;
      }
      if (shownId === null) {
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
    [shownId],
  );

  function handleAcceptClick(): void {
    if (shown === null) {
      return;
    }
    performAction(shown.action);
    onAnswer(shown.id, true);
  }

  function handleCancelClick(): void {
    if (shown === null) {
      return;
    }
    onAnswer(shown.id, false);
  }

  // Escape: the stage closes the dialog once the answer removed the action.
  function handleDialogCancel(event: SyntheticEvent<HTMLDialogElement>): void {
    event.preventDefault();
    handleCancelClick();
  }

  // Only the stage closes the dialog. A browser can close it on a repeated
  // Escape even though the cancel was prevented; the cancel already answered,
  // so the dialog opens again for the action now shown.
  function handleDialogClose(): void {
    const dialog = dialogRef.current;
    if (shown !== null && dialog !== null && !dialog.open) {
      dialog.showModal();
    }
  }

  if (shown === null) {
    return (
      <dialog
        ref={dialogRef}
        className="action-dialog"
        onCancel={handleDialogCancel}
        onClose={handleDialogClose}
      />
    );
  }
  const texts = describeAction(shown.action);
  return (
    <dialog
      ref={dialogRef}
      className="action-dialog"
      aria-labelledby={titleId}
      onCancel={handleDialogCancel}
      onClose={handleDialogClose}
    >
      <h2 id={titleId} className="action-dialog-title">
        {shown.mod.title}
      </h2>
      <code className="action-dialog-source">{shown.mod.source}</code>
      <p className="action-dialog-lead">{texts.lead}</p>
      {texts.detail}
      <div className="action-dialog-buttons">
        <button ref={cancelRef} type="button" onClick={handleCancelClick}>
          {texts.cancelLabel}
        </button>
        <button
          type="button"
          className="action-dialog-accept"
          onClick={handleAcceptClick}
        >
          {texts.acceptLabel}
        </button>
      </div>
    </dialog>
  );
}
