import type { MessageLevel, MessageSnapshot } from "../lib/core/stage/index.ts";

/** A message from a mod, as a stage snapshot holds it. */
export function buildTestMessage(
  id: number,
  level: MessageLevel,
  text: string,
  isRead: boolean = false,
): MessageSnapshot {
  const message: MessageSnapshot = {
    id,
    level,
    producer: "mod",
    source: "https://example.org/mods/book_list/mod_conf.yaml",
    text,
    isRead,
  };
  return message;
}
