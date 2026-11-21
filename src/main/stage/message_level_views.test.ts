import { describe, expect, it } from "vitest";
import type {
  MessageLevel,
  MessageSnapshot,
} from "../../lib/core/stage/index.ts";
import {
  describeMessagesButton,
  pickMessagesView,
  pickUnreadView,
} from "./message_level_views.ts";

function buildMessage(
  id: number,
  level: MessageLevel,
  isRead: boolean,
): MessageSnapshot {
  const message: MessageSnapshot = {
    id,
    level,
    producer: "mod",
    source: "https://example.org/mods/book_list/mod_conf.yaml",
    text: `Message ${id}`,
    isRead,
  };
  return message;
}

describe("pickMessagesView", function describePickMessagesView(): void {
  it("picks the most severe level that has messages", function picksMostSevere(): void {
    const messages = [
      buildMessage(1, "info", true),
      buildMessage(2, "warning", true),
      buildMessage(3, "error", true),
    ];

    const picked = pickMessagesView(messages);

    expect(picked.view.level).toBe("error");
    expect(picked.isEmpty).toBe(false);
  });

  it("picks warnings over notifications", function picksWarnings(): void {
    const messages = [
      buildMessage(1, "info", false),
      buildMessage(2, "warning", true),
    ];

    expect(pickMessagesView(messages).view.level).toBe("warning");
  });

  it("picks the notifications, empty, without messages", function picksEmpty(): void {
    const picked = pickMessagesView([]);

    expect(picked.view.level).toBe("info");
    expect(picked.isEmpty).toBe(true);
  });
});

describe("pickUnreadView", function describePickUnreadView(): void {
  it("picks the most severe level with unread messages, not the most severe level", function picksUnread(): void {
    const messages = [
      buildMessage(1, "error", true),
      buildMessage(2, "info", false),
    ];

    expect(pickUnreadView(messages)?.level).toBe("info");
  });

  it("picks none once every message is read", function picksNone(): void {
    const messages = [
      buildMessage(1, "error", true),
      buildMessage(2, "info", true),
    ];

    expect(pickUnreadView(messages)).toBeNull();
    expect(pickUnreadView([])).toBeNull();
  });
});

describe("describeMessagesButton", function describeDescribeMessagesButton(): void {
  it("gives each level's count and the unread total", function namesCounts(): void {
    const messages = [
      buildMessage(1, "error", false),
      buildMessage(2, "info", true),
      buildMessage(3, "info", true),
    ];

    expect(describeMessagesButton(messages)).toBe(
      "Messages: 1 error, 0 warnings, 2 notifications, 1 unread",
    );
  });

  it("names no messages", function namesEmpty(): void {
    expect(describeMessagesButton([])).toBe(
      "Messages: 0 errors, 0 warnings, 0 notifications, 0 unread",
    );
  });
});
