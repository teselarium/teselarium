import { useId, useRef } from "react";
import type { ReactElement, ReactNode } from "react";
import { Alert, AlertDescription } from "@/vendor/shadcn/ui/alert.tsx";
import { Button } from "@/vendor/shadcn/ui/button.tsx";
import type { ActionMod } from "../../lib/core/stage/index.ts";
import { StageDialog } from "../stage/StageDialog.tsx";

/** Touch-friendly buttons: at least 32px tall, as on a phone. */
const BUTTON_CLASSES = "min-h-8";

interface CatalogDialogFrameProps {
  /** The stage's id of the shown action. */
  shownId: number;
  title: string;
  /** The mod that asked. */
  mod: ActionMod;
  /** The error to show above the buttons, or `null`. */
  error: string | null;
  /** The accept button's label, or `null` for a dialog with only Cancel. */
  acceptLabel: string | null;
  isAcceptDisabled: boolean;
  isAcceptDestructive?: boolean;
  /** "Cancel", or "Close" when nothing can be accepted. */
  cancelLabel?: string;
  onAccept: () => void;
  onCancel: () => void;
  children?: ReactNode;
}

/**
 * The frame of the user catalog dialogs: a `StageDialog` with the dialog's
 * title, the mod that asked, the content, an error, Cancel (focused) and the
 * accept button. Its box fits a phone's width, and Cancel and Escape answer
 * `false`.
 */
export function CatalogDialogFrame({
  shownId,
  title,
  mod,
  error,
  acceptLabel,
  isAcceptDisabled,
  isAcceptDestructive = false,
  cancelLabel = "Cancel",
  onAccept,
  onCancel,
  children,
}: CatalogDialogFrameProps): ReactElement {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  return (
    <StageDialog
      shownKey={shownId}
      labelledBy={titleId}
      cancelRef={cancelRef}
      onCancel={onCancel}
    >
      <div
        className="flex max-h-[calc(100dvh-6rem)] min-w-0 flex-col gap-4"
        data-user-catalog-dialog=""
      >
        <div>
          <h2
            id={titleId}
            className="text-lg font-semibold tracking-tight [overflow-wrap:anywhere]"
          >
            {title}
          </h2>
          <p className="m-0 text-sm text-muted-foreground [overflow-wrap:anywhere]">
            Asked by {mod.title} <code>{mod.source}</code>
          </p>
        </div>
        {children}
        {error === null ? null : (
          <Alert
            variant="destructive"
            className="border-destructive [overflow-wrap:anywhere]"
          >
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            ref={cancelRef}
            type="button"
            variant="outline"
            className={BUTTON_CLASSES}
            onClick={onCancel}
          >
            {cancelLabel}
          </Button>
          {acceptLabel === null ? null : (
            <Button
              type="button"
              variant={isAcceptDestructive ? "destructive" : "default"}
              className={BUTTON_CLASSES}
              disabled={isAcceptDisabled}
              onClick={onAccept}
            >
              {acceptLabel}
            </Button>
          )}
        </div>
      </div>
    </StageDialog>
  );
}
