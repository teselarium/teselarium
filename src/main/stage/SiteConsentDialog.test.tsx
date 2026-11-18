import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import type {
  SandboxSnapshot,
  SiteConsentAnswer,
  SiteConsentLine,
} from "../../lib/core/stage/index.ts";
import {
  PROBE_CONNECT_PERMISSION,
  PROBE_MOD_SOURCE,
  SAMPLE_COVERS_PERMISSION,
} from "../../test/sample_mods.ts";
import { SiteConsentDialog } from "./SiteConsentDialog.tsx";

const COVERS_LINE: SiteConsentLine = {
  key: "show https://upload.wikimedia.org",
  subject: "mod",
  ...SAMPLE_COVERS_PERMISSION,
};
const OPEN_LINE: SiteConsentLine = {
  key: "open *",
  subject: "mod",
  category: "open",
  host: "*",
  reason: "Opens the mods you pick",
};
const CONNECT_LINE: SiteConsentLine = {
  key: "connect https://api.example.net",
  subject: "mod",
  ...PROBE_CONNECT_PERMISSION,
};

const COST_TEXT = "Each site you allow can see that you used this mod.";
const DATA_TEXT =
  "Sites allowed to exchange data or load code can also receive what the mod shows or keeps.";

let onAnswer: Mock<
  (sandboxId: string, answer: SiteConsentAnswer | null) => void
>;

beforeEach(function createAnswerSpy(): void {
  onAnswer =
    vi.fn<(sandboxId: string, answer: SiteConsentAnswer | null) => void>();
});

function buildAskingSandbox(lines: SiteConsentLine[]): SandboxSnapshot {
  const sandbox: SandboxSnapshot = {
    id: "sandbox-2",
    hash: "#/run",
    isVisible: true,
    canClose: true,
    status: "asking",
    mod: { title: "Probe", version: "1.0.0", source: PROBE_MOD_SOURCE },
    mosaic: null,
    mosaicReference: null,
    sandboxDocument: null,
    canReloadTiles: false,
    messages: [],
    droppedModMessages: { error: 0, warning: 0, info: 0 },
    modReference: PROBE_MOD_SOURCE,
    collection: null,
    errorMessage: null,
    apiMismatch: null,
    siteConsent: { lines, mosaic: null },
  };
  return sandbox;
}

function renderDialog(lines: SiteConsentLine[]): HTMLDialogElement {
  render(
    <SiteConsentDialog
      sandbox={buildAskingSandbox(lines)}
      onAnswer={onAnswer}
    />,
  );
  const dialog = document.querySelector("dialog");
  if (dialog === null) {
    throw new Error("Expected a dialog element");
  }
  return dialog;
}

function readCheckbox(name: string): HTMLElement {
  return screen.getByRole("checkbox", { name });
}

describe("SiteConsentDialog", function describeSiteConsentDialog(): void {
  it("names the mod by its title and source", function namesMod(): void {
    const dialog = renderDialog([COVERS_LINE]);

    expect(dialog.open).toBe(true);
    expect(screen.getByRole("heading", { name: "Probe" })).toBeInTheDocument();
    expect(dialog).toHaveTextContent(PROBE_MOD_SOURCE);
  });

  it("names the sites mosaic of a mod sandbox in its group", function namesSitesMosaic(): void {
    const sitesSource = "https://mosaics.example.net/covers/mosaic.yaml";
    const sandbox: SandboxSnapshot = {
      ...buildAskingSandbox([]),
      siteConsent: {
        lines: [{ ...COVERS_LINE, key: "mosaic show", subject: "mosaic" }],
        mosaic: { title: "Covers", source: sitesSource },
      },
    };

    render(<SiteConsentDialog sandbox={sandbox} onAnswer={onAnswer} />);

    expect(screen.getByRole("heading", { name: "Covers" })).toBeInTheDocument();
    expect(document.querySelector("dialog")).toHaveTextContent(sitesSource);
  });

  it("Lines of a foreign mod", function listsLines(): void {
    const dialog = renderDialog([COVERS_LINE, OPEN_LINE]);

    const coversCheckbox = readCheckbox(
      "show content from https://upload.wikimedia.org",
    );
    const openCheckbox = readCheckbox("open mods from any site");
    expect(coversCheckbox).toHaveAttribute("aria-checked", "true");
    expect(openCheckbox).toHaveAttribute("aria-checked", "true");
    expect(dialog).toHaveTextContent("Shows the book covers");
    expect(dialog).toHaveTextContent("Opens the mods you pick");
  });

  it("Markup in a reason", function showsMarkupAsText(): void {
    const dialog = renderDialog([{ ...COVERS_LINE, reason: "<b>Needed</b>" }]);

    expect(dialog).toHaveTextContent("<b>Needed</b>");
    expect(dialog.querySelector("b")).toBeNull();
  });

  it("Show only", function statesShowCost(): void {
    const dialog = renderDialog([COVERS_LINE, OPEN_LINE]);

    expect(dialog).toHaveTextContent(COST_TEXT);
    expect(dialog).not.toHaveTextContent(DATA_TEXT);
  });

  it("A connect line", function statesDataCost(): void {
    const dialog = renderDialog([COVERS_LINE, CONNECT_LINE]);

    expect(dialog).toHaveTextContent(COST_TEXT);
    expect(dialog).toHaveTextContent(DATA_TEXT);
  });

  it("focuses Show without them", function focusesShowWithout(): void {
    renderDialog([COVERS_LINE]);

    expect(
      screen.getByRole("button", { name: "Show without them" }),
    ).toHaveFocus();
  });

  it("leaves Remember unchecked", function leavesRememberUnchecked(): void {
    renderDialog([COVERS_LINE]);

    expect(readCheckbox("Remember my answer for this mod")).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });

  it("Allow answers the checked lines", function allowsCheckedLines(): void {
    renderDialog([COVERS_LINE, CONNECT_LINE]);

    fireEvent.click(readCheckbox("exchange data with https://api.example.net"));
    fireEvent.click(screen.getByRole("button", { name: "Allow" }));

    expect(onAnswer).toHaveBeenCalledExactlyOnceWith("sandbox-2", {
      allowed: [COVERS_LINE.key],
      remember: false,
    });
  });

  it("Show without them refuses every line, with Remember", function refusesLines(): void {
    renderDialog([COVERS_LINE, CONNECT_LINE]);

    fireEvent.click(readCheckbox("Remember my answer for this mod"));
    fireEvent.click(screen.getByRole("button", { name: "Show without them" }));

    expect(onAnswer).toHaveBeenCalledExactlyOnceWith("sandbox-2", {
      allowed: [],
      remember: true,
    });
  });

  it("Escape answers null", function answersNullOnEscape(): void {
    const dialog = renderDialog([COVERS_LINE]);

    fireEvent.click(readCheckbox("Remember my answer for this mod"));
    fireEvent(dialog, new Event("cancel", { cancelable: true }));

    expect(onAnswer).toHaveBeenCalledExactlyOnceWith("sandbox-2", null);
  });

  it("stays closed without a site consent question", function staysClosed(): void {
    render(
      <SiteConsentDialog
        sandbox={{ ...buildAskingSandbox([]), siteConsent: null }}
        onAnswer={onAnswer}
      />,
    );

    expect(document.querySelector("dialog")?.open).toBe(false);
  });
});
