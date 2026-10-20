/** A message posted to a fake frame, with what `Window.postMessage` received. */
export interface PostedFrameMessage {
  message: unknown;
  targetOrigin: string;
  transfer: Transferable[];
}

/** Stands for a mod frame's window: it keeps every message posted to it. */
export interface FakeFrame {
  target: Pick<Window, "postMessage">;
  posted: PostedFrameMessage[];
}

function recordFramePost(
  posted: PostedFrameMessage[],
  message: unknown,
  targetOrigin: string,
  transfer: Transferable[] = [],
): void {
  posted.push({ message, targetOrigin, transfer });
}

export function createFakeFrame(): FakeFrame {
  const posted: PostedFrameMessage[] = [];
  const target = {
    postMessage: recordFramePost.bind(undefined, posted),
  } as Pick<Window, "postMessage">;
  const fakeFrame: FakeFrame = { target, posted };
  return fakeFrame;
}

/** The port the engine transferred to the frame with its first message: the mod's side of the channel. */
export function readModPort(fakeFrame: FakeFrame): MessagePort {
  const firstPost = fakeFrame.posted[0];
  if (firstPost === undefined || firstPost.transfer.length !== 1) {
    throw new Error("Expected the frame to have received one port");
  }
  return firstPost.transfer[0] as MessagePort;
}

function resolveWithData(
  resolve: (data: unknown) => void,
  event: MessageEvent,
): void {
  resolve(event.data);
}

function listenForMessage(
  port: MessagePort,
  resolve: (data: unknown) => void,
): void {
  port.addEventListener("message", resolveWithData.bind(undefined, resolve), {
    once: true,
  });
  port.start();
}

/** Waits for the next message on a port. */
export function receiveMessage(port: MessagePort): Promise<unknown> {
  return new Promise(listenForMessage.bind(undefined, port));
}

function collectData(received: unknown[], event: MessageEvent): void {
  received.push(event.data);
}

/** Keeps every message that arrives on a port in the returned list. */
export function collectMessages(port: MessagePort): unknown[] {
  const received: unknown[] = [];
  port.addEventListener("message", collectData.bind(undefined, received));
  port.start();
  return received;
}

function resolveAfterTimeout(resolve: () => void): void {
  setTimeout(resolve, 20);
}

/** Lets messages in flight on Node's `MessageChannel` arrive. */
export function waitForMessages(): Promise<void> {
  return new Promise(resolveAfterTimeout);
}
