import { describe, expect, it } from "vitest";
import type { Tile } from "../../tile/index.ts";
import { renderTileBody } from "./render_body.ts";
import type { RenderedBody } from "./render_body.ts";

const TILE_SOURCE = "https://example.org/books/kallocain.md";

function buildBodyTile(body: string, source: string = TILE_SOURCE): Tile {
  const tile: Tile = {
    source,
    metadata: { title: "Kallocain" },
    body,
    types: [],
  };
  return tile;
}

function renderBody(body: string): RenderedBody {
  const renderedBody = renderTileBody(buildBodyTile(body));
  return renderedBody;
}

function renderHtml(body: string): string {
  const html = renderBody(body).html;
  return html;
}

describe("Render a tile's body", function describeRenderBody(): void {
  it("renders paragraphs and emphasis", function rendersMarkdown(): void {
    const html = renderHtml("A *calm* state.\n\nSecond paragraph.");

    expect(html).toBe(
      "<p>A <em>calm</em> state.</p>\n<p>Second paragraph.</p>",
    );
  });

  it("renders an empty body as an empty string", function rendersEmptyBody(): void {
    const renderedBody = renderBody("");

    expect(renderedBody).toEqual({
      html: "",
      mediaUrls: [],
      playerAddresses: new Map(),
      issues: [],
    });
  });
});

describe("Rendered bodies hold only safe HTML", function describeSafeHtml(): void {
  it("Script in a body", function dropsScripts(): void {
    const html = renderHtml(
      '<script>alert(1)</script>\n\n<img src="x.jpg" onerror="alert(1)">',
    );

    expect(html).not.toContain("<script");
    expect(html).not.toContain("onerror");
    expect(html).toContain('<img src="https://example.org/books/x.jpg"');
  });

  it("Script address in a link", function dropsScriptAddress(): void {
    const html = renderHtml("[Click](javascript:alert(1))");

    expect(html).not.toContain("javascript:");
    expect(html).toContain("Click");
  });

  it("drops styles, forms, frames and data: addresses", function dropsOtherUnsafeHtml(): void {
    const html = renderHtml(
      [
        '<p style="color: red">Red</p>',
        "<style>p { color: red; }</style>",
        '<form action="https://example.org"><input name="q"></form>',
        '<img src="data:image/png;base64,AAAA" alt="Data">',
        '<a href="vbscript:msgbox(1)">VB</a>',
      ].join("\n\n"),
    );

    expect(html).not.toContain("style");
    expect(html).not.toContain("<form");
    expect(html).not.toContain("data:");
    expect(html).not.toContain("vbscript:");
  });
});

describe("Paths in bodies are resolved against the tile", function describePaths(): void {
  it("Relative image", function resolvesImage(): void {
    const html = renderHtml("![Cover](./cover.jpg)");

    expect(html).toContain('src="https://example.org/books/cover.jpg"');
  });

  it("Relative link", function resolvesLink(): void {
    const html = renderHtml("[Next](../films/stalker.md)");

    expect(html).toBe(
      '<p><a href="https://example.org/films/stalker.md" data-ot-link="">Next</a></p>',
    );
  });

  it("keeps a fragment link as written and marks it", function marksFragmentLink(): void {
    const html = renderHtml("[See notes](#notes)");

    expect(html).toBe(
      '<p><a href="#notes" data-ot-fragment="">See notes</a></p>',
    );
  });

  it("leaves the tile's body as written", function keepsTileBody(): void {
    const tile = buildBodyTile("![Cover](./cover.jpg)");

    renderTileBody(tile);

    expect(tile.body).toBe("![Cover](./cover.jpg)");
  });
});

describe("Images in bodies load lazily", function describeImages(): void {
  it("Image attributes", function addsLazyLoading(): void {
    const html = renderHtml(
      '<img src="https://media.example.net/a.jpg" width="320" height="200" alt="A">',
    );

    expect(html).toBe(
      '<img src="https://media.example.net/a.jpg" width="320" height="200" alt="A" loading="lazy" decoding="async">',
    );
  });
});

describe("Video and audio in bodies", function describeVideoAndAudio(): void {
  it("Video with autoplay", function forcesControls(): void {
    const html = renderHtml('<video src="./trailer.mp4" autoplay></video>');

    expect(html).toBe(
      '<p><video src="https://example.org/books/trailer.mp4" controls preload="metadata"></video></p>',
    );
  });

  it("keeps audio with its sources", function keepsAudioSources(): void {
    const html = renderHtml(
      '<audio autoplay><source src="./theme.ogg" type="audio/ogg"></audio>',
    );

    expect(html).toBe(
      '<p><audio controls preload="metadata"><source src="https://example.org/books/theme.ogg" type="audio/ogg"></audio></p>',
    );
  });
});

describe("Players in bodies become placeholders", function describePlaceholders(): void {
  it("Pasted YouTube iframe", function replacesYouTubeIframe(): void {
    const renderedBody = renderBody(
      '<iframe src="https://www.youtube.com/embed/aqz-KE-bpKQ" title="Big Buck Bunny"></iframe>',
    );

    expect(renderedBody.html).toBe(
      '<button type="button" class="ot-player" data-ot-player="https://www.youtube.com/embed/aqz-KE-bpKQ"><span class="ot-player-box"><span class="ot-player-title">Big Buck Bunny</span><span class="ot-player-host">youtube.com</span></span></button>',
    );
    expect([...renderedBody.playerAddresses.keys()]).toEqual([
      "https://www.youtube.com/embed/aqz-KE-bpKQ",
    ]);
    expect(
      renderedBody.playerAddresses.get(
        "https://www.youtube.com/embed/aqz-KE-bpKQ",
      )?.title,
    ).toBe("Big Buck Bunny");
  });

  it("Image syntax with a page link", function replacesPageLinkImage(): void {
    const renderedBody = renderBody(
      "![Trailer](https://www.youtube.com/watch?v=aqz-KE-bpKQ)",
    );

    expect(renderedBody.html).toContain(
      '<button type="button" class="ot-player" data-ot-player="https://www.youtube.com/watch?v=aqz-KE-bpKQ"><span class="ot-player-box"><span class="ot-player-title">Trailer</span>',
    );
    expect(renderedBody.html).not.toContain("<img");
    expect(renderedBody.mediaUrls).toEqual([]);
    expect(
      renderedBody.playerAddresses.get(
        "https://www.youtube.com/watch?v=aqz-KE-bpKQ",
      )?.title,
    ).toBe("Trailer");
  });

  it("records a generic iframe with its own shape and drops its attributes", function recordsGenericIframe(): void {
    const renderedBody = renderBody(
      '<iframe src="https://maps.example.net/embed?id=7" width="400" height="300" allow="camera; microphone"></iframe>',
    );

    expect(renderedBody.html).not.toContain("allow");
    expect(renderedBody.html).toContain(
      '<span class="ot-player-host">maps.example.net</span>',
    );
    expect(
      renderedBody.playerAddresses.get("https://maps.example.net/embed?id=7"),
    ).toEqual({
      player: {
        frameUrl: "https://maps.example.net/embed?id=7",
        host: "maps.example.net",
        siteName: null,
        shape: { ratio: 4 / 3 },
      },
      title: null,
    });
    expect(renderedBody.html).toContain(
      '<span class="ot-player-title">Player</span>',
    );
  });

  it("does not record the address of a forged placeholder", function ignoresForgedPlaceholder(): void {
    const renderedBody = renderBody(
      '<button type="button" class="ot-player" data-ot-player="https://evil.example.net/embed">Play</button>',
    );

    expect(renderedBody.html).toContain(
      'data-ot-player="https://evil.example.net/embed"',
    );
    expect(renderedBody.playerAddresses.size).toBe(0);
  });
});

describe("Iframes that are not players", function describeOtherIframes(): void {
  it("Plain http page", function linksHttpIframe(): void {
    const renderedBody = renderBody(
      '<iframe src="http://example.org/widget" title="Widget"></iframe>',
    );

    expect(renderedBody.html).toBe(
      '<a href="http://example.org/widget" data-ot-link="">Widget</a>',
    );
    expect(renderedBody.playerAddresses.size).toBe(0);
  });

  it("Router address", function dropsPrivateIframe(): void {
    const renderedBody = renderBody(
      '<iframe src="https://192.168.1.1/"></iframe>',
    );

    expect(renderedBody.html).toBe("");
    expect(renderedBody.playerAddresses.size).toBe(0);
    expect(renderedBody.issues).toEqual([
      {
        level: "warning",
        source: TILE_SOURCE,
        message:
          "Not loading https://192.168.1.1/: tiles from other sites cannot link addresses on your computer or network.",
      },
    ]);
  });

  it("drops an iframe that is neither http: nor https:", function dropsOtherIframe(): void {
    const renderedBody = renderBody(
      '<iframe src="javascript:alert(1)"></iframe>',
    );

    expect(renderedBody.html).toBe("");
    expect(renderedBody.issues).toEqual([]);
  });
});

describe("Code blocks stay as written", function describeCodeBlocks(): void {
  it("Mermaid block", function keepsMermaid(): void {
    const html = renderHtml("```mermaid\ngraph TD\n  A --> B\n```");

    expect(html).toBe(
      '<pre><code class="language-mermaid">graph TD\n  A --> B\n</code></pre>',
    );
  });

  it("keeps a math fence as code", function keepsMathFence(): void {
    const html = renderHtml("```math\na^2 *b* \\\\ c\n```");

    expect(html).toBe(
      '<pre><code class="language-math">a^2 *b* \\\\ c\n</code></pre>',
    );
  });

  it("keeps emoji shortcodes as text", function keepsEmojiShortcodes(): void {
    const html = renderHtml("Done :tada:");

    expect(html).toBe("<p>Done :tada:</p>");
  });
});

describe("Math is kept exactly", function describeMath(): void {
  it("Asterisks in a formula", function keepsInlineMath(): void {
    const html = renderHtml("Inline $x*y*z$.");

    expect(html).toBe(
      '<p>Inline <code class="language-math math-inline">x*y*z</code>.</p>',
    );
  });

  it("Backslashes in display math", function keepsDisplayMath(): void {
    const html = renderHtml("$$\n\\{x \\mid x > 0\\} \\\\ y\n$$");

    expect(html).toBe(
      '<pre><code class="language-math math-display">\\{x \\mid x > 0\\} \\\\ y</code></pre>',
    );
  });

  it("Prices are not math", function keepsPrices(): void {
    const html = renderHtml("It costs $5 and $10.");

    expect(html).toBe("<p>It costs $5 and $10.</p>");
  });

  it("Escaped dollars", function keepsEscapedDollars(): void {
    const html = renderHtml("It costs \\$5 and \\$10.");

    expect(html).toBe("<p>It costs $5 and $10.</p>");
  });

  it("keeps $ 5 $ as text", function keepsSpacedDollars(): void {
    const html = renderHtml("Pay $ 5 $ now.");

    expect(html).toBe("<p>Pay $ 5 $ now.</p>");
  });

  it("renders markdown inside dollars that are not math", function rendersMarkdownBetweenPrices(): void {
    const html = renderHtml("From $5 to *only* $10.");

    expect(html).toBe("<p>From $5 to <em>only</em> $10.</p>");
  });
});

describe("Alerts", function describeAlerts(): void {
  it("Note", function rendersNote(): void {
    const html = renderHtml("> [!NOTE]\n> Tiles are markdown files.");

    expect(html).toBe(
      '<aside class="ot-alert" data-ot-alert="note">\n<p class="ot-alert-title">Note</p>\n<p>Tiles are markdown files.</p>\n</aside>',
    );
  });

  it("Unknown kind", function keepsUnknownKind(): void {
    const html = renderHtml("> [!TODO]\n> Later.");

    expect(html).toContain("<blockquote>");
    expect(html).toContain("[!TODO]");
    expect(html).not.toContain("ot-alert");
  });

  it("renders the four other kinds, in any case", function rendersOtherKinds(): void {
    const kinds = [
      ["[!tip]", "tip", "Tip"],
      ["[!Important]", "important", "Important"],
      ["[!WARNING]", "warning", "Warning"],
      ["[!caution]", "caution", "Caution"],
    ];

    for (const [marker, kind, title] of kinds) {
      const html = renderHtml(`> ${marker}\n> Text.`);

      expect(html).toContain(
        `<aside class="ot-alert" data-ot-alert="${kind}">\n<p class="ot-alert-title">${title}</p>`,
      );
    }
  });

  it("drops the first paragraph when it held only the marker", function dropsMarkerParagraph(): void {
    const html = renderHtml("> [!TIP]\n>\n> Separate paragraph.");

    expect(html).toBe(
      '<aside class="ot-alert" data-ot-alert="tip">\n<p class="ot-alert-title">Tip</p>\n<p>Separate paragraph.</p>\n</aside>',
    );
  });

  it("keeps a quote whose marker line holds more text", function keepsMarkerWithText(): void {
    const html = renderHtml("> [!NOTE] Not alone.");

    expect(html).toContain("<blockquote>");
  });
});

describe("Heading anchors", function describeHeadingAnchors(): void {
  it("Heading ids", function addsHeadingIds(): void {
    const html = renderHtml("## Install it!\n\n## Install it!");

    expect(html).toBe(
      '<h2 id="user-content-install-it">Install it!</h2>\n<h2 id="user-content-install-it-1">Install it!</h2>',
    );
  });
});

describe("Pictures in bodies", function describePictures(): void {
  it("Dark-mode picture", function keepsPicture(): void {
    const renderedBody = renderBody(
      [
        "<picture>",
        '<source srcset="./dark.png, ./dark@2x.png 2x" media="(prefers-color-scheme: dark)">',
        '<img src="https://media.example.net/light.png" alt="Logo">',
        "</picture>",
      ].join(""),
    );

    expect(renderedBody.html).toBe(
      '<p><picture><source srcset="https://example.org/books/dark.png, https://example.org/books/dark@2x.png 2x" media="(prefers-color-scheme: dark)"><img src="https://media.example.net/light.png" alt="Logo" loading="lazy" decoding="async"></picture></p>',
    );
    expect(renderedBody.mediaUrls).toEqual([
      "https://example.org/books/dark.png",
      "https://example.org/books/dark@2x.png",
      "https://media.example.net/light.png",
    ]);
  });

  it("keeps a srcset address with a comma whole", function keepsCommaAddress(): void {
    const renderedBody = renderBody(
      '<picture><source srcset="https://media.example.net/a,b.png 1x,https://media.example.net/c.png, https://media.example.net/d.png 3x"><img src="https://media.example.net/e.png"></picture>',
    );

    expect(renderedBody.html).toContain(
      'srcset="https://media.example.net/a,b.png 1x, https://media.example.net/c.png, https://media.example.net/d.png 3x"',
    );
  });

  it("drops srcset candidates that are not http: or https:", function dropsUnsafeCandidates(): void {
    const html = renderHtml(
      '<picture><source srcset="data:image/png;base64,AAAA 1x, https://media.example.net/a.png 2x"><img src="https://media.example.net/b.png"></picture>',
    );

    expect(html).toContain('srcset="https://media.example.net/a.png 2x"');
    expect(html).not.toContain("data:");
  });
});

describe("Media of a rendered body", function describeMediaUrls(): void {
  it("collects images, sources and posters", function collectsMedia(): void {
    const renderedBody = renderBody(
      [
        "![Still](https://media.example.net/body.jpg)",
        '<video src="https://media.example.net/trailer.mp4" poster="https://media.example.net/still.jpg"><source src="./trailer.webm" type="video/webm"></video>',
        "See https://media.example.net/text.jpg and [a link](https://media.example.net/link.jpg).",
      ].join("\n\n"),
    );

    expect(renderedBody.mediaUrls).toEqual([
      "https://media.example.net/body.jpg",
      "https://media.example.net/trailer.mp4",
      "https://media.example.net/still.jpg",
      "https://example.org/books/trailer.webm",
    ]);
  });

  it("lists each address once", function dedupesMedia(): void {
    const renderedBody = renderBody("![A](./a.jpg) ![A again](./a.jpg)");

    expect(renderedBody.mediaUrls).toEqual(["https://example.org/books/a.jpg"]);
  });
});
