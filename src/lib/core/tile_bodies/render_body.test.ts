import { describe, expect, it } from "vitest";
import type { Tile } from "../../tile/index.ts";
import { renderTileBody, scanTileBody } from "./render_body.ts";
import type { TileBodyScan } from "./render_body.ts";

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

function scanBody(body: string): TileBodyScan {
  const bodyScan = scanTileBody(buildBodyTile(body));
  return bodyScan;
}

function renderHtml(body: string): Promise<string> {
  return renderTileBody(buildBodyTile(body));
}

describe("Render a tile's body", function describeRenderBody(): void {
  it("renders paragraphs and emphasis", async function rendersMarkdown(): Promise<void> {
    const html = await renderHtml("A *calm* state.\n\nSecond paragraph.");

    expect(html).toBe(
      "<p>A <em>calm</em> state.</p>\n<p>Second paragraph.</p>",
    );
  });

  it("renders an empty body as an empty string", async function rendersEmptyBody(): Promise<void> {
    const html = await renderHtml("");

    expect(html).toBe("");
    expect(scanBody("")).toEqual({
      mediaUrls: [],
      playerAddresses: new Map(),
      issues: [],
    });
  });
});

describe("Rendered bodies hold only safe HTML", function describeSafeHtml(): void {
  it("Script in a body", async function dropsScripts(): Promise<void> {
    const html = await renderHtml(
      '<script>alert(1)</script>\n\n<img src="x.jpg" onerror="alert(1)">',
    );

    expect(html).not.toContain("<script");
    expect(html).not.toContain("onerror");
    expect(html).toContain('<img src="https://example.org/books/x.jpg"');
  });

  it("Script address in a link", async function dropsScriptAddress(): Promise<void> {
    const html = await renderHtml("[Click](javascript:alert(1))");

    expect(html).not.toContain("javascript:");
    expect(html).toContain("Click");
  });

  it("Link command in a formula", async function dropsFormulaLink(): Promise<void> {
    const html = await renderHtml("$\\href{javascript:alert(1)}{x}$");

    expect(html).not.toContain("<a");
    expect(html).not.toContain("href=");
    expect(html).toContain('<code class="language-math math-inline"');
  });

  it("MathML written in a body", async function dropsMathMlHref(): Promise<void> {
    const html = await renderHtml(
      '<math><mi href="https://example.org" style="color: red" onclick="alert(1)">x</mi></math>',
    );

    expect(html).toBe("<p><math><mi>x</mi></math></p>");
  });

  it("drops styles, forms, frames and data: addresses", async function dropsOtherUnsafeHtml(): Promise<void> {
    const html = await renderHtml(
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
  it("Relative image", async function resolvesImage(): Promise<void> {
    const html = await renderHtml("![Cover](./cover.jpg)");

    expect(html).toContain('src="https://example.org/books/cover.jpg"');
  });

  it("Relative link", async function resolvesLink(): Promise<void> {
    const html = await renderHtml("[Next](../films/stalker.md)");

    expect(html).toBe(
      '<p><a href="https://example.org/films/stalker.md" data-tes-link="">Next</a></p>',
    );
  });

  it("keeps a fragment link as written and marks it", async function marksFragmentLink(): Promise<void> {
    const html = await renderHtml("[See notes](#notes)");

    expect(html).toBe(
      '<p><a href="#notes" data-tes-fragment="">See notes</a></p>',
    );
  });

  it("leaves the tile's body as written", async function keepsTileBody(): Promise<void> {
    const tile = buildBodyTile("![Cover](./cover.jpg) $x$ :tada:");

    await renderTileBody(tile);
    scanTileBody(tile);

    expect(tile.body).toBe("![Cover](./cover.jpg) $x$ :tada:");
  });
});

describe("Images in bodies load lazily", function describeImages(): void {
  it("Image attributes", async function addsLazyLoading(): Promise<void> {
    const html = await renderHtml(
      '<img src="https://media.example.net/a.jpg" width="320" height="200" alt="A">',
    );

    expect(html).toBe(
      '<img src="https://media.example.net/a.jpg" width="320" height="200" alt="A" loading="lazy" decoding="async">',
    );
  });
});

describe("Video and audio in bodies", function describeVideoAndAudio(): void {
  it("Video with autoplay", async function forcesControls(): Promise<void> {
    const html = await renderHtml(
      '<video src="./trailer.mp4" autoplay></video>',
    );

    expect(html).toBe(
      '<p><video src="https://example.org/books/trailer.mp4" controls preload="metadata"></video></p>',
    );
  });

  it("keeps audio with its sources", async function keepsAudioSources(): Promise<void> {
    const html = await renderHtml(
      '<audio autoplay><source src="./theme.ogg" type="audio/ogg"></audio>',
    );

    expect(html).toBe(
      '<p><audio controls preload="metadata"><source src="https://example.org/books/theme.ogg" type="audio/ogg"></audio></p>',
    );
  });
});

describe("Players in bodies become placeholders", function describePlaceholders(): void {
  it("Pasted YouTube iframe", async function replacesYouTubeIframe(): Promise<void> {
    const body =
      '<iframe src="https://www.youtube.com/embed/aqz-KE-bpKQ" title="Big Buck Bunny"></iframe>';
    const html = await renderHtml(body);
    const bodyScan = scanBody(body);

    expect(html).toBe(
      '<button type="button" class="tes-player" data-tes-player="https://www.youtube.com/embed/aqz-KE-bpKQ"><span class="tes-player-box"><span class="tes-player-title">Big Buck Bunny</span><span class="tes-player-host">youtube.com</span></span></button>',
    );
    expect([...bodyScan.playerAddresses.keys()]).toEqual([
      "https://www.youtube.com/embed/aqz-KE-bpKQ",
    ]);
    expect(
      bodyScan.playerAddresses.get("https://www.youtube.com/embed/aqz-KE-bpKQ")
        ?.title,
    ).toBe("Big Buck Bunny");
  });

  it("Image syntax with a page link", async function replacesPageLinkImage(): Promise<void> {
    const body = "![Trailer](https://www.youtube.com/watch?v=aqz-KE-bpKQ)";
    const html = await renderHtml(body);
    const bodyScan = scanBody(body);

    expect(html).toContain(
      '<button type="button" class="tes-player" data-tes-player="https://www.youtube.com/watch?v=aqz-KE-bpKQ"><span class="tes-player-box"><span class="tes-player-title">Trailer</span>',
    );
    expect(html).not.toContain("<img");
    expect(bodyScan.mediaUrls).toEqual([]);
    expect(
      bodyScan.playerAddresses.get(
        "https://www.youtube.com/watch?v=aqz-KE-bpKQ",
      )?.title,
    ).toBe("Trailer");
  });

  it("records a generic iframe with its own shape and drops its attributes", async function recordsGenericIframe(): Promise<void> {
    const body =
      '<iframe src="https://maps.example.net/embed?id=7" width="400" height="300" allow="camera; microphone"></iframe>';
    const html = await renderHtml(body);
    const bodyScan = scanBody(body);

    expect(html).not.toContain("allow");
    expect(html).toContain(
      '<span class="tes-player-host">maps.example.net</span>',
    );
    expect(
      bodyScan.playerAddresses.get("https://maps.example.net/embed?id=7"),
    ).toEqual({
      player: {
        frameUrl: "https://maps.example.net/embed?id=7",
        host: "maps.example.net",
        siteName: null,
        shape: { ratio: 4 / 3 },
      },
      title: null,
    });
    expect(html).toContain('<span class="tes-player-title">Player</span>');
  });

  it("does not record the address of a forged placeholder", async function ignoresForgedPlaceholder(): Promise<void> {
    const body =
      '<button type="button" class="tes-player" data-tes-player="https://evil.example.net/embed">Play</button>';
    const html = await renderHtml(body);
    const bodyScan = scanBody(body);

    expect(html).toContain('data-tes-player="https://evil.example.net/embed"');
    expect(bodyScan.playerAddresses.size).toBe(0);
  });
});

describe("Iframes that are not players", function describeOtherIframes(): void {
  it("Plain http page", async function linksHttpIframe(): Promise<void> {
    const body =
      '<iframe src="http://example.org/widget" title="Widget"></iframe>';
    const html = await renderHtml(body);
    const bodyScan = scanBody(body);

    expect(html).toBe(
      '<a href="http://example.org/widget" data-tes-link="">Widget</a>',
    );
    expect(bodyScan.playerAddresses.size).toBe(0);
  });

  it("Router address", async function dropsPrivateIframe(): Promise<void> {
    const body = '<iframe src="https://192.168.1.1/"></iframe>';
    const html = await renderHtml(body);
    const bodyScan = scanBody(body);

    expect(html).toBe("");
    expect(bodyScan.playerAddresses.size).toBe(0);
    expect(bodyScan.issues).toEqual([
      {
        level: "warning",
        source: TILE_SOURCE,
        message:
          "Not loading https://192.168.1.1/: tiles from other sites cannot link addresses on your computer or network.",
      },
    ]);
  });

  it("drops an iframe that is neither http: nor https:", async function dropsOtherIframe(): Promise<void> {
    const body = '<iframe src="javascript:alert(1)"></iframe>';
    const html = await renderHtml(body);
    const bodyScan = scanBody(body);

    expect(html).toBe("");
    expect(bodyScan.issues).toEqual([]);
  });
});

describe("Code blocks and emoji", function describeCodeBlocks(): void {
  it("Mermaid block", async function keepsMermaid(): Promise<void> {
    const html = await renderHtml("```mermaid\ngraph TD\n  A --> B\n```");

    expect(html).toBe(
      '<pre><code class="language-mermaid">graph TD\n  A --> B\n</code></pre>',
    );
  });

  it("keeps a mermaid block as it is beside highlighted code", async function keepsMermaidBesideCode(): Promise<void> {
    const html = await renderHtml(
      "```mermaid\ngraph TD\n  A --> B\n```\n\n```js\nlet a;\n```",
    );

    expect(html).toContain(
      '<pre><code class="language-mermaid">graph TD\n  A --> B\n</code></pre>',
    );
    expect(html).toContain('<code class="hljs language-js">');
  });

  it("Labeled JavaScript", async function highlightsJavaScript(): Promise<void> {
    const html = await renderHtml("```js\nconst answer = 42;\n```");

    expect(html).toBe(
      '<pre><code class="hljs language-js"><span class="hljs-keyword">const</span> answer = <span class="hljs-number">42</span>;\n</code></pre>',
    );
  });

  it("Unlabeled block", async function keepsUnlabeledBlock(): Promise<void> {
    const html = await renderHtml("```\nconst answer = 42;\n```");

    expect(html).toBe("<pre><code>const answer = 42;\n</code></pre>");
  });

  it("keeps a block in a language it does not have plain", async function keepsDockerfilePlain(): Promise<void> {
    const html = await renderHtml("```dockerfile\nFROM node:24\n```");

    expect(html).not.toContain("<span");
    expect(html).toContain('language-dockerfile">FROM node:24\n</code>');
  });

  it("Shortcodes", async function replacesShortcodes(): Promise<void> {
    const html = await renderHtml("Done :tada:, :not_an_emoji: and `:tada:`.");

    expect(html).toBe(
      "<p>Done 🎉, :not_an_emoji: and <code>:tada:</code>.</p>",
    );
  });

  it("replaces a shortcode between two prices", async function replacesShortcodeBetweenPrices(): Promise<void> {
    const html = await renderHtml("$5 :tada: $10");

    expect(html).toBe("<p>$5 🎉 $10</p>");
  });

  it("keeps shortcodes in code blocks", async function keepsShortcodesInBlocks(): Promise<void> {
    const html = await renderHtml("Done :tada:\n\n```\n:tada:\n```");

    expect(html).toBe("<p>Done 🎉</p>\n<pre><code>:tada:\n</code></pre>");
  });
});

describe("Math is rendered as MathML", function describeMath(): void {
  it("Asterisks in a formula", async function rendersInlineMath(): Promise<void> {
    const html = await renderHtml("Inline $x*y*z$.");

    expect(html).toMatch(/^<p>Inline <math><semantics>.*<\/math>\.<\/p>$/);
    expect(html).toContain(
      '<annotation encoding="application/x-tex">x*y*z</annotation>',
    );
    expect(html).not.toContain("<em>");
  });

  it("Backslashes in display math", async function rendersDisplayMath(): Promise<void> {
    const html = await renderHtml("$$\n\\{x \\mid x > 0\\} \\\\ y\n$$");

    expect(html).toMatch(/^<math display="block" class="tml-display">/);
    expect(html).toContain(
      '<annotation encoding="application/x-tex">\\{x \\mid x > 0\\} \\\\ y</annotation>',
    );
  });

  it("Prices are not math", async function keepsPrices(): Promise<void> {
    const html = await renderHtml("It costs $5 and $10.");

    expect(html).toBe("<p>It costs $5 and $10.</p>");
  });

  it("Escaped dollars", async function keepsEscapedDollars(): Promise<void> {
    const html = await renderHtml("It costs \\$5 and \\$10.");

    expect(html).toBe("<p>It costs $5 and $10.</p>");
  });

  it("keeps $ 5 $ as text", async function keepsSpacedDollars(): Promise<void> {
    const html = await renderHtml("Pay $ 5 $ now.");

    expect(html).toBe("<p>Pay $ 5 $ now.</p>");
  });

  it("renders markdown inside dollars that are not math", async function rendersMarkdownBetweenPrices(): Promise<void> {
    const html = await renderHtml("From $5 to *only* $10.");

    expect(html).toBe("<p>From $5 to <em>only</em> $10.</p>");
  });

  it("Fraction", async function rendersFraction(): Promise<void> {
    const html = await renderHtml("$\\frac{a}{b}$");

    expect(html).toBe(
      '<p><math><semantics><mfrac><mi>a</mi><mi>b</mi></mfrac><annotation encoding="application/x-tex">\\frac{a}{b}</annotation></semantics></math></p>',
    );
  });

  it("Math block", async function rendersMathBlock(): Promise<void> {
    const html = await renderHtml("```math\nE = mc^2\n```");

    expect(html).toMatch(/^<math display="block" class="tml-display">/);
    expect(html).toContain(
      '<annotation encoding="application/x-tex">E = mc^2</annotation>',
    );
    expect(html).not.toContain("<pre");
  });

  it("drops Temml's styles", async function dropsMathStyles(): Promise<void> {
    const html = await renderHtml(
      "$$\n\\color{red}{x} \\begin{pmatrix}a&b\\\\c&d\\end{pmatrix}\n$$",
    );

    expect(html).toContain("<mtable>");
    expect(html).not.toContain("style");
    expect(html).not.toContain("mathbackground");
  });
});

describe("Formulas that fail stay as written", function describeFailingMath(): void {
  it("Unclosed brace", async function keepsUnclosedBrace(): Promise<void> {
    const html = await renderHtml("Before $\\frac{a}{$ after.");

    expect(html).toBe(
      '<p>Before <code class="language-math math-inline" data-tes-math-error="Unexpected end of input in a macro argument, expected &#x27;}&#x27; at end of input: \\frac{a}{">\\frac{a}{</code> after.</p>',
    );
  });

  it("Failing math block", async function keepsFailingMathBlock(): Promise<void> {
    const html = await renderHtml("```math\n\\frac{a}{\n```");

    expect(html).toMatch(
      /^<pre><code class="language-math" data-tes-math-error="[^"]+">\\frac\{a\}\{\n<\/code><\/pre>$/,
    );
  });

  it("keeps failing display math as code", async function keepsFailingDisplayMath(): Promise<void> {
    const html = await renderHtml("$$\n\\frac{a}{\n$$");

    expect(html).toMatch(
      /^<pre><code class="language-math math-display" data-tes-math-error="[^"]+">\\frac\{a\}\{<\/code><\/pre>$/,
    );
  });

  it("keeps a formula over the expansion limit as code", async function keepsRecursiveMacro(): Promise<void> {
    const html = await renderHtml("$\\def\\loop{\\loop}\\loop$");

    expect(html).toBe(
      '<p><code class="language-math math-inline" data-tes-math-error="Too many expansions: infinite loop or need to increase maxExpand setting">\\def\\loop{\\loop}\\loop</code></p>',
    );
  });

  it("renders the rest of the body", async function rendersRestOfBody(): Promise<void> {
    const html = await renderHtml("$\\frac{a}{$ and $\\frac{c}{d}$ and *e*");

    expect(html).toContain("data-tes-math-error");
    expect(html).toContain("<mfrac><mi>c</mi><mi>d</mi></mfrac>");
    expect(html).toContain("<em>e</em>");
  });
});

describe("Alerts", function describeAlerts(): void {
  it("Note", async function rendersNote(): Promise<void> {
    const html = await renderHtml("> [!NOTE]\n> Tiles are markdown files.");

    expect(html).toBe(
      '<aside class="tes-alert" data-tes-alert="note">\n<p class="tes-alert-title">Note</p>\n<p>Tiles are markdown files.</p>\n</aside>',
    );
  });

  it("Unknown kind", async function keepsUnknownKind(): Promise<void> {
    const html = await renderHtml("> [!TODO]\n> Later.");

    expect(html).toContain("<blockquote>");
    expect(html).toContain("[!TODO]");
    expect(html).not.toContain("tes-alert");
  });

  it("renders the four other kinds, in any case", async function rendersOtherKinds(): Promise<void> {
    const kinds = [
      ["[!tip]", "tip", "Tip"],
      ["[!Important]", "important", "Important"],
      ["[!WARNING]", "warning", "Warning"],
      ["[!caution]", "caution", "Caution"],
    ];

    for (const [marker, kind, title] of kinds) {
      const html = await renderHtml(`> ${marker}\n> Text.`);

      expect(html).toContain(
        `<aside class="tes-alert" data-tes-alert="${kind}">\n<p class="tes-alert-title">${title}</p>`,
      );
    }
  });

  it("drops the first paragraph when it held only the marker", async function dropsMarkerParagraph(): Promise<void> {
    const html = await renderHtml("> [!TIP]\n>\n> Separate paragraph.");

    expect(html).toBe(
      '<aside class="tes-alert" data-tes-alert="tip">\n<p class="tes-alert-title">Tip</p>\n<p>Separate paragraph.</p>\n</aside>',
    );
  });

  it("keeps a quote whose marker line holds more text", async function keepsMarkerWithText(): Promise<void> {
    const html = await renderHtml("> [!NOTE] Not alone.");

    expect(html).toContain("<blockquote>");
  });
});

describe("Heading anchors", function describeHeadingAnchors(): void {
  it("Heading ids", async function addsHeadingIds(): Promise<void> {
    const html = await renderHtml("## Install it!\n\n## Install it!");

    expect(html).toBe(
      '<h2 id="user-content-install-it">Install it!</h2>\n<h2 id="user-content-install-it-1">Install it!</h2>',
    );
  });
});

describe("Pictures in bodies", function describePictures(): void {
  it("Dark-mode picture", async function keepsPicture(): Promise<void> {
    const body = [
      "<picture>",
      '<source srcset="./dark.png, ./dark@2x.png 2x" media="(prefers-color-scheme: dark)">',
      '<img src="https://media.example.net/light.png" alt="Logo">',
      "</picture>",
    ].join("");
    const html = await renderHtml(body);
    const bodyScan = scanBody(body);

    expect(html).toBe(
      '<p><picture><source srcset="https://example.org/books/dark.png, https://example.org/books/dark@2x.png 2x" media="(prefers-color-scheme: dark)"><img src="https://media.example.net/light.png" alt="Logo" loading="lazy" decoding="async"></picture></p>',
    );
    expect(bodyScan.mediaUrls).toEqual([
      "https://example.org/books/dark.png",
      "https://example.org/books/dark@2x.png",
      "https://media.example.net/light.png",
    ]);
  });

  it("keeps a srcset address with a comma whole", async function keepsCommaAddress(): Promise<void> {
    const body =
      '<picture><source srcset="https://media.example.net/a,b.png 1x,https://media.example.net/c.png, https://media.example.net/d.png 3x"><img src="https://media.example.net/e.png"></picture>';
    const html = await renderHtml(body);

    expect(html).toContain(
      'srcset="https://media.example.net/a,b.png 1x, https://media.example.net/c.png, https://media.example.net/d.png 3x"',
    );
  });

  it("drops srcset candidates that are not http: or https:", async function dropsUnsafeCandidates(): Promise<void> {
    const html = await renderHtml(
      '<picture><source srcset="data:image/png;base64,AAAA 1x, https://media.example.net/a.png 2x"><img src="https://media.example.net/b.png"></picture>',
    );

    expect(html).toContain('srcset="https://media.example.net/a.png 2x"');
    expect(html).not.toContain("data:");
  });
});

describe("Media of a rendered body", function describeMediaUrls(): void {
  it("collects images, sources and posters", function collectsMedia(): void {
    const body = [
      "![Still](https://media.example.net/body.jpg)",
      '<video src="https://media.example.net/trailer.mp4" poster="https://media.example.net/still.jpg"><source src="./trailer.webm" type="video/webm"></video>',
      "See https://media.example.net/text.jpg and [a link](https://media.example.net/link.jpg).",
    ].join("\n\n");
    const bodyScan = scanBody(body);

    expect(bodyScan.mediaUrls).toEqual([
      "https://media.example.net/body.jpg",
      "https://media.example.net/trailer.mp4",
      "https://media.example.net/still.jpg",
      "https://example.org/books/trailer.webm",
    ]);
  });

  it("lists each address once", function dedupesMedia(): void {
    const bodyScan = scanBody("![A](./a.jpg) ![A again](./a.jpg)");

    expect(bodyScan.mediaUrls).toEqual(["https://example.org/books/a.jpg"]);
  });

  it("finds the media and players of a body with extras", function scansBodyWithExtras(): void {
    const bodyScan = scanBody(
      [
        "![Cover](./cover.jpg) $\\frac{a}{b}$ :tada:",
        "```js\nconst answer = 42;\n```",
        '<iframe src="https://www.youtube.com/embed/aqz-KE-bpKQ"></iframe>',
      ].join("\n\n"),
    );

    expect(bodyScan.mediaUrls).toEqual(["https://example.org/books/cover.jpg"]);
    expect([...bodyScan.playerAddresses.keys()]).toEqual([
      "https://www.youtube.com/embed/aqz-KE-bpKQ",
    ]);
    expect(bodyScan.issues).toEqual([]);
  });
});
