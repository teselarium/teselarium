/** The observers the fake `ResizeObserver` built, so a test can resize what they observe. */
const fakeObservers: FakeResizeObserver[] = [];

/**
 * Stands for `ResizeObserver`, which jsdom lacks (setup.ts gives one that
 * reports nothing): the test reports a content width with
 * `resizeObservedElements`. Install it with
 * `vi.stubGlobal("ResizeObserver", FakeResizeObserver)`, and forget its
 * observers with `forgetFakeResizeObservers` after each test.
 */
export class FakeResizeObserver implements ResizeObserver {
  callback: ResizeObserverCallback;
  targets: Element[] = [];

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    fakeObservers.push(this);
  }

  observe(target: Element): void {
    this.targets.push(target);
  }

  unobserve(target: Element): void {
    this.targets = this.targets.filter(isOtherElement.bind(undefined, target));
  }

  disconnect(): void {
    this.targets = [];
  }
}

function isOtherElement(removed: Element, target: Element): boolean {
  return target !== removed;
}

function buildEntry(target: Element, width: number): ResizeObserverEntry {
  const entry = {
    target,
    contentBoxSize: [{ inlineSize: width, blockSize: 40 }],
    contentRect: { width, height: 40 },
  } as unknown as ResizeObserverEntry;
  return entry;
}

/** The observed elements that match `selector` get a content box `width` pixels wide: their observers are told. */
export function resizeObservedElements(selector: string, width: number): void {
  for (const observer of fakeObservers) {
    for (const target of observer.targets) {
      if (target.matches(selector)) {
        observer.callback([buildEntry(target, width)], observer);
      }
    }
  }
}

/** Forgets every fake observer, after a test. */
export function forgetFakeResizeObservers(): void {
  fakeObservers.length = 0;
}
