import { describe, expect, it } from "vitest";
import {
  createFakeFrame,
  readModPort,
  receiveMessage,
} from "../../../test/fake_frames.ts";
import { openSandboxChannel } from "./index.ts";
import type { SandboxConnectParams } from "./index.ts";

const CONNECT_PARAMS: SandboxConnectParams = {
  code: "export default function mount() {}",
  context: { mod: { name: "probe" }, tiles: [] },
};

describe("openSandboxChannel", function describeOpenSandboxChannel(): void {
  it("posts one sandbox.connect notification with the code and context", function postsConnect(): void {
    const fakeFrame = createFakeFrame();

    const enginePort = openSandboxChannel(fakeFrame.target, CONNECT_PARAMS);

    expect(fakeFrame.posted).toHaveLength(1);
    expect(fakeFrame.posted[0].message).toEqual({
      jsonrpc: "2.0",
      method: "sandbox.connect",
      params: CONNECT_PARAMS,
    });
    enginePort.close();
  });

  it('posts to the target origin "*" with exactly one port', function transfersOnePort(): void {
    const fakeFrame = createFakeFrame();

    const enginePort = openSandboxChannel(fakeFrame.target, CONNECT_PARAMS);

    expect(fakeFrame.posted[0].targetOrigin).toBe("*");
    expect(fakeFrame.posted[0].transfer).toHaveLength(1);
    enginePort.close();
  });

  it("returns the port that talks to the transferred one", async function connectsPorts(): Promise<void> {
    const fakeFrame = createFakeFrame();
    const enginePort = openSandboxChannel(fakeFrame.target, CONNECT_PARAMS);
    const modPort = readModPort(fakeFrame);

    const receiving = receiveMessage(enginePort);
    modPort.postMessage({ hello: "engine" });

    expect(await receiving).toEqual({ hello: "engine" });
    enginePort.close();
    modPort.close();
  });
});
