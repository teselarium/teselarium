import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { MessageSnapshot } from "../../lib/core/stage/index.ts";
import { TooltipProvider } from "@/vendor/shadcn/ui/tooltip.tsx";
import { buildTestMessage } from "../../test/test_messages.ts";
import { MessagesButton } from "./MessagesButton.tsx";

function renderButton(messages: MessageSnapshot[]): HTMLElement {
  render(
    <TooltipProvider>
      <MessagesButton messages={messages} flashId={0} />
    </TooltipProvider>,
  );
  return screen.getByRole("button", { name: /^Messages: / });
}

function readCapsule(button: HTMLElement): HTMLElement | null {
  return button.querySelector<HTMLElement>("[data-capsule]");
}

const ERROR_AND_NOTIFICATIONS: readonly MessageSnapshot[] = [
  buildTestMessage(1, "info", "Tiles reloaded"),
  buildTestMessage(2, "error", "map failed"),
  buildTestMessage(3, "info", "Tiles reloaded again"),
];

describe("MessagesButton", function describeMessagesButton(): void {
  it("Errors and notifications: the errors icon and the total in the errors' color", function showsMostSevere(): void {
    const button = renderButton([...ERROR_AND_NOTIFICATIONS]);

    expect(button).toHaveAttribute("data-level", "error");
    expect(readCapsule(button)).toHaveTextContent("3");
    expect(readCapsule(button)?.dataset.capsule).toBe("unread");
    expect(readCapsule(button)).toHaveClass("bg-destructive");
  });

  it("fills the capsule in the color of the most severe unread level", function fillsUnreadLevel(): void {
    const button = renderButton([
      buildTestMessage(1, "error", "map failed", true),
      buildTestMessage(2, "info", "Tiles reloaded"),
    ]);

    expect(button).toHaveAttribute("data-level", "error");
    expect(readCapsule(button)).toHaveClass("bg-primary");
  });

  it("All read: the capsule is muted", function mutesRead(): void {
    const button = renderButton([
      buildTestMessage(1, "error", "map failed", true),
      buildTestMessage(2, "info", "Tiles reloaded", true),
    ]);

    expect(readCapsule(button)?.dataset.capsule).toBe("read");
    expect(readCapsule(button)).toHaveClass("bg-muted");
  });

  it("shows 99+ above 99", function showsNinetyNinePlus(): void {
    const messages: MessageSnapshot[] = [];
    for (let id = 1; id <= 100; id++) {
      messages.push(buildTestMessage(id, "warning", `Warning ${id}`));
    }

    expect(readCapsule(renderButton(messages))).toHaveTextContent("99+");
  });

  it("No messages: dimmed, the notifications icon, no capsule, focusable", function dimsEmpty(): void {
    const button = renderButton([]);

    expect(button).toHaveAttribute("data-level", "info");
    expect(button).toHaveAttribute("data-empty");
    expect(readCapsule(button)).toBeNull();
    button.focus();
    expect(button).toHaveFocus();
  });

  it("Accessible name: each level's count and the unread total", function namesCounts(): void {
    const button = renderButton([
      buildTestMessage(1, "error", "map failed"),
      buildTestMessage(2, "info", "Tiles reloaded", true),
      buildTestMessage(3, "info", "Tiles reloaded again", true),
    ]);

    expect(button).toHaveAccessibleName(
      "Messages: 1 error, 0 warnings, 2 notifications, 1 unread",
    );
  });
});
