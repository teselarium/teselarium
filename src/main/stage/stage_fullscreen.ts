import {
  changeStageFullscreen,
  warnFullscreenRefused,
} from "../../lib/core/stage/index.ts";
import type { Stage } from "../../lib/core/stage/index.ts";

/**
 * The fullscreen of mod frames, seen from the app's document. When a mod
 * shows one of its own elements fullscreen, the app's `fullscreenElement` is
 * the mod's frame, so one rule covers the stage bar's button, the mod's own
 * request, Esc and the browser's exit (design.md, D3).
 */

/**
 * The sandbox whose frame is the app document's fullscreen element, read
 * from the `data-sandbox-id` of the frame's parent, or `null`.
 */
export function readFullscreenSandboxId(appDocument: Document): string | null {
  const element = appDocument.fullscreenElement ?? null;
  if (!(element instanceof HTMLIFrameElement)) {
    return null;
  }
  const sandboxId = element.parentElement?.dataset.sandboxId ?? null;
  return sandboxId;
}

/** For `fullscreenchange`: tells the stage which sandbox is fullscreen now, if any. */
export function followFullscreenChange(stage: Stage): void {
  changeStageFullscreen(stage, readFullscreenSandboxId(document));
}

/** The frame of a sandbox inside the stage view, or `null` when it has none. */
export function findSandboxFrame(
  stageView: HTMLElement,
  sandboxId: string,
): HTMLIFrameElement | null {
  const selector = `[data-sandbox-id="${CSS.escape(sandboxId)}"] > iframe`;
  const frame = stageView.querySelector<HTMLIFrameElement>(selector);
  return frame;
}

function describeRefusal(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

/** Gives the keyboard to the mod once its frame is fullscreen. */
function focusFullscreenFrame(frame: HTMLIFrameElement): void {
  frame.focus();
}

function reportRefusal(stage: Stage, sandboxId: string, error: unknown): void {
  warnFullscreenRefused(stage, sandboxId, describeRefusal(error));
}

/**
 * Shows a sandbox's frame fullscreen. Called during the click, so the user
 * activation is the app's. Once it is fullscreen, the frame gets the focus;
 * when the browser refuses, the sandbox gets a warning with its reason.
 */
export function showSandboxFullscreen(
  stage: Stage,
  frame: HTMLIFrameElement,
  sandboxId: string,
): Promise<void> {
  const showing = frame
    .requestFullscreen()
    .then(
      focusFullscreenFrame.bind(undefined, frame),
      reportRefusal.bind(undefined, stage, sandboxId),
    );
  return showing;
}
