import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import type { MessageSnapshot } from "../../lib/core/stage/index.ts";
import { buildTestMessage } from "../../test/test_messages.ts";
import { MessagesPopover } from "./MessagesPopover.tsx";
import { recordUnreadMarks } from "./unread_marks.ts";
import type { UnreadMarks } from "./unread_marks.ts";

const NO_DROPPED = Object.freeze({ error: 0, warning: 0, info: 0 });

interface RenderedPopover {
  onDismiss: Mock<(messageId: number) => void>;
  onClearAll: Mock<() => void>;
}

function renderPopover(
  messages: MessageSnapshot[],
  unreadMarks: UnreadMarks | null = null,
): RenderedPopover {
  const onDismiss = vi.fn<(messageId: number) => void>();
  const onClearAll = vi.fn<() => void>();
  render(
    <MessagesPopover
      messages={messages}
      droppedCounts={NO_DROPPED}
      unreadMarks={unreadMarks}
      onDismiss={onDismiss}
      onClearAll={onClearAll}
    />,
  );
  const rendered: RenderedPopover = { onDismiss, onClearAll };
  return rendered;
}

function readHeadings(): string[] {
  const headings: string[] = [];
  for (const heading of screen.getAllByRole("heading")) {
    headings.push(heading.textContent ?? "");
  }
  return headings;
}

function readItemTexts(listName: string): string[] {
  const texts: string[] = [];
  const list = screen.getByRole("list", { name: listName });
  for (const item of within(list).getAllByRole("listitem")) {
    texts.push(item.textContent ?? "");
  }
  return texts;
}

/** One error and two notifications, found in an order unlike the groups'. */
const GROUPED_MESSAGES: readonly MessageSnapshot[] = [
  buildTestMessage(1, "info", "First notification"),
  buildTestMessage(2, "error", "map failed"),
  buildTestMessage(3, "info", "Second notification"),
];

describe("MessagesPopover", function describeMessagesPopover(): void {
  it("Grouped messages: Errors, then Notifications newest first, and no Warnings", function groupsLevels(): void {
    renderPopover([...GROUPED_MESSAGES]);

    expect(readHeadings()).toEqual(["Errors", "Notifications"]);
    expect(readItemTexts("Errors")).toHaveLength(1);
    const notifications = readItemTexts("Notifications");
    expect(notifications[0]).toContain("Second notification");
    expect(notifications[1]).toContain("First notification");
    expect(screen.queryByRole("list", { name: "Warnings" })).toBeNull();
  });

  it("puts warnings between errors and notifications", function ordersLevels(): void {
    renderPopover([
      buildTestMessage(1, "info", "Tiles reloaded"),
      buildTestMessage(2, "warning", "Image blocked"),
      buildTestMessage(3, "error", "map failed"),
    ]);

    expect(readHeadings()).toEqual(["Errors", "Warnings", "Notifications"]);
  });

  it("Empty: No messages.", function saysEmpty(): void {
    renderPopover([]);

    expect(screen.getByText("No messages.")).toBeInTheDocument();
    expect(screen.queryByRole("heading")).toBeNull();
  });

  it("marks the items unread when it opened, of every level", function marksUnread(): void {
    const messages = [
      buildTestMessage(1, "error", "map failed"),
      buildTestMessage(2, "info", "Old notification", true),
      buildTestMessage(3, "info", "New notification"),
    ];

    renderPopover(messages, recordUnreadMarks(messages));

    const unread = document.querySelectorAll("[data-unread]");
    expect(unread).toHaveLength(2);
    expect(unread[0]).toHaveTextContent("map failed");
    expect(unread[1]).toHaveTextContent("New notification");
  });

  it("Dismiss and Clear all for notifications only", function dismisses(): void {
    const { onDismiss, onClearAll } = renderPopover([...GROUPED_MESSAGES]);

    const dismissButtons = screen.getAllByRole("button", {
      name: /^Dismiss: /,
    });
    expect(dismissButtons).toHaveLength(2);
    fireEvent.click(dismissButtons[0]);
    fireEvent.click(screen.getByRole("button", { name: "Clear all" }));

    expect(onDismiss).toHaveBeenCalledExactlyOnceWith(3);
    expect(onClearAll).toHaveBeenCalledOnce();
  });
});
