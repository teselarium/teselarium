import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import type {
  MessageLevel,
  MessageSnapshot,
} from "../../lib/core/stage/index.ts";
import { MESSAGE_LEVEL_VIEWS } from "./message_level_views.ts";
import type { MessageLevelView } from "./message_level_views.ts";
import { MessagePopover } from "./MessagePopover.tsx";
import { recordUnreadMarks } from "./unread_marks.ts";
import type { UnreadMarks } from "./unread_marks.ts";

const MOD_SOURCE = "https://example.org/mods/book_list/mod_conf.yaml";

function findView(level: MessageLevel): MessageLevelView {
  for (const view of MESSAGE_LEVEL_VIEWS) {
    if (view.level === level) {
      return view;
    }
  }
  throw new Error(`Expected a view for the level "${level}"`);
}

function buildMessage(
  id: number,
  level: MessageLevel,
  producer: "app" | "mod",
  text: string,
): MessageSnapshot {
  const message: MessageSnapshot = {
    id,
    level,
    producer,
    source: MOD_SOURCE,
    text,
    isRead: false,
  };
  return message;
}

interface RenderedPopover {
  onDismiss: Mock<(messageId: number) => void>;
  onClearAll: Mock<() => void>;
}

function renderPopover(
  level: MessageLevel,
  messages: MessageSnapshot[],
  droppedCount: number = 0,
  unreadMarks: UnreadMarks | null = null,
): RenderedPopover {
  const onDismiss = vi.fn<(messageId: number) => void>();
  const onClearAll = vi.fn<() => void>();
  render(
    <MessagePopover
      view={findView(level)}
      messages={messages}
      droppedCount={droppedCount}
      unreadMarks={unreadMarks}
      onDismiss={onDismiss}
      onClearAll={onClearAll}
    />,
  );
  const rendered: RenderedPopover = { onDismiss, onClearAll };
  return rendered;
}

describe("MessagePopover", function describeMessagePopover(): void {
  it("says No errors., No warnings. and No notifications. when empty", function saysEmpty(): void {
    for (const [level, text] of [
      ["error", "No errors."],
      ["warning", "No warnings."],
      ["info", "No notifications."],
    ] as const) {
      const { unmount } = render(
        <MessagePopover
          view={findView(level)}
          messages={[]}
          droppedCount={0}
          unreadMarks={null}
          onDismiss={vi.fn<(messageId: number) => void>()}
          onClearAll={vi.fn<() => void>()}
        />,
      );

      expect(screen.getByText(text)).toBeInTheDocument();
      expect(screen.queryByRole("list")).toBeNull();
      unmount();
    }
  });

  it("lists the messages newest first with producer, source and text", function listsMessages(): void {
    renderPopover("error", [
      buildMessage(1, "error", "app", "Tile is not of tile type book"),
      buildMessage(2, "error", "mod", "Broken"),
    ]);

    const items = within(
      screen.getByRole("list", { name: "Errors" }),
    ).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("Mod");
    expect(items[0]).toHaveTextContent("Broken");
    expect(items[1]).toHaveTextContent("App");
    expect(items[1]).toHaveTextContent(MOD_SOURCE);
    expect(items[1]).toHaveTextContent("Tile is not of tile type book");
    expect(screen.queryByText(/dropped/)).toBeNull();
  });

  it("Reloaded issue on top", function listsReloadedIssueFirst(): void {
    // A reload gives the tile's issue a new id, higher than the mod's warning, though it comes first in the stage's order.
    renderPopover("warning", [
      buildMessage(5, "warning", "app", "Tile is not of tile type book"),
      buildMessage(3, "warning", "mod", "Slow"),
    ]);

    const items = screen.getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("Tile is not of tile type book");
    expect(items[1]).toHaveTextContent("Slow");
  });

  it("labels the producers with badges that look different", function labelsProducers(): void {
    renderPopover("info", [
      buildMessage(1, "info", "app", "Loaded"),
      buildMessage(2, "info", "mod", "Saved"),
    ]);

    const appLabel = screen.getByText("App");
    const modLabel = screen.getByText("Mod");
    expect(appLabel.dataset.variant).toBe("outline");
    expect(modLabel.dataset.variant).toBe("secondary");
    expect(modLabel.querySelector("svg")).not.toBeNull();
  });

  it("Mod titled like the app", function keepsModLabel(): void {
    const message = buildMessage(1, "info", "mod", "Sign in again");
    message.source = "App";
    renderPopover("info", [message]);

    const item = screen.getByRole("listitem");
    expect(within(item).getByText("Mod")).toHaveAttribute(
      "data-producer",
      "mod",
    );
  });

  it("Plain text", function showsPlainText(): void {
    renderPopover("info", [buildMessage(1, "info", "mod", "<b>Saved</b>")]);

    expect(screen.getByText("<b>Saved</b>")).toBeInTheDocument();
    expect(document.querySelector("b")).toBeNull();
  });

  it("Warnings stay", function hasNoDismissForWarnings(): void {
    renderPopover("warning", [
      buildMessage(1, "warning", "app", "First"),
      buildMessage(2, "warning", "app", "Second"),
    ]);

    expect(screen.queryByRole("button", { name: /Dismiss/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Clear all" })).toBeNull();
  });

  it("dismisses one notification by its id", function dismissesOne(): void {
    const { onDismiss } = renderPopover("info", [
      buildMessage(4, "info", "app", "Loaded"),
      buildMessage(7, "info", "mod", "Saved"),
    ]);

    fireEvent.click(screen.getByRole("button", { name: "Dismiss: Saved" }));

    expect(onDismiss).toHaveBeenCalledExactlyOnceWith(7);
  });

  it("has Clear all only with two or more notifications", function clearsAll(): void {
    const { onClearAll } = renderPopover("info", [
      buildMessage(1, "info", "app", "Loaded"),
      buildMessage(2, "info", "mod", "Saved"),
    ]);

    fireEvent.click(screen.getByRole("button", { name: "Clear all" }));

    expect(onClearAll).toHaveBeenCalledOnce();
  });

  it("has no Clear all with one notification", function hidesClearAll(): void {
    renderPopover("info", [buildMessage(1, "info", "app", "Loaded")]);

    expect(screen.queryByRole("button", { name: "Clear all" })).toBeNull();
    expect(
      screen.getByRole("button", { name: "Dismiss: Loaded" }),
    ).toBeInTheDocument();
  });

  it("Mod sends too many", function endsWithDroppedNote(): void {
    renderPopover("info", [buildMessage(6, "info", "mod", "Note 6")], 5);

    const note = screen.getByText(
      "5 older messages from the mod were dropped.",
    );
    expect(note.compareDocumentPosition(screen.getByRole("list"))).toBe(
      Node.DOCUMENT_POSITION_PRECEDING,
    );
  });

  it("says one older message in the singular", function saysSingular(): void {
    renderPopover("warning", [], 1);

    expect(
      screen.getByText("1 older message from the mod was dropped."),
    ).toBeInTheDocument();
  });

  it("Unread items stand out", function marksUnread(): void {
    const readWarning = {
      ...buildMessage(1, "warning", "app", "First"),
      isRead: true,
    };
    const unreadWarning = buildMessage(2, "warning", "app", "Second");
    const messages = [readWarning, unreadWarning];
    renderPopover("warning", messages, 0, recordUnreadMarks(messages));

    const items = screen.getAllByRole("listitem");
    expect(items[0]).toHaveAttribute("data-unread");
    expect(items[0]).toHaveTextContent("Second");
    expect(items[0]).toHaveClass("bg-warning/10");
    expect(within(items[0]).getByText("Unread")).toHaveClass("sr-only");
    expect(items[1]).not.toHaveAttribute("data-unread");
    expect(within(items[1]).queryByText("Unread")).toBeNull();
    for (const item of items) {
      expect(item.querySelector("[data-unread-dot]")).not.toBeNull();
    }
  });

  it("Items read on the last opening are plain", function marksNothing(): void {
    const messages = [
      { ...buildMessage(1, "warning", "app", "First"), isRead: true },
      { ...buildMessage(2, "warning", "app", "Second"), isRead: true },
    ];
    renderPopover("warning", messages, 0, recordUnreadMarks(messages));

    expect(screen.queryByText("Unread")).toBeNull();
  });

  it("Message arriving while the popover is open", function marksArrival(): void {
    const first = {
      ...buildMessage(1, "warning", "app", "First"),
      isRead: true,
    };
    const marks = recordUnreadMarks([first]);
    const arrived = {
      ...buildMessage(2, "warning", "app", "Second"),
      isRead: true,
    };
    renderPopover("warning", [first, arrived], 0, marks);

    const items = screen.getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("Second");
    expect(within(items[0]).getByText("Unread")).toBeInTheDocument();
    expect(items[1]).not.toHaveAttribute("data-unread");
  });
});
