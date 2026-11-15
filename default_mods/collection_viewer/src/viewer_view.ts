import type { CollectionInspection, ModEngine } from "../../mod_api.d.ts";
import { describeError } from "./error_messages.ts";

/** The viewer's target: its inspection, or why it cannot be inspected. */
export type TargetReading =
  | { inspection: CollectionInspection; error: null }
  | { inspection: null; error: string };

/** Inspects the target collection. Its tiles are never requested. */
export async function inspectTarget(
  engine: ModEngine,
  target: string,
): Promise<TargetReading> {
  try {
    const inspection = await engine.request("collections.inspect", {
      collection: target,
    });
    const reading: TargetReading = { inspection, error: null };
    return reading;
  } catch (error) {
    const failedReading: TargetReading = {
      inspection: null,
      error: describeError(error),
    };
    return failedReading;
  }
}
