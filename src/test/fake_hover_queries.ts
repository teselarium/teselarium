/** The media query that tells whether the primary pointer can hover. */
const HOVER_QUERY = "(hover: hover)";

/**
 * Stands for the device behind `matchMedia("(hover: hover)")`: the test
 * changes whether its primary pointer can hover. Every other query of the
 * fake `matchMedia` never matches.
 */
export interface FakeHoverDevice {
  canHover: boolean;
  listeners: Set<() => void>;
}

/** The part of `MediaQueryList` the app reads. */
interface FakeMediaQueryList {
  readonly media: string;
  readonly matches: boolean;
  addEventListener: (type: "change", listener: () => void) => void;
  removeEventListener: (type: "change", listener: () => void) => void;
}

export function createFakeHoverDevice(canHover: boolean): FakeHoverDevice {
  const device: FakeHoverDevice = { canHover, listeners: new Set() };
  return device;
}

function readQueryMatches(device: FakeHoverDevice, query: string): boolean {
  return query === HOVER_QUERY && device.canHover;
}

function addDeviceListener(
  device: FakeHoverDevice,
  _type: "change",
  listener: () => void,
): void {
  device.listeners.add(listener);
}

function removeDeviceListener(
  device: FakeHoverDevice,
  _type: "change",
  listener: () => void,
): void {
  device.listeners.delete(listener);
}

function matchFakeMedia(
  device: FakeHoverDevice,
  query: string,
): FakeMediaQueryList {
  const list: FakeMediaQueryList = {
    media: query,
    get matches(): boolean {
      return readQueryMatches(device, query);
    },
    addEventListener: addDeviceListener.bind(undefined, device),
    removeEventListener: removeDeviceListener.bind(undefined, device),
  };
  return list;
}

/** A `matchMedia` that answers `(hover: hover)` from `device`. */
export function buildFakeMatchMedia(
  device: FakeHoverDevice,
): (query: string) => MediaQueryList {
  const matchMedia = matchFakeMedia.bind(undefined, device) as unknown as (
    query: string,
  ) => MediaQueryList;
  return matchMedia;
}

/** The user docks or undocks a pointer: `canHover` changes, then `change` fires. */
export function changePrimaryPointer(
  device: FakeHoverDevice,
  canHover: boolean,
): void {
  device.canHover = canHover;
  for (const listener of device.listeners) {
    listener();
  }
}
