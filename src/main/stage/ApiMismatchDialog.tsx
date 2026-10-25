import { useId, useRef } from "react";
import type { ReactElement } from "react";
import { Button } from "@/vendor/shadcn/ui/button.tsx";
import type { SandboxSnapshot } from "../../lib/core/stage/index.ts";
import { StageDialog } from "./StageDialog.tsx";

interface ApiMismatchDialogProps {
  /** The visible sandbox while it is asking. */
  sandbox: SandboxSnapshot;
  onAnswer: (sandboxId: string, runAnyway: boolean) => void;
}

/**
 * The app's question before it starts a mod written for another mod API, a
 * `StageDialog` like the action dialog: modal, out of every frame's reach,
 * with Cancel focused. It names the mod by its title, source and version, and
 * shows the mod's `api` range and the app's mod API version. "Run anyway"
 * starts the mod; Cancel and Escape leave it unstarted. The page renders it
 * only while the visible sandbox is asking.
 */
export function ApiMismatchDialog({
  sandbox,
  onAnswer,
}: ApiMismatchDialogProps): ReactElement {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  function handleRunClick(): void {
    onAnswer(sandbox.id, true);
  }

  function handleCancelClick(): void {
    onAnswer(sandbox.id, false);
  }

  if (sandbox.mod === null || sandbox.apiMismatch === null) {
    return (
      <StageDialog
        shownKey={null}
        cancelRef={cancelRef}
        onCancel={handleCancelClick}
      />
    );
  }
  return (
    <StageDialog
      shownKey={sandbox.id}
      labelledBy={titleId}
      cancelRef={cancelRef}
      onCancel={handleCancelClick}
    >
      <h2
        id={titleId}
        className="text-lg font-semibold tracking-tight [overflow-wrap:anywhere]"
      >
        {sandbox.mod.title}
      </h2>
      {/* Under the title, so a mod that borrows another title still shows where it comes from. */}
      <code className="block text-sm text-muted-foreground [overflow-wrap:anywhere]">
        {sandbox.mod.source}
      </code>
      <p className="mt-4 mb-1">
        Version {sandbox.mod.version} of this mod was written for another
        version of the mod API, so it may not work as expected.
      </p>
      <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-3 rounded-md bg-muted p-2 [overflow-wrap:anywhere]">
        <dt>Written for</dt>
        <dd className="m-0">
          <code>{sandbox.apiMismatch.range}</code>
        </dd>
        <dt>This app has</dt>
        <dd className="m-0">
          <code>{sandbox.apiMismatch.apiVersion}</code>
        </dd>
      </dl>
      <div className="mt-4 flex justify-end gap-2">
        <Button
          ref={cancelRef}
          type="button"
          variant="outline"
          onClick={handleCancelClick}
        >
          Cancel
        </Button>
        <Button type="button" onClick={handleRunClick}>
          Run anyway
        </Button>
      </div>
    </StageDialog>
  );
}
