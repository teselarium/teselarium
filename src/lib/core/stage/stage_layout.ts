import type { FrameLayout } from "../engine/index.ts";

export type { FrameLayout } from "../engine/index.ts";

/**
 * The layout of a sandbox's frame, read from the stage's two facts:
 * `fullscreen` while the sandbox's frame is the fullscreen one, otherwise
 * `theater` while theater mode is on, otherwise `contained`.
 */
export function readSandboxLayout(
  theaterMode: boolean,
  fullscreenSandboxId: string | null,
  sandboxId: string,
): FrameLayout {
  if (fullscreenSandboxId === sandboxId) {
    return "fullscreen";
  }
  if (theaterMode) {
    return "theater";
  }
  return "contained";
}
