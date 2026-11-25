import { LoaderCircle } from "lucide-react";
import type { ReactElement } from "react";

interface LoadingSpinnerProps {
  /** The spinner's accessible name, such as "Counting". Without one, it is hidden from assistive technologies, for a spinner next to its own text. */
  label?: string;
  /** Its size and color, such as `size-6`. */
  className?: string;
}

/**
 * The app's loading spinner: lucide's `LoaderCircle`, turning unless the
 * user's system asks for reduced motion.
 */
export function LoadingSpinner({
  label,
  className = "size-4",
}: LoadingSpinnerProps): ReactElement {
  const classes = `${className} shrink-0 motion-safe:animate-spin`;
  if (label === undefined) {
    return <LoaderCircle aria-hidden="true" className={classes} />;
  }
  return <LoaderCircle role="img" aria-label={label} className={classes} />;
}
