import { render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { describe, expect, it } from "vitest";
import { Popover, PopoverTrigger } from "@/vendor/shadcn/ui/popover.tsx";
import { TooltipProvider } from "@/vendor/shadcn/ui/tooltip.tsx";
import type {
  MessageLevel,
  MessageSnapshot,
} from "../../lib/core/stage/index.ts";
import { MESSAGE_LEVEL_VIEWS } from "./message_level_views.ts";
import type { MessageLevelView } from "./message_level_views.ts";
import { MessageButton } from "./MessageButton.tsx";

function findView(level: MessageLevel): MessageLevelView {
  for (const view of MESSAGE_LEVEL_VIEWS) {
    if (view.level === level) {
      return view;
    }
  }
  throw new Error(`Expected a view for the level "${level}"`);
}

/** `count` messages of `level`, the first `readCount` of them read. */
function buildMessages(
  level: MessageLevel,
  count: number,
  readCount: number = 0,
): MessageSnapshot[] {
  const messages: MessageSnapshot[] = [];
  for (let index = 0; index < count; index += 1) {
    messages.push({
      id: index + 1,
      level,
      producer: "app",
      source: "https://example.org/books/kallocain.md",
      text: `Problem ${index + 1}`,
      isRead: index < readCount,
    });
  }
  return messages;
}

function renderButton(
  level: MessageLevel,
  messages: MessageSnapshot[],
  flashId: number = 0,
): HTMLElement {
  const element: ReactElement = (
    <TooltipProvider>
      <Popover>
        <PopoverTrigger asChild>
          <MessageButton
            view={findView(level)}
            messages={messages}
            flashId={flashId}
          />
        </PopoverTrigger>
      </Popover>
    </TooltipProvider>
  );
  render(element);
  return screen.getByRole("button");
}

function readCapsule(button: HTMLElement): HTMLElement | null {
  return button.querySelector<HTMLElement>("[data-capsule]");
}

describe("MessageButton", function describeMessageButton(): void {
  it("Two warnings", function showsCount(): void {
    const button = renderButton("warning", buildMessages("warning", 2));

    expect(readCapsule(button)).toHaveTextContent("2");
    expect(button).toHaveAccessibleName("Warnings: 2, 2 unread");
  });

  it("Many errors", function showsNinetyNinePlus(): void {
    const button = renderButton("error", buildMessages("error", 142, 40));

    expect(readCapsule(button)).toHaveTextContent("99+");
    expect(button).toHaveAccessibleName("Errors: 142, 102 unread");
  });

  it("shows 99 as the number", function showsNinetyNine(): void {
    const button = renderButton("info", buildMessages("info", 99));

    expect(readCapsule(button)).toHaveTextContent("99");
    expect(readCapsule(button)).not.toHaveTextContent("+");
  });

  it("fills the capsule in the level's color while a message is unread", function fillsUnread(): void {
    const button = renderButton("error", buildMessages("error", 2, 1));

    expect(readCapsule(button)?.dataset.capsule).toBe("unread");
    expect(readCapsule(button)).toHaveClass("bg-destructive");
  });

  it("mutes the capsule once every message was read", function mutesRead(): void {
    const button = renderButton("warning", buildMessages("warning", 2, 2));

    expect(readCapsule(button)?.dataset.capsule).toBe("read");
    expect(readCapsule(button)).toHaveClass("bg-muted");
    expect(button).toHaveAccessibleName("Warnings: 2, 0 unread");
  });

  it("is dimmed without a capsule and stays focusable when empty", function dimsEmpty(): void {
    const button = renderButton("warning", []);

    expect(readCapsule(button)).toBeNull();
    expect(button).toHaveAttribute("data-empty");
    expect(button).toBeEnabled();
    button.focus();
    expect(button).toHaveFocus();
    expect(button).toHaveAccessibleName("Warnings: 0, 0 unread");
  });

  it("hides the capsule from assistive technologies, since the name gives the count", function hidesCapsule(): void {
    const button = renderButton("info", buildMessages("info", 3));

    expect(readCapsule(button)).toHaveAttribute("aria-hidden", "true");
  });

  it("does not flash without a flash id", function staysStill(): void {
    const quiet = renderButton("warning", buildMessages("warning", 1));
    expect(quiet.querySelector("[data-flash]")).toBeNull();
  });

  it("flashes with a flash id, under motion-safe", function flashes(): void {
    const button = renderButton("warning", buildMessages("warning", 1), 1);

    const flashing = button.querySelector("[data-flash]");
    expect(flashing?.className).toContain(
      "motion-safe:animate-[stage-bar-flash",
    );
  });
});
