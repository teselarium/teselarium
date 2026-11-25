import { SANDBOX_CONNECT_METHOD } from "./sandbox_messages.ts";
import type { SandboxConnectParams } from "./sandbox_messages.ts";

/**
 * Opens the private channel to a mod's frame: posts the `sandbox.connect`
 * notification with the mod's code and context and one end of a new
 * `MessageChannel`, and returns the engine's end. The target origin is `"*"`
 * because an opaque origin cannot be named; the message goes to the frame
 * object the app itself created.
 */
export function openSandboxChannel(
  frameTarget: Pick<Window, "postMessage">,
  params: SandboxConnectParams,
): MessagePort {
  const channel = new MessageChannel();
  const notification = {
    jsonrpc: "2.0",
    method: SANDBOX_CONNECT_METHOD,
    params,
  };
  frameTarget.postMessage(notification, "*", [channel.port2]);
  return channel.port1;
}
