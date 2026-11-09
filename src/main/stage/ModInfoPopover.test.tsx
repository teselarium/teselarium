import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import type { SandboxSnapshot } from "../../lib/core/stage/index.ts";
import { ModInfoPopover } from "./ModInfoPopover.tsx";

const MOD_SOURCE = "https://example.org/mods/book_list/mod_conf.yaml";
const COLLECTION = "https://example.org/books/collection.yaml";
const RUN_HASH =
  "#/run?mod=./mods/book_list&collection=./books/collection.yaml";

let writeText: Mock<(text: string) => Promise<void>>;

beforeEach(function stubClipboard(): void {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  writeText = vi.fn<(text: string) => Promise<void>>();
  writeText.mockResolvedValue(undefined);
  vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
});

afterEach(function restore(): void {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function buildSandbox(changes: Partial<SandboxSnapshot>): SandboxSnapshot {
  const sandbox: SandboxSnapshot = {
    id: "sandbox-1",
    hash: RUN_HASH,
    isVisible: true,
    canClose: true,
    status: "running",
    mod: { title: "Book List", version: "1.0.0", source: MOD_SOURCE },
    sandboxDocument: null,
    canReloadTiles: true,
    messages: [],
    droppedModMessages: { error: 0, warning: 0, info: 0 },
    modReference: MOD_SOURCE,
    collection: COLLECTION,
    errorMessage: null,
    apiMismatch: null,
    siteConsent: null,
    ...changes,
  };
  return sandbox;
}

async function pressCopy(): Promise<void> {
  await act(async function clickCopy(): Promise<void> {
    fireEvent.click(screen.getByRole("button", { name: "Copy link" }));
    await Promise.resolve();
  });
}

describe("ModInfoPopover", function describeModInfoPopover(): void {
  it("Sample mod with its collection", function showsDetails(): void {
    render(<ModInfoPopover sandbox={buildSandbox({})} />);

    expect(screen.getByText(MOD_SOURCE)).toBeInTheDocument();
    expect(screen.getByText(COLLECTION)).toBeInTheDocument();
    expect(screen.getByText(RUN_HASH)).toBeInTheDocument();
  });

  it("shows no collection without one", function hidesCollection(): void {
    render(<ModInfoPopover sandbox={buildSandbox({ collection: null })} />);

    expect(screen.queryByText("Collection")).toBeNull();
  });

  it("Mod that did not load", function showsModReference(): void {
    const reference = "https://example.org/mods/missing/mod_conf.yaml";
    render(
      <ModInfoPopover
        sandbox={buildSandbox({
          status: "failed",
          mod: null,
          modReference: reference,
          collection: null,
          hash: "#/run?mod=./mods/missing",
        })}
      />,
    );

    expect(screen.getByText(reference)).toBeInTheDocument();
    expect(screen.getByText("#/run?mod=./mods/missing")).toBeInTheDocument();
  });

  it("Copy the link", async function copiesLink(): Promise<void> {
    render(<ModInfoPopover sandbox={buildSandbox({})} />);

    await pressCopy();

    const { origin, pathname, search } = window.location;
    expect(writeText).toHaveBeenCalledExactlyOnceWith(
      `${origin}${pathname}${search}${RUN_HASH}`,
    );
    expect(screen.getByRole("button", { name: "Copied" })).toBeInTheDocument();
  });

  it("says Copied for 2 seconds", async function resetsLabel(): Promise<void> {
    render(<ModInfoPopover sandbox={buildSandbox({})} />);
    await pressCopy();

    await act(async function waitAlmost(): Promise<void> {
      await vi.advanceTimersByTimeAsync(1999);
    });
    expect(screen.getByRole("button", { name: "Copied" })).toBeInTheDocument();
    await act(async function waitRest(): Promise<void> {
      await vi.advanceTimersByTimeAsync(1);
    });

    expect(
      screen.getByRole("button", { name: "Copy link" }),
    ).toBeInTheDocument();
  });

  it("says Cannot copy when the clipboard refuses", async function showsFailure(): Promise<void> {
    writeText.mockRejectedValue(new Error("Not allowed"));
    render(<ModInfoPopover sandbox={buildSandbox({})} />);

    await pressCopy();

    expect(
      screen.getByRole("button", { name: "Cannot copy" }),
    ).toBeInTheDocument();
  });
});
