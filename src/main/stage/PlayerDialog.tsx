import { useEffect, useId, useRef, useState } from "react";
import type { CSSProperties, ReactElement } from "react";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/vendor/shadcn/ui/button.tsx";
import { Checkbox } from "@/vendor/shadcn/ui/checkbox.tsx";
import { Label } from "@/vendor/shadcn/ui/label.tsx";
import type { ActionMod, PlayerAction } from "../../lib/core/stage/index.ts";
import {
  readPlayerSitesSnapshot,
  rememberPlayerSite,
} from "../settings/player_sites.ts";
import type { PlayerSites } from "../settings/player_sites.ts";
import { StageDialog } from "./StageDialog.tsx";

/** The shown action when it is a player. */
export interface PlayerSnapshot {
  id: number;
  mod: ActionMod;
  action: PlayerAction;
}

interface PlayerDialogProps {
  /** The player to show, or `null` to keep the dialog closed. */
  shown: PlayerSnapshot | null;
  playerSites: PlayerSites;
  /** The user pressed Play, or the site was remembered: the player is shown. */
  onPlay: (id: number) => void;
  /** `true` once the player was shown, `false` when the user cancelled before. */
  onAnswer: (id: number, accepted: boolean) => void;
}

/** What a checkbox reports when it changes: `"indeterminate"` only for a mixed one. */
type CheckedState = boolean | "indeterminate";

/** Set by the app, never taken from the tile. The frame's origin is the site's, so `allow-same-origin` gives it nothing of the app's. */
const PLAYER_SANDBOX =
  "allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-presentation";

const PLAYER_PERMISSIONS =
  "autoplay; encrypted-media; picture-in-picture; fullscreen";

function buildFrameStyle(action: PlayerAction): CSSProperties {
  if ("ratio" in action.shape) {
    const ratioStyle: CSSProperties = {
      aspectRatio: String(action.shape.ratio),
    };
    return ratioStyle;
  }
  const heightStyle: CSSProperties = { height: `${action.shape.height}px` };
  return heightStyle;
}

function describeSite(action: PlayerAction): string {
  const siteName = action.siteName ?? action.host;
  return siteName;
}

interface PlayerFrameProps {
  action: PlayerAction;
}

interface PlayerLoadingProps {
  host: string;
}

/** Covers the player's box while its frame loads, which can take seconds on a slow site. */
function PlayerLoading({ host }: PlayerLoadingProps): ReactElement {
  return (
    <div
      role="status"
      className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-md bg-muted p-4 text-center text-sm text-muted-foreground"
    >
      <LoaderCircle
        aria-hidden="true"
        className="size-6 motion-safe:animate-spin"
      />
      <span className="[overflow-wrap:anywhere]">
        Loading the player from {host}…
      </span>
    </div>
  );
}

/**
 * The player, in a frame of the app's page whose attributes the app sets,
 * under a loading status until the frame fires `load`. The page keys it by
 * action, so each player starts loading.
 */
function PlayerFrame({ action }: PlayerFrameProps): ReactElement {
  const [isLoaded, setIsLoaded] = useState(false);

  function handleFrameLoad(): void {
    setIsLoaded(true);
  }

  return (
    <div className="relative mt-4">
      <iframe
        src={action.frameUrl}
        title={`${describeSite(action)} player`}
        sandbox={PLAYER_SANDBOX}
        allow={PLAYER_PERMISSIONS}
        referrerPolicy="strict-origin"
        className="block w-full rounded-md border-0 bg-muted"
        style={buildFrameStyle(action)}
        onLoad={handleFrameLoad}
      />
      {isLoaded ? null : <PlayerLoading host={action.host} />}
    </div>
  );
}

/**
 * The app's dialog for `players.open`, a `StageDialog` like the action
 * dialog: modal, out of every frame's reach. It first asks, naming the mod by
 * its title and source and the site the player loads from, with Cancel
 * focused: nothing is requested from the site before Play. Always play from
 * remembers the host for every mod when Play is pressed, and a remembered
 * host skips the question when the dialog opens. After Play, the player
 * plays in a frame of the app's page, under a header that keeps naming the
 * host, with Close focused. Cancel and Escape answer `false` before Play;
 * Close and Escape answer `true` after it. The page removes the frame once
 * the answer removed the action, so playback stops.
 */
export function PlayerDialog({
  shown,
  playerSites,
  onPlay,
  onAnswer,
}: PlayerDialogProps): ReactElement {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const alwaysId = useId();
  const [openedId, setOpenedId] = useState<number | null>(null);
  const [playingId, setPlayingId] = useState<number | null>(null);
  const [alwaysPlays, setAlwaysPlays] = useState(false);

  // Read once when a player opens, so removing the host meanwhile never stops it.
  if (shown !== null && shown.id !== openedId) {
    setOpenedId(shown.id);
    setAlwaysPlays(false);
    const isRemembered = readPlayerSitesSnapshot(playerSites).includes(
      shown.action.host,
    );
    setPlayingId(isRemembered ? shown.id : null);
  }

  useEffect(
    function reportPlaying(): void {
      if (playingId !== null) {
        onPlay(playingId);
      }
    },
    [playingId, onPlay],
  );

  const isPlaying = shown !== null && playingId === shown.id;

  function handleAlwaysChange(checked: CheckedState): void {
    setAlwaysPlays(checked === true);
  }

  function handlePlayClick(): void {
    if (shown === null) {
      return;
    }
    if (alwaysPlays) {
      rememberPlayerSite(playerSites, shown.action.host);
    }
    setPlayingId(shown.id);
  }

  function handleCancel(): void {
    if (shown === null) {
      return;
    }
    onAnswer(shown.id, isPlaying);
  }

  if (shown === null) {
    return (
      <StageDialog
        shownKey={null}
        cancelRef={cancelRef}
        onCancel={handleCancel}
      />
    );
  }
  const action = shown.action;
  return (
    <StageDialog
      shownKey={isPlaying ? `${shown.id}-playing` : shown.id}
      labelledBy={titleId}
      cancelRef={cancelRef}
      onCancel={handleCancel}
      isWide={isPlaying}
    >
      <h2
        id={titleId}
        className="text-lg font-semibold tracking-tight [overflow-wrap:anywhere]"
      >
        {shown.mod.title}
      </h2>
      {/* Under the title, so a mod that borrows another title still shows where it comes from. */}
      <code className="block text-sm text-muted-foreground [overflow-wrap:anywhere]">
        {shown.mod.source}
      </code>
      <p className="mt-4 mb-1">
        {isPlaying ? "is playing:" : "wants to play:"}
      </p>
      <div className="rounded-md bg-muted p-2 [overflow-wrap:anywhere]">
        {/* The tile's words, as plain text: the whole title, which the placeholder may cut. */}
        {action.title === null ? null : (
          <p className="player-dialog-title m-0 mb-1 font-medium">
            {action.title}
          </p>
        )}
        <p className="m-0">
          {action.siteName === null ? null : (
            <strong className="mr-2">{action.siteName}</strong>
          )}
          <code className="player-dialog-host font-mono">{action.host}</code>
        </p>
      </div>
      {isPlaying ? (
        <PlayerFrame key={shown.id} action={action} />
      ) : (
        <>
          <p className="mt-4 mb-0">
            Nothing is loaded from {action.host} until you press Play.{" "}
            {action.host} will see that you played this.
          </p>
          <div className="mt-4 flex items-center gap-2">
            <Checkbox
              id={alwaysId}
              checked={alwaysPlays}
              onCheckedChange={handleAlwaysChange}
            />
            <Label htmlFor={alwaysId}>Always play from {action.host}</Label>
          </div>
        </>
      )}
      <div className="mt-4 flex justify-end gap-2">
        {isPlaying ? (
          <Button
            ref={cancelRef}
            type="button"
            variant="outline"
            onClick={handleCancel}
          >
            Close
          </Button>
        ) : (
          <>
            <Button
              ref={cancelRef}
              type="button"
              variant="outline"
              onClick={handleCancel}
            >
              Cancel
            </Button>
            <Button type="button" onClick={handlePlayClick}>
              Play
            </Button>
          </>
        )}
      </div>
    </StageDialog>
  );
}
