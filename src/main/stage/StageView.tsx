import { useEffect } from "react";
import type { ReactElement } from "react";
import { Alert, AlertDescription } from "@/vendor/shadcn/ui/alert.tsx";
import {
  answerApiMismatch,
  answerSiteConsent,
  answerStageAction,
  readStageSnapshot,
  subscribeStage,
} from "../../lib/core/stage/index.ts";
import type {
  CheckSnapshot,
  SandboxSnapshot,
  SiteConsentAnswer,
  Stage,
  StageSnapshot,
} from "../../lib/core/stage/index.ts";
import { useStoreSnapshot } from "../use_store_snapshot.ts";
import { ActionDialog } from "./ActionDialog.tsx";
import { ApiMismatchDialog } from "./ApiMismatchDialog.tsx";
import { CheckFrame } from "./CheckFrame.tsx";
import { SandboxFrame } from "./SandboxFrame.tsx";
import { SiteConsentDialog } from "./SiteConsentDialog.tsx";
import { StageBar } from "./StageBar.tsx";
import "./stage.css";

interface StageViewProps {
  stage: Stage;
}

function renderSandboxContent(
  stage: Stage,
  sandbox: SandboxSnapshot,
): ReactElement | null {
  if (sandbox.status === "failed") {
    // shadcn's Alert has `role="alert"`. The border matches the mods' alerts.
    return (
      <Alert
        variant="destructive"
        className="border-destructive [overflow-wrap:anywhere]"
      >
        <AlertDescription>{sandbox.errorMessage}</AlertDescription>
      </Alert>
    );
  }
  if (sandbox.status === "loading") {
    return <p className="text-muted-foreground">Loading…</p>;
  }
  if (sandbox.status === "asking") {
    return <p className="text-muted-foreground">Waiting for your answer…</p>;
  }
  if (sandbox.sandboxDocument === null) {
    return null;
  }
  return (
    <SandboxFrame
      stage={stage}
      sandbox={sandbox}
      sandboxDocument={sandbox.sandboxDocument}
    />
  );
}

function renderSandbox(stage: Stage, sandbox: SandboxSnapshot): ReactElement {
  return (
    <div
      key={sandbox.id}
      className="sandbox flex flex-1 flex-col"
      data-sandbox-id={sandbox.id}
      hidden={!sandbox.isVisible}
    >
      {renderSandboxContent(stage, sandbox)}
    </div>
  );
}

function renderCheckFrame(stage: Stage, check: CheckSnapshot): ReactElement {
  return <CheckFrame key={check.key} stage={stage} check={check} />;
}

function ignoreExitError(): void {
  // The document left fullscreen meanwhile.
}

/** A hidden frame never keeps the screen. */
function leaveFullscreen(): void {
  if ((document.fullscreenElement ?? null) === null) {
    return;
  }
  document.exitFullscreen().catch(ignoreExitError);
}

function findVisibleSandbox(snapshot: StageSnapshot): SandboxSnapshot | null {
  for (const sandbox of snapshot.sandboxes) {
    if (sandbox.isVisible) {
      return sandbox;
    }
  }
  return null;
}

/**
 * Every sandbox of the stage, in creation order and keyed by id, so a frame
 * never moves in the DOM (moving an iframe reloads it). Only the visible one
 * is shown, under the stage bar. While a page is shown, the whole view is
 * hidden but stays mounted, so no frame reloads. The action dialog shows the action the
 * visible mod asked for, if any, and the API mismatch dialog and then the
 * site consent dialog ask about the visible sandbox while its mod waits for
 * an answer; a sandbox asks one question at a time. When the visible sandbox
 * changes, the page leaves fullscreen. The frames of running mod checks sit
 * behind the sandboxes, hidden by layout (see CheckFrame).
 */
export function StageView({ stage }: StageViewProps): ReactElement {
  const snapshot = useStoreSnapshot(stage, subscribeStage, readStageSnapshot);

  function handleActionAnswer(id: number, accepted: boolean): void {
    answerStageAction(stage, id, accepted);
  }

  function handleApiMismatchAnswer(
    sandboxId: string,
    runAnyway: boolean,
  ): void {
    answerApiMismatch(stage, sandboxId, runAnyway);
  }

  function handleSiteConsentAnswer(
    sandboxId: string,
    answer: SiteConsentAnswer | null,
  ): void {
    answerSiteConsent(stage, sandboxId, answer);
  }

  const visibleSandbox = findVisibleSandbox(snapshot);
  const visibleId = visibleSandbox?.id ?? null;
  useEffect(
    function leaveFullscreenOnSwitch(): void {
      leaveFullscreen();
    },
    [visibleId],
  );
  const sandboxes: ReactElement[] = [];
  for (const sandbox of snapshot.sandboxes) {
    sandboxes.push(renderSandbox(stage, sandbox));
  }
  const checkFrames: ReactElement[] = [];
  for (const check of snapshot.checks) {
    checkFrames.push(renderCheckFrame(stage, check));
  }
  return (
    <div
      className="flex flex-1 flex-col gap-2 px-4 pt-2 pb-4"
      data-stage-view=""
      hidden={snapshot.visible?.kind === "page"}
    >
      {visibleSandbox === null ? null : (
        <StageBar stage={stage} sandbox={visibleSandbox} />
      )}
      <div className="relative flex flex-1 flex-col">
        {sandboxes}
        {checkFrames}
      </div>
      <ActionDialog shown={snapshot.action} onAnswer={handleActionAnswer} />
      {visibleSandbox?.status === "asking" ? (
        <ApiMismatchDialog
          sandbox={visibleSandbox}
          onAnswer={handleApiMismatchAnswer}
        />
      ) : null}
      {visibleSandbox?.siteConsent ? (
        <SiteConsentDialog
          key={visibleSandbox.id}
          sandbox={visibleSandbox}
          onAnswer={handleSiteConsentAnswer}
        />
      ) : null}
    </div>
  );
}
