import { useCallback, useEffect, useRef } from "react";
import type { ReactElement } from "react";
import { Alert, AlertDescription } from "@/vendor/shadcn/ui/alert.tsx";
import type { CombinationCatalog } from "../../lib/core/combinations/index.ts";
import {
  answerApiMismatch,
  answerSiteConsent,
  answerStageAction,
  isCatalogAction,
  markStageActionPlaying,
  readStageSnapshot,
  subscribeStage,
} from "../../lib/core/stage/index.ts";
import type {
  ActionSnapshot,
  CheckSnapshot,
  SandboxSnapshot,
  SiteConsentAnswer,
  Stage,
  StageSnapshot,
} from "../../lib/core/stage/index.ts";
import type { PlayerSites } from "../settings/player_sites.ts";
import type { RecentlyUsed } from "../settings/recently_used.ts";
import type { ListChoices } from "./list_choices.ts";
import { useStoreSnapshot } from "../use_store_snapshot.ts";
import { ActionDialog } from "./ActionDialog.tsx";
import type { QuestionSnapshot } from "./ActionDialog.tsx";
import { ApiMismatchDialog } from "./ApiMismatchDialog.tsx";
import { CheckFrame } from "./CheckFrame.tsx";
import { PlayerDialog } from "./PlayerDialog.tsx";
import type { PlayerSnapshot } from "./PlayerDialog.tsx";
import { SandboxFrame } from "./SandboxFrame.tsx";
import { SiteConsentDialog } from "./SiteConsentDialog.tsx";
import { StageBar } from "./StageBar.tsx";
import {
  findSandboxFrame,
  followFullscreenChange,
  showSandboxFullscreen,
} from "./stage_fullscreen.ts";
import type { TheaterSetting } from "./theater_setting.ts";
import { UserCatalogDialog } from "../user_catalog/UserCatalogDialog.tsx";
import type { CatalogActionSnapshot } from "../user_catalog/UserCatalogDialog.tsx";
import type { UserCatalogStore } from "../user_catalog/user_catalog_store.ts";
import "./stage.css";

interface StageViewProps {
  stage: Stage;
  /** The summaries and counts of the stage bar's lists. */
  combinations: CombinationCatalog;
  /** The sort and filter choices of the stage bar's lists. */
  listChoices: ListChoices;
  /** The mods, collections and mosaics tried in combination sandboxes. */
  recentlyUsed: RecentlyUsed;
  /** The sites the user always plays from, which the player dialog reads and remembers. */
  playerSites: PlayerSites;
  /** The user's own mosaics, which the user catalog dialogs change. */
  userCatalog: UserCatalogStore;
  /** Theater mode, which the stage bar's button turns on and off. */
  theater: TheaterSetting;
}

/** The shown action for the player dialog, or `null` when it is not a player. */
function readShownPlayer(shown: ActionSnapshot | null): PlayerSnapshot | null {
  if (shown === null || shown.action.kind !== "player") {
    return null;
  }
  const player: PlayerSnapshot = {
    id: shown.id,
    mod: shown.mod,
    action: shown.action,
  };
  return player;
}

/** The shown action for the user catalog dialogs, or `null` when it is not a `userCatalog.*` request's. */
function readShownCatalogAction(
  shown: ActionSnapshot | null,
): CatalogActionSnapshot | null {
  if (shown === null || !isCatalogAction(shown.action)) {
    return null;
  }
  const catalogAction: CatalogActionSnapshot = {
    id: shown.id,
    mod: shown.mod,
    action: shown.action,
  };
  return catalogAction;
}

/** The shown action for the action dialog, or `null` when it is a player or a user catalog action. */
function readShownQuestion(
  shown: ActionSnapshot | null,
): QuestionSnapshot | null {
  if (
    shown === null ||
    shown.action.kind === "player" ||
    isCatalogAction(shown.action)
  ) {
    return null;
  }
  const question: QuestionSnapshot = {
    id: shown.id,
    mod: shown.mod,
    action: shown.action,
  };
  return question;
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

function stopFollowingFullscreen(listener: () => void): void {
  document.removeEventListener("fullscreenchange", listener);
}

/**
 * Tells the stage which sandbox is fullscreen on every `fullscreenchange` of
 * the app's document, whoever started or ended it. Returns the function that
 * stops it.
 */
function followFullscreen(stage: Stage): () => void {
  const listener = followFullscreenChange.bind(undefined, stage);
  document.addEventListener("fullscreenchange", listener);
  return stopFollowingFullscreen.bind(undefined, listener);
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
 * visible mod asked for, if any, or the player dialog when it is a player, and the API mismatch dialog and then the
 * site consent dialog ask about the visible sandbox while its mod waits for
 * an answer; a sandbox asks one question at a time. When the visible sandbox
 * changes, the page leaves fullscreen. Every `fullscreenchange` tells the
 * stage which sandbox's frame is fullscreen, so its layout follows. The frames of running mod checks sit
 * behind the sandboxes, hidden by layout (see CheckFrame).
 */
export function StageView({
  stage,
  combinations,
  listChoices,
  recentlyUsed,
  playerSites,
  userCatalog,
  theater,
}: StageViewProps): ReactElement {
  const snapshot = useStoreSnapshot(stage, subscribeStage, readStageSnapshot);
  const stageViewRef = useRef<HTMLDivElement>(null);

  useEffect(
    function followFullscreenChanges(): () => void {
      return followFullscreen(stage);
    },
    [stage],
  );

  function handleFullscreen(sandboxId: string): void {
    const stageView = stageViewRef.current;
    const frame =
      stageView === null ? null : findSandboxFrame(stageView, sandboxId);
    if (frame === null) {
      return;
    }
    void showSandboxFullscreen(stage, frame, sandboxId);
  }

  function handleActionAnswer(id: number, accepted: boolean): void {
    answerStageAction(stage, id, accepted);
  }

  const handlePlay = useCallback(
    function markPlaying(id: number): void {
      markStageActionPlaying(stage, id);
    },
    [stage],
  );

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

  const shownCatalogAction = readShownCatalogAction(snapshot.action);
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
      ref={stageViewRef}
      className="flex flex-1 flex-col gap-(--shell-gap)"
      data-stage-view=""
      hidden={snapshot.visible?.kind === "page"}
    >
      {visibleSandbox === null ? null : (
        <StageBar
          stage={stage}
          combinations={combinations}
          listChoices={listChoices}
          recentlyUsed={recentlyUsed}
          sandbox={visibleSandbox}
          isTheaterMode={snapshot.isTheaterMode}
          theater={theater}
          onFullscreen={handleFullscreen}
        />
      )}
      <div className="relative flex flex-1 flex-col">
        {sandboxes}
        {checkFrames}
      </div>
      <ActionDialog
        shown={readShownQuestion(snapshot.action)}
        onAnswer={handleActionAnswer}
      />
      {shownCatalogAction === null ? null : (
        <UserCatalogDialog
          shown={shownCatalogAction}
          userCatalog={userCatalog}
          onAnswer={handleActionAnswer}
        />
      )}
      <PlayerDialog
        shown={readShownPlayer(snapshot.action)}
        playerSites={playerSites}
        onPlay={handlePlay}
        onAnswer={handleActionAnswer}
      />
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
