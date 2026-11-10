import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { SandboxSnapshot } from "../../lib/core/stage/index.ts";
import { ModInfoPopover } from "./ModInfoPopover.tsx";

const MOD_SOURCE = "https://example.org/mods/book_list/mod_conf.yaml";
const COLLECTION = "https://example.org/books/collection.yaml";
const RUN_HASH =
  "#/run?mod=./mods/book_list&collection=./books/collection.yaml";

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

describe("ModInfoPopover", function describeModInfoPopover(): void {
  it("Sample mod with its collection", function showsDetails(): void {
    render(<ModInfoPopover sandbox={buildSandbox({})} />);

    expect(screen.getByText(MOD_SOURCE)).toBeInTheDocument();
    expect(screen.getByText(COLLECTION)).toBeInTheDocument();
    expect(screen.getByText(RUN_HASH)).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByText("Copy link")).toBeNull();
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
});
