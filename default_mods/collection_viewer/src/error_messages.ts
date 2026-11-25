/** The message of an error a request rejected with, or the value as text. */
export function describeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
