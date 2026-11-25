// The elements the viewer builds from semantic HTML, which the theme's base
// stylesheet draws like the app's components.

/** A notice: `role="status"` gives it the app's default alert look. */
export function buildStatusMessage(text: string): HTMLElement {
  const status = document.createElement("p");
  status.setAttribute("role", "status");
  status.textContent = text;
  return status;
}

/**
 * The region for the errors of opening another view. The theme draws a
 * non-empty `role="status"` as an alert box, so it stays empty until an error.
 */
export function buildErrorRegion(): HTMLElement {
  const region = document.createElement("p");
  region.setAttribute("role", "status");
  return region;
}
