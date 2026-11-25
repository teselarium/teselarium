import { describe, expect, it } from "vitest";
import {
  buildAskingContext,
  catchMethodError,
} from "../../../test/method_contexts.ts";
import { LINKS_METHODS, readLinkUrl } from "./links_methods.ts";
import { INVALID_PARAMS, PERMISSION_DENIED } from "./mod_messages.ts";
import type { ModMethodContext } from "./mod_methods.ts";

function openLink(context: ModMethodContext, params: object): Promise<unknown> {
  return LINKS_METHODS["links.open"](context, params as never);
}

function readUrl(url: unknown): string {
  return readLinkUrl({ url } as never);
}

describe("readLinkUrl", function describeReadLinkUrl(): void {
  it("Script address", async function rejectsScriptAddress(): Promise<void> {
    const error = await catchMethodError(
      readUrl.bind(undefined, "javascript:alert(1)"),
    );

    expect(error.code).toBe(INVALID_PARAMS);
    expect(error.message).toBe(
      'links.open: "url" must be an http: or https: address',
    );
  });

  it("Relative address", async function rejectsRelativeAddress(): Promise<void> {
    const error = await catchMethodError(
      readUrl.bind(undefined, "./books.html"),
    );

    expect(error.code).toBe(INVALID_PARAMS);
    expect(error.message).toBe(
      'links.open: "url" must be an http: or https: address',
    );
  });

  it("Address with a password", async function rejectsPassword(): Promise<void> {
    const error = await catchMethodError(
      readUrl.bind(undefined, "https://user:secret@example.org/"),
    );

    expect(error.code).toBe(INVALID_PARAMS);
    expect(error.message).toBe(
      'links.open: "url" must not hold a user name or password',
    );
  });

  it("rejects a user name without a password", async function rejectsUserName(): Promise<void> {
    const error = await catchMethodError(
      readUrl.bind(undefined, "https://user@example.org/"),
    );

    expect(error.message).toBe(
      'links.open: "url" must not hold a user name or password',
    );
  });

  it("rejects a url that is not a string", async function rejectsNumber(): Promise<void> {
    for (const url of [undefined, 12, null, ["https://example.org/"]]) {
      const error = await catchMethodError(readUrl.bind(undefined, url));

      expect(error.code).toBe(INVALID_PARAMS);
      expect(error.message).toBe(
        'links.open: "url" must be an http: or https: address',
      );
    }
  });

  it("rejects other protocols", async function rejectsOtherProtocols(): Promise<void> {
    const urls = [
      "data:text/html,<b>x</b>",
      "file:///etc/passwd",
      "ftp://example.org/",
      "blob:https://example.org/1",
    ];
    for (const url of urls) {
      const error = await catchMethodError(readUrl.bind(undefined, url));

      expect(error.code).toBe(INVALID_PARAMS);
    }
  });

  it("normalizes a valid address to its href", function normalizesHref(): void {
    expect(readUrl("https://example.org/books?id=1")).toBe(
      "https://example.org/books?id=1",
    );
    expect(readUrl("HTTP://Example.org")).toBe("http://example.org/");
    expect(readUrl("https://example.org/a/../b c")).toBe(
      "https://example.org/b%20c",
    );
  });

  it("shows an internationalized host in punycode", function showsPunycode(): void {
    expect(readUrl("https://bücher.example/")).toBe(
      "https://xn--bcher-kva.example/",
    );
  });
});

describe("links.open", function describeLinksOpen(): void {
  it("asks the user to open the normalized address", async function asksUser(): Promise<void> {
    const { context, requestSpy } = buildAskingContext(true);

    const result = await openLink(context, {
      url: "https://example.org/books?id=1",
    });

    expect(result).toBe(true);
    expect(requestSpy).toHaveBeenCalledExactlyOnceWith({
      kind: "link",
      url: "https://example.org/books?id=1",
    });
  });

  it("answers false when the user cancels", async function answersCancel(): Promise<void> {
    const { context } = buildAskingContext(false);

    const result = await openLink(context, { url: "https://example.org/" });

    expect(result).toBe(false);
  });

  it("answers -32002 for a hidden mod", async function refusesHidden(): Promise<void> {
    const { context } = buildAskingContext(null);

    const error = await catchMethodError(
      openLink.bind(undefined, context, { url: "https://example.org/" }),
    );

    expect(error.code).toBe(PERMISSION_DENIED);
    expect(error.message).toBe(
      "links.open: only the visible mod can ask the user",
    );
  });

  it("shows no dialog for a wrong address", async function asksNothing(): Promise<void> {
    const { context, requestSpy } = buildAskingContext(true);

    await catchMethodError(
      openLink.bind(undefined, context, { url: "javascript:alert(1)" }),
    );

    expect(requestSpy).not.toHaveBeenCalled();
  });
});
