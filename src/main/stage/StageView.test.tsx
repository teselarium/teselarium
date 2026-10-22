import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { attachFrame, openStageLink } from "../../lib/core/stage/index.ts";
import type { Stage } from "../../lib/core/stage/index.ts";
import {
  collectMessages,
  createFakeFrame,
  readModPort,
  waitForMessages,
} from "../../test/fake_frames.ts";
import { SAMPLE_MOD_SOURCE } from "../../test/sample_mods.ts";
import { settleStage, startTestStage } from "../../test/test_stages.ts";
import { StageView } from "./StageView.tsx";

const openPorts: MessagePort[] = [];

afterEach(function closePorts(): void {
  for (const port of openPorts) {
    port.close();
  }
  openPorts.length = 0;
});

const SAMPLE_LINK = {
  mod: "./samples/mods/book_list",
  collection: "./samples/tiles/books_collection.yaml",
  params: {},
};

function listWrappers(container: HTMLElement): HTMLElement[] {
  const wrappers: HTMLElement[] = [];
  for (const wrapper of container.querySelectorAll<HTMLElement>(
    "[data-sandbox-id]",
  )) {
    wrappers.push(wrapper);
  }
  return wrappers;
}

async function openFromVisible(stage: Stage, openerId: string): Promise<void> {
  await act(async function openLink(): Promise<void> {
    openStageLink(stage, SAMPLE_LINK, openerId);
    await settleStage(stage);
  });
}

describe("StageView", function describeStageView(): void {
  it("renders one wrapper per sandbox, only the visible one shown", async function rendersWrappers(): Promise<void> {
    const stage = await startTestStage("");
    const { container } = render(<StageView stage={stage} />);

    await openFromVisible(stage, "sandbox-1");

    const wrappers = listWrappers(container);
    const ids: string[] = [];
    const hidden: boolean[] = [];
    for (const wrapper of wrappers) {
      ids.push(wrapper.dataset.sandboxId ?? "");
      hidden.push(wrapper.hasAttribute("hidden"));
    }
    expect(ids).toEqual(["sandbox-1", "sandbox-2"]);
    expect(hidden).toEqual([true, false]);
  });

  it("renders the running mod's frame with its sandbox and document", async function rendersFrame(): Promise<void> {
    const stage = await startTestStage("");
    render(<StageView stage={stage} />);

    const frame = screen.getByTitle("Book List");

    expect(frame.tagName).toBe("IFRAME");
    expect(frame.getAttribute("sandbox")).toBe("allow-scripts");
    expect(frame.getAttribute("allow")).toBe("fullscreen *");
    expect(frame.hasAttribute("src")).toBe(false);
    expect(frame.getAttribute("srcdoc")).toContain("Content-Security-Policy");
  });

  it("Home mod has no close button", async function hidesHomeClose(): Promise<void> {
    const stage = await startTestStage("");
    render(<StageView stage={stage} />);

    expect(screen.getByText("Book List")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Close" })).toBeNull();
  });

  it("shows the close button for a mod opened from a link", async function showsClose(): Promise<void> {
    const stage = await startTestStage("#/run?mod=./samples/mods/book_list");
    render(<StageView stage={stage} />);

    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
  });

  it("No collection, no reload", async function hidesReload(): Promise<void> {
    const stage = await startTestStage("#/run?mod=./samples/mods/book_list");
    render(<StageView stage={stage} />);

    expect(screen.queryByRole("button", { name: "Reload tiles" })).toBeNull();
  });

  it("shows Reload tiles for a mod opened with a collection", async function showsReload(): Promise<void> {
    const stage = await startTestStage(
      "#/run?mod=./samples/mods/book_list&collection=./samples/tiles/books_collection.yaml",
    );
    render(<StageView stage={stage} />);

    expect(
      screen.getByRole("button", { name: "Reload tiles" }),
    ).toBeInTheDocument();
  });

  it("shows the title and the version of the visible mod", async function showsTitle(): Promise<void> {
    const stage = await startTestStage("");
    render(<StageView stage={stage} />);

    const stageBar = screen.getByRole("region", { name: "Stage bar" });

    expect(within(stageBar).getByText("Book List")).toBeInTheDocument();
    expect(within(stageBar).getByText("1.0.0")).toBeInTheDocument();
  });

  it("Missing mod file", async function showsLoadFailure(): Promise<void> {
    const stage = await startTestStage("#/run?mod=./samples/mods/missing");
    const { container } = render(<StageView stage={stage} />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "https://example.org/samples/mods/missing/mod_conf.yaml",
    );
    expect(screen.getByRole("alert")).toHaveTextContent("404");
    expect(container.querySelector("iframe")).toBeNull();
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
  });

  it("Sample mod has no issues", async function showsNoIssues(): Promise<void> {
    const stage = await startTestStage("");
    render(<StageView stage={stage} />);

    expect(screen.getByText("No issues.")).toBeInTheDocument();
  });

  it("shows the visible mod's ui.confirm and sends the answer", async function answersConfirm(): Promise<void> {
    const stage = await startTestStage("");
    const fakeFrame = createFakeFrame();
    attachFrame(stage, "sandbox-1", fakeFrame.target);
    const modPort = readModPort(fakeFrame);
    openPorts.push(modPort);
    const received = collectMessages(modPort);
    render(<StageView stage={stage} />);

    await act(async function askUser(): Promise<void> {
      modPort.postMessage({
        jsonrpc: "2.0",
        id: 1,
        method: "ui.confirm",
        params: { message: "Delete this list?", confirmLabel: "Delete" },
      });
      await waitForMessages();
    });
    const dialog = screen.getByRole("dialog", { name: "Book List" });
    expect(dialog).toHaveTextContent("Delete this list?");
    expect(dialog).toHaveTextContent(SAMPLE_MOD_SOURCE);
    await act(async function confirm(): Promise<void> {
      fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }));
      await waitForMessages();
    });

    expect(received).toEqual([{ jsonrpc: "2.0", id: 1, result: true }]);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("lists the issues in order with level, source and message", async function listsIssues(): Promise<void> {
    const stage = await startTestStage("");
    const fakeFrame = createFakeFrame();
    attachFrame(stage, "sandbox-1", fakeFrame.target);
    const modPort = readModPort(fakeFrame);
    openPorts.push(modPort);
    render(<StageView stage={stage} />);

    await act(async function reportIssues(): Promise<void> {
      postNotification(modPort, "sandbox.blocked", {
        blockedUrl: "https://images.example.net/a.jpg",
        directive: "img-src",
      });
      postNotification(modPort, "sandbox.mountFailed", {
        message: "map failed",
      });
      await waitForMessages();
    });

    const items = within(
      screen.getByRole("list", { name: "Issues" }),
    ).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("warning");
    expect(items[0]).toHaveTextContent(SAMPLE_MOD_SOURCE);
    expect(items[0]).toHaveTextContent("https://images.example.net");
    expect(items[1]).toHaveTextContent("error");
    expect(items[1]).toHaveTextContent("map failed");
  });
});

function postNotification(
  port: MessagePort,
  method: string,
  params: object,
): void {
  port.postMessage({ jsonrpc: "2.0", method, params });
}
