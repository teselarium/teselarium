/** One entry of a fake browser history. */
export interface FakeHistoryEntry {
  state: unknown;
  hash: string;
}

/** What `popstate` gives the page: the address hash and the entry's state. */
export interface FakeNavigation {
  hash: string;
  state: unknown;
}

/**
 * A browser history in memory: `pushState` drops the forward entries as a
 * browser does, `replaceState` replaces the current entry, and `goBack`,
 * `goForward` and `followLink` move like the browser buttons and a typed
 * address, giving what `popstate` would give.
 */
export class FakeHistory {
  entries: FakeHistoryEntry[];
  index: number;

  constructor(hash: string = "") {
    this.entries = [{ state: null, hash }];
    this.index = 0;
  }

  get state(): unknown {
    return this.entries[this.index].state;
  }

  get hash(): string {
    return this.entries[this.index].hash;
  }

  pushState(state: unknown, _unused: string, url?: string | URL | null): void {
    this.entries = this.entries.slice(0, this.index + 1);
    this.entries.push({
      state: structuredClone(state),
      hash: readHash(url, this.hash),
    });
    this.index += 1;
  }

  replaceState(
    state: unknown,
    _unused: string,
    url?: string | URL | null,
  ): void {
    this.entries[this.index] = {
      state: structuredClone(state),
      hash: readHash(url, this.hash),
    };
  }

  goBack(): FakeNavigation {
    this.index -= 1;
    return this.readNavigation();
  }

  goForward(): FakeNavigation {
    this.index += 1;
    return this.readNavigation();
  }

  /** A link followed in the page or an address typed by the user: a new entry with no state. */
  followLink(hash: string): FakeNavigation {
    this.pushState(null, "", hash);
    return this.readNavigation();
  }

  readNavigation(): FakeNavigation {
    const navigation: FakeNavigation = { hash: this.hash, state: this.state };
    return navigation;
  }
}

function readHash(
  url: string | URL | null | undefined,
  currentHash: string,
): string {
  if (url === undefined || url === null) {
    return currentHash;
  }
  return String(url);
}
