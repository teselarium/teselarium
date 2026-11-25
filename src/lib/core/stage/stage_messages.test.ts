import { describe, expect, it } from "vitest";
import {
  addModMessage,
  buildAppIssueContent,
  buildAppNotification,
  buildNoDroppedMessages,
  buildSandboxMessage,
  buildSandboxMessages,
  dismissNotification,
  markLevelRead,
  MAX_MOD_MESSAGES,
  removeNotifications,
} from "./stage_messages.ts";
import type {
  ArrivedMessages,
  MessageContent,
  MessageLevel,
  SandboxMessage,
} from "./stage_messages.ts";

const MOD_SOURCE = "https://example.org/mods/book_list/mod_conf.yaml";
const TILE_SOURCE = "https://example.org/books/kallocain.md";

function buildModContent(level: MessageLevel, text: string): MessageContent {
  const content: MessageContent = {
    level,
    producer: "mod",
    source: MOD_SOURCE,
    text,
  };
  return content;
}

function buildTileIssue(id: number): SandboxMessage {
  return buildSandboxMessage(
    id,
    buildAppIssueContent({
      level: "warning",
      source: TILE_SOURCE,
      message: "Tile is not of tile type book",
    }),
  );
}

function readTexts(messages: readonly SandboxMessage[]): string[] {
  const texts: string[] = [];
  for (const message of messages) {
    texts.push(message.text);
  }
  return texts;
}

/** Adds `count` info messages from the mod, numbered from `firstId`, one at a time. */
function addModNotifications(
  arrived: ArrivedMessages,
  firstId: number,
  count: number,
): ArrivedMessages {
  let current = arrived;
  for (let index = 0; index < count; index += 1) {
    const message = buildSandboxMessage(
      firstId + index,
      buildModContent("info", `Note ${index + 1}`),
    );
    current = addModMessage(current, message);
  }
  return current;
}

describe("buildSandboxMessages", function describeBuildSandboxMessages(): void {
  it("numbers the messages in order from the first id", function numbersMessages(): void {
    const messages = buildSandboxMessages(4, [
      buildModContent("info", "Saved"),
      buildModContent("error", "Broken"),
    ]);

    expect(messages).toEqual([
      {
        id: 4,
        level: "info",
        producer: "mod",
        source: MOD_SOURCE,
        text: "Saved",
      },
      {
        id: 5,
        level: "error",
        producer: "mod",
        source: MOD_SOURCE,
        text: "Broken",
      },
    ]);
  });

  it("makes an issue a message from the app", function convertsIssue(): void {
    const content = buildAppIssueContent({
      level: "error",
      source: TILE_SOURCE,
      message: "Cannot load file",
    });

    expect(content).toEqual({
      level: "error",
      producer: "app",
      source: TILE_SOURCE,
      text: "Cannot load file",
    });
  });

  it("makes a notification an info message from the app", function buildsNotification(): void {
    const content = buildAppNotification(MOD_SOURCE, "Loaded 3 tiles.");

    expect(content).toEqual({
      level: "info",
      producer: "app",
      source: MOD_SOURCE,
      text: "Loaded 3 tiles.",
    });
  });
});

describe("markLevelRead", function describeMarkLevelRead(): void {
  it("adds the ids of every message of the level and keeps the others", function marksLevel(): void {
    const messages = [
      buildTileIssue(1),
      buildSandboxMessage(2, buildModContent("info", "Saved")),
      buildSandboxMessage(3, buildModContent("warning", "Slow")),
    ];
    const readIds = new Set([2]);

    const newReadIds = markLevelRead(messages, readIds, "warning");

    expect([...newReadIds].sort()).toEqual([1, 2, 3]);
    expect([...readIds]).toEqual([2]);
  });
});

describe("dismissNotification", function describeDismissNotification(): void {
  it("removes the notification with the id", function dismissesNotification(): void {
    const messages = [
      buildSandboxMessage(1, buildModContent("info", "First")),
      buildSandboxMessage(2, buildModContent("info", "Second")),
    ];

    const keptMessages = dismissNotification(messages, 1);

    expect(readTexts(keptMessages)).toEqual(["Second"]);
    expect(messages).toHaveLength(2);
  });

  it("ignores dismissing an error", function ignoresError(): void {
    const messages = [buildSandboxMessage(1, buildModContent("error", "Bad"))];

    const keptMessages = dismissNotification(messages, 1);

    expect(keptMessages).toEqual(messages);
  });

  it("ignores an unknown id", function ignoresUnknownId(): void {
    const messages = [buildSandboxMessage(1, buildModContent("info", "Saved"))];

    const keptMessages = dismissNotification(messages, 9);

    expect(keptMessages).toEqual(messages);
  });
});

describe("removeNotifications", function describeRemoveNotifications(): void {
  it("Clear all leaves the errors and warnings", function leavesIssues(): void {
    const messages = [
      buildSandboxMessage(1, buildModContent("info", "Saved")),
      buildSandboxMessage(2, buildModContent("error", "Bad")),
      buildTileIssue(3),
      buildSandboxMessage(4, buildModContent("info", "Done")),
    ];

    const keptMessages = removeNotifications(messages);

    expect(readTexts(keptMessages)).toEqual([
      "Bad",
      "Tile is not of tile type book",
    ]);
  });
});

describe("addModMessage", function describeAddModMessage(): void {
  it("adds a message at the end without dropping under the cap", function addsUnderCap(): void {
    const arrived: ArrivedMessages = {
      messages: [buildTileIssue(1)],
      droppedModMessages: buildNoDroppedMessages(),
    };

    const newArrived = addModNotifications(arrived, 2, MAX_MOD_MESSAGES);

    expect(newArrived.messages).toHaveLength(MAX_MOD_MESSAGES + 1);
    expect(newArrived.droppedModMessages).toEqual(buildNoDroppedMessages());
    expect(arrived.messages).toHaveLength(1);
  });

  it("the 101st mod message drops the oldest mod message and no app message", function dropsOldest(): void {
    const arrived: ArrivedMessages = {
      messages: [buildTileIssue(1)],
      droppedModMessages: buildNoDroppedMessages(),
    };

    const newArrived = addModNotifications(arrived, 2, MAX_MOD_MESSAGES + 1);

    expect(newArrived.messages).toHaveLength(MAX_MOD_MESSAGES + 1);
    expect(newArrived.messages[0]).toEqual(buildTileIssue(1));
    expect(newArrived.messages[1].text).toBe("Note 2");
    expect(newArrived.messages.at(-1)?.text).toBe("Note 101");
    expect(newArrived.droppedModMessages).toEqual({
      error: 0,
      warning: 0,
      info: 1,
    });
  });

  it("Notifications drop no error or warning", function keepsOtherLevels(): void {
    const withError = addModMessage(
      {
        messages: [buildTileIssue(1)],
        droppedModMessages: buildNoDroppedMessages(),
      },
      buildSandboxMessage(2, buildModContent("error", "Broken")),
    );
    const withWarning = addModMessage(
      withError,
      buildSandboxMessage(3, buildModContent("warning", "Slow")),
    );

    const newArrived = addModNotifications(withWarning, 4, 105);

    const texts = readTexts(newArrived.messages);
    expect(texts).toContain("Tile is not of tile type book");
    expect(texts).toContain("Broken");
    expect(texts).toContain("Slow");
    expect(texts).not.toContain("Note 5");
    expect(texts).toContain("Note 6");
    expect(newArrived.messages).toHaveLength(3 + MAX_MOD_MESSAGES);
    expect(newArrived.droppedModMessages).toEqual({
      error: 0,
      warning: 0,
      info: 5,
    });
  });

  it("the 101st notification drops a notification and no error, warning or app message", function dropsNotificationOnly(): void {
    const withError = addModMessage(
      {
        messages: [buildTileIssue(1)],
        droppedModMessages: buildNoDroppedMessages(),
      },
      buildSandboxMessage(2, buildModContent("error", "Broken")),
    );
    const withWarning = addModMessage(
      withError,
      buildSandboxMessage(3, buildModContent("warning", "Slow")),
    );

    const newArrived = addModNotifications(
      withWarning,
      4,
      MAX_MOD_MESSAGES + 1,
    );

    expect(readTexts(newArrived.messages).slice(0, 4)).toEqual([
      "Tile is not of tile type book",
      "Broken",
      "Slow",
      "Note 2",
    ]);
    expect(newArrived.droppedModMessages).toEqual({
      error: 0,
      warning: 0,
      info: 1,
    });
  });

  it("caps each level on its own", function capsEachLevel(): void {
    const withWarnings = addModMessage(
      { messages: [], droppedModMessages: buildNoDroppedMessages() },
      buildSandboxMessage(1, buildModContent("warning", "Slow")),
    );
    const withNotes = addModNotifications(withWarnings, 2, MAX_MOD_MESSAGES);

    const newArrived = addModMessage(
      withNotes,
      buildSandboxMessage(200, buildModContent("warning", "Slower")),
    );

    expect(readTexts(newArrived.messages)).toContain("Slow");
    expect(newArrived.messages).toHaveLength(MAX_MOD_MESSAGES + 2);
    expect(newArrived.droppedModMessages).toEqual(buildNoDroppedMessages());
  });

  it("Mod sends too many", function dropsFive(): void {
    const newArrived = addModNotifications(
      { messages: [], droppedModMessages: buildNoDroppedMessages() },
      1,
      105,
    );

    expect(newArrived.messages).toHaveLength(100);
    expect(newArrived.droppedModMessages.info).toBe(5);
  });
});
