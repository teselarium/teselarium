/** Whether an effect's read is still wanted: its effect was not cleaned up. Mutable. */
export interface ReadTicket {
  isCurrent: boolean;
}

export function createReadTicket(): ReadTicket {
  const ticket: ReadTicket = { isCurrent: true };
  return ticket;
}

/** Keeps a read value, unless its effect was cleaned up meanwhile. */
export function keepIfCurrent<Value>(
  ticket: ReadTicket,
  keep: (value: Value) => void,
  value: Value,
): void {
  if (ticket.isCurrent) {
    keep(value);
  }
}

/** An effect's cleanup: later reads are dropped. */
export function cancelTicket(ticket: ReadTicket): void {
  ticket.isCurrent = false;
}
