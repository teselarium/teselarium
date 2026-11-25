/** Stands for `matchMedia("(prefers-color-scheme: dark)")`: the test changes the system preference. */
export interface FakeColorSchemeQuery {
  matches: boolean;
  listeners: Set<() => void>;
  addEventListener: (type: "change", listener: () => void) => void;
}

function addQueryListener(
  listeners: Set<() => void>,
  _type: "change",
  listener: () => void,
): void {
  listeners.add(listener);
}

export function createFakeColorSchemeQuery(
  systemPrefersDark: boolean,
): FakeColorSchemeQuery {
  const listeners = new Set<() => void>();
  const fakeQuery: FakeColorSchemeQuery = {
    matches: systemPrefersDark,
    listeners,
    addEventListener: addQueryListener.bind(undefined, listeners),
  };
  return fakeQuery;
}

/** The operating system's preference changes: `matches` changes, then `change` fires. */
export function changeSystemPreference(
  fakeQuery: FakeColorSchemeQuery,
  systemPrefersDark: boolean,
): void {
  fakeQuery.matches = systemPrefersDark;
  for (const listener of fakeQuery.listeners) {
    listener();
  }
}
