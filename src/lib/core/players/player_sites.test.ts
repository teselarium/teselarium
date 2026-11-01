import { describe, expect, it } from "vitest";
import { readIframePlayer, readPlayer } from "./player_sites.ts";
import type { Player } from "./player_sites.ts";

const YOUTUBE_PLAYER: Player = {
  frameUrl: "https://www.youtube-nocookie.com/embed/aqz-KE-bpKQ",
  host: "www.youtube-nocookie.com",
  siteName: "YouTube",
  shape: { ratio: 16 / 9 },
};

const VIMEO_PLAYER: Player = {
  frameUrl: "https://player.vimeo.com/video/1084537",
  host: "player.vimeo.com",
  siteName: "Vimeo",
  shape: { ratio: 16 / 9 },
};

function buildSoundCloudPlayer(page: string, height: number): Player {
  const player: Player = {
    frameUrl: `https://w.soundcloud.com/player/?url=${encodeURIComponent(page)}`,
    host: "w.soundcloud.com",
    siteName: "SoundCloud",
    shape: { height },
  };
  return player;
}

describe("Known sites", function describeKnownSites(): void {
  it("YouTube in privacy-enhanced mode", function readsYouTubePage(): void {
    const player = readPlayer(
      "https://www.youtube.com/watch?v=aqz-KE-bpKQ&t=30",
    );

    expect(player).toEqual(YOUTUBE_PLAYER);
  });

  it("Pasted YouTube iframe", function readsYouTubeEmbed(): void {
    const player = readPlayer("https://www.youtube.com/embed/aqz-KE-bpKQ");

    expect(player).toEqual(YOUTUBE_PLAYER);
  });

  it("SoundCloud page", function readsSoundCloudTrack(): void {
    const player = readPlayer("https://soundcloud.com/artist/track");

    expect(player).toEqual(
      buildSoundCloudPlayer("https://soundcloud.com/artist/track", 166),
    );
  });

  it("reads a SoundCloud playlist with the taller widget", function readsSoundCloudSet(): void {
    const player = readPlayer("https://soundcloud.com/artist/sets/album");

    expect(player).toEqual(
      buildSoundCloudPlayer("https://soundcloud.com/artist/sets/album", 450),
    );
  });

  it("reads a pasted SoundCloud widget from its page", function readsSoundCloudWidget(): void {
    const page = "https://soundcloud.com/artist/track";

    const player = readPlayer(
      `https://w.soundcloud.com/player/?url=${encodeURIComponent(page)}&auto_play=true`,
    );

    expect(player).toEqual(buildSoundCloudPlayer(page, 166));
  });

  it("reads youtu.be links", function readsShortYouTubeLink(): void {
    const player = readPlayer("https://youtu.be/aqz-KE-bpKQ?si=share");

    expect(player).toEqual(YOUTUBE_PLAYER);
  });

  it("reads m.youtube.com links", function readsMobileYouTubeLink(): void {
    const player = readPlayer("https://m.youtube.com/watch?v=aqz-KE-bpKQ");

    expect(player).toEqual(YOUTUBE_PLAYER);
  });

  it("reads youtube-nocookie.com players", function readsNoCookiePlayer(): void {
    const player = readPlayer(
      "https://www.youtube-nocookie.com/embed/aqz-KE-bpKQ",
    );

    expect(player).toEqual(YOUTUBE_PLAYER);
  });

  it("refuses YouTube ids of 10 or 12 characters", function refusesWrongIdLength(): void {
    const shortIdPlayer = readPlayer(
      "https://www.youtube.com/watch?v=aqz-KE-bpK",
    );
    const longIdPlayer = readPlayer(
      "https://www.youtube.com/embed/aqz-KE-bpKQQ",
    );

    expect(shortIdPlayer).toBeNull();
    expect(longIdPlayer).toBeNull();
  });

  it("drops the query, so a link cannot reach the player with autoplay=1", function dropsQuery(): void {
    const youTubePlayer = readPlayer(
      "https://www.youtube.com/embed/aqz-KE-bpKQ?autoplay=1",
    );
    const vimeoPlayer = readPlayer(
      "https://player.vimeo.com/video/1084537?autoplay=1",
    );

    expect(youTubePlayer?.frameUrl).toBe(YOUTUBE_PLAYER.frameUrl);
    expect(vimeoPlayer?.frameUrl).toBe(VIMEO_PLAYER.frameUrl);
  });

  it("reads Vimeo pages and players", function readsVimeo(): void {
    const pagePlayer = readPlayer("https://vimeo.com/1084537");
    const embedPlayer = readPlayer("https://player.vimeo.com/video/1084537");

    expect(pagePlayer).toEqual(VIMEO_PLAYER);
    expect(embedPlayer).toEqual(VIMEO_PLAYER);
  });

  it("gives null for an unknown site", function refusesUnknownSite(): void {
    const player = readPlayer("https://example.org/about");

    expect(player).toBeNull();
  });

  it("gives null for other pages of a known site", function refusesOtherPages(): void {
    const channelPlayer = readPlayer("https://www.youtube.com/@channel");
    const vimeoChannelPlayer = readPlayer("https://vimeo.com/channels/staff");
    const soundCloudUserPlayer = readPlayer("https://soundcloud.com/artist");

    expect(channelPlayer).toBeNull();
    expect(vimeoChannelPlayer).toBeNull();
    expect(soundCloudUserPlayer).toBeNull();
  });

  it("gives null for addresses that are not https:", function refusesOtherProtocols(): void {
    const httpPlayer = readPlayer("http://www.youtube.com/watch?v=aqz-KE-bpKQ");
    const relativePlayer = readPlayer("/watch?v=aqz-KE-bpKQ");

    expect(httpPlayer).toBeNull();
    expect(relativePlayer).toBeNull();
  });
});

describe("Iframe players", function describeIframePlayers(): void {
  it("plays a known site through the table", function readsKnownIframe(): void {
    const player = readIframePlayer(
      "https://www.youtube.com/embed/aqz-KE-bpKQ",
      "560",
      "315",
    );

    expect(player).toEqual(YOUTUBE_PLAYER);
  });

  it("plays any other iframe from its own address, with its ratio", function readsGenericIframe(): void {
    const player = readIframePlayer(
      "https://maps.example.net/embed?id=7",
      "400",
      "300",
    );

    expect(player).toEqual({
      frameUrl: "https://maps.example.net/embed?id=7",
      host: "maps.example.net",
      siteName: null,
      shape: { ratio: 4 / 3 },
    });
  });

  it("gives 16:9 to an iframe without a valid width and height", function defaultsRatio(): void {
    const missingPlayer = readIframePlayer(
      "https://maps.example.net/embed",
      null,
      null,
    );
    const invalidPlayer = readIframePlayer(
      "https://maps.example.net/embed",
      "100%",
      "0",
    );

    expect(missingPlayer.shape).toEqual({ ratio: 16 / 9 });
    expect(invalidPlayer.shape).toEqual({ ratio: 16 / 9 });
  });
});
