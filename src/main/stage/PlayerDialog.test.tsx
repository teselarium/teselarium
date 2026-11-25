import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import type { PlayerAction } from "../../lib/core/stage/index.ts";
import { createMemoryStorage } from "../../test/memory_storage.ts";
import { SAMPLE_MOD_SOURCE } from "../../test/sample_mods.ts";
import {
  createPlayerSites,
  readPlayerSitesSnapshot,
  rememberPlayerSite,
} from "../settings/player_sites.ts";
import type { PlayerSites } from "../settings/player_sites.ts";
import { PlayerDialog } from "./PlayerDialog.tsx";
import type { PlayerSnapshot } from "./PlayerDialog.tsx";

const MOD = { title: "Book List", source: SAMPLE_MOD_SOURCE };

const YOUTUBE_PLAYER: PlayerAction = {
  kind: "player",
  title: "Big Buck Bunny",
  frameUrl: "https://www.youtube-nocookie.com/embed/aqz-KE-bpKQ",
  host: "www.youtube-nocookie.com",
  siteName: "YouTube",
  shape: { ratio: 16 / 9 },
};

const MAP_PLAYER: PlayerAction = {
  kind: "player",
  title: null,
  frameUrl: "https://maps.example.net/embed",
  host: "maps.example.net",
  siteName: null,
  shape: { ratio: 4 / 3 },
};

let onAnswer: Mock<(id: number, accepted: boolean) => void>;
let onPlay: Mock<(id: number) => void>;
let playerSites: PlayerSites;

beforeEach(function createCallbacks(): void {
  onAnswer = vi.fn<(id: number, accepted: boolean) => void>();
  onPlay = vi.fn<(id: number) => void>();
  playerSites = createPlayerSites({ storage: createMemoryStorage() });
});

function buildShown(action: PlayerAction, id: number = 4): PlayerSnapshot {
  const shown: PlayerSnapshot = { id, mod: MOD, action };
  return shown;
}

function renderDialog(shown: PlayerSnapshot | null): {
  dialog: HTMLDialogElement;
  rerender: (shown: PlayerSnapshot | null) => void;
} {
  const rendered = render(
    <PlayerDialog
      shown={shown}
      playerSites={playerSites}
      onPlay={onPlay}
      onAnswer={onAnswer}
    />,
  );
  const dialog = document.querySelector("dialog");
  if (dialog === null) {
    throw new Error("Expected a dialog element");
  }
  function rerenderDialog(nextShown: PlayerSnapshot | null): void {
    rendered.rerender(
      <PlayerDialog
        shown={nextShown}
        playerSites={playerSites}
        onPlay={onPlay}
        onAnswer={onAnswer}
      />,
    );
  }
  const renderedDialog = { dialog, rerender: rerenderDialog };
  return renderedDialog;
}

function readPlayerFrame(): HTMLIFrameElement | null {
  const frame = document.querySelector("dialog iframe");
  return frame instanceof HTMLIFrameElement ? frame : null;
}

function pressPlay(): void {
  fireEvent.click(screen.getByRole("button", { name: "Play" }));
}

describe("PlayerDialog", function describePlayerDialog(): void {
  it("stays closed without a player", function staysClosed(): void {
    const { dialog } = renderDialog(null);

    expect(dialog.open).toBe(false);
  });

  it("Question before the player", function asksFirst(): void {
    const { dialog } = renderDialog(buildShown(YOUTUBE_PLAYER));

    expect(dialog.open).toBe(true);
    expect(
      screen.getByRole("heading", { name: "Book List" }),
    ).toBeInTheDocument();
    expect(dialog).toHaveTextContent(MOD.source);
    expect(dialog).toHaveTextContent("YouTube");
    expect(dialog).toHaveTextContent("www.youtube-nocookie.com");
    expect(dialog).toHaveTextContent(
      "www.youtube-nocookie.com will see that you played this",
    );
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
    expect(
      screen.getByRole("checkbox", {
        name: "Always play from www.youtube-nocookie.com",
      }),
    ).not.toBeChecked();
    expect(readPlayerFrame()).toBeNull();
    expect(onPlay).not.toHaveBeenCalled();
  });

  it("shows the title the tile gives the player, before and while it plays", function showsTitle(): void {
    renderDialog(buildShown(YOUTUBE_PLAYER));

    expect(screen.getByText("Big Buck Bunny")).toBeInTheDocument();
    pressPlay();
    expect(screen.getByText("Big Buck Bunny")).toBeInTheDocument();
  });

  it("shows the site alone for a player without a title", function showsSiteAlone(): void {
    const { dialog } = renderDialog(buildShown(MAP_PLAYER));

    expect(dialog.querySelector(".player-dialog-title")).toBeNull();
    expect(dialog).toHaveTextContent("wants to play:maps.example.net");
  });

  it("Cancel", function answersCancel(): void {
    const { dialog } = renderDialog(buildShown(YOUTUBE_PLAYER));

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent(dialog, new Event("cancel", { cancelable: true }));

    expect(onAnswer.mock.calls).toEqual([
      [4, false],
      [4, false],
    ]);
    expect(readPlayerFrame()).toBeNull();
  });

  it("Tile asks for the camera: the app sets the frame's attributes after Play", function showsFrame(): void {
    renderDialog(buildShown(MAP_PLAYER));

    pressPlay();

    const frame = readPlayerFrame();
    expect(frame?.getAttribute("src")).toBe("https://maps.example.net/embed");
    expect(frame?.getAttribute("sandbox")).toBe(
      "allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-presentation",
    );
    expect(frame?.getAttribute("allow")).toBe(
      "autoplay; encrypted-media; picture-in-picture; fullscreen",
    );
    expect(frame?.getAttribute("allow")).not.toMatch(/camera|microphone/);
    expect(frame?.getAttribute("referrerpolicy")).toBe("strict-origin");
    expect(frame?.style.aspectRatio).toContain(String(4 / 3));
    expect(onPlay).toHaveBeenCalledWith(4);
    expect(screen.getByRole("button", { name: "Close" })).toHaveFocus();
  });

  it("shows a loading status over the player until its frame loads", function showsLoading(): void {
    renderDialog(buildShown(YOUTUBE_PLAYER));

    pressPlay();

    expect(screen.getByRole("status")).toHaveTextContent(
      "Loading the player from www.youtube-nocookie.com…",
    );
    const frame = readPlayerFrame();
    if (frame === null) {
      throw new Error("Expected a player frame");
    }
    fireEvent.load(frame);
    expect(screen.queryByRole("status")).toBeNull();
    expect(readPlayerFrame()).toBe(frame);
  });

  it("shows the loading status again for the next player", function resetsLoading(): void {
    rememberPlayerSite(playerSites, YOUTUBE_PLAYER.host);
    const { rerender } = renderDialog(buildShown(YOUTUBE_PLAYER));
    const frame = readPlayerFrame();
    if (frame === null) {
      throw new Error("Expected a player frame");
    }
    fireEvent.load(frame);

    rerender(buildShown(YOUTUBE_PLAYER, 5));

    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("sizes a widget by its height", function sizesByHeight(): void {
    renderDialog(
      buildShown({
        kind: "player",
        title: null,
        frameUrl: "https://w.soundcloud.com/player/?url=x",
        host: "w.soundcloud.com",
        siteName: "SoundCloud",
        shape: { height: 166 },
      }),
    );

    pressPlay();

    expect(readPlayerFrame()?.style.height).toBe("166px");
  });

  it("Close answers true and removes the frame", function answersClose(): void {
    const { rerender } = renderDialog(buildShown(YOUTUBE_PLAYER));
    pressPlay();

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    rerender(null);

    expect(onAnswer).toHaveBeenCalledWith(4, true);
    expect(readPlayerFrame()).toBeNull();
  });

  it("Escape while playing answers true and removes the frame", function answersEscapeWhilePlaying(): void {
    const { dialog, rerender } = renderDialog(buildShown(YOUTUBE_PLAYER));
    pressPlay();

    fireEvent(dialog, new Event("cancel", { cancelable: true }));
    rerender(null);

    expect(onAnswer).toHaveBeenCalledWith(4, true);
    expect(readPlayerFrame()).toBeNull();
  });

  it("Remembered site", function skipsQuestion(): void {
    rememberPlayerSite(playerSites, YOUTUBE_PLAYER.host);

    renderDialog(buildShown(YOUTUBE_PLAYER));

    expect(readPlayerFrame()).not.toBeNull();
    expect(screen.queryByRole("button", { name: "Play" })).toBeNull();
    expect(onPlay).toHaveBeenCalledWith(4);
  });

  it("asks again for the next player of a site not remembered", function asksForNextPlayer(): void {
    const { rerender } = renderDialog(buildShown(YOUTUBE_PLAYER));
    pressPlay();

    rerender(buildShown(YOUTUBE_PLAYER, 5));

    expect(readPlayerFrame()).toBeNull();
    expect(screen.getByRole("button", { name: "Play" })).toBeInTheDocument();
  });

  it("remembers the site only when Always play from is checked", function remembersWhenChecked(): void {
    const { rerender } = renderDialog(buildShown(MAP_PLAYER));
    pressPlay();
    expect(readPlayerSitesSnapshot(playerSites)).toEqual([]);

    rerender(buildShown(YOUTUBE_PLAYER, 5));
    fireEvent.click(
      screen.getByRole("checkbox", {
        name: "Always play from www.youtube-nocookie.com",
      }),
    );
    pressPlay();

    expect(readPlayerSitesSnapshot(playerSites)).toEqual([
      "www.youtube-nocookie.com",
    ]);
  });

  it("keeps playing when the site is removed meanwhile", function keepsPlaying(): void {
    rememberPlayerSite(playerSites, YOUTUBE_PLAYER.host);
    const shown = buildShown(YOUTUBE_PLAYER);
    const { rerender } = renderDialog(shown);

    playerSites = createPlayerSites({ storage: createMemoryStorage() });
    rerender(shown);

    expect(readPlayerFrame()).not.toBeNull();
  });
});
