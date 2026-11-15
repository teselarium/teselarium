// The elements the viewer builds from semantic HTML, which the theme's base
// stylesheet draws like the app's components.

/** An error: `role="alert"` gives it the app's destructive alert look. */
export function buildErrorAlert(text: string): HTMLElement {
  const alert = document.createElement("p");
  alert.setAttribute("role", "alert");
  alert.textContent = text;
  return alert;
}

/** A notice: `role="status"` gives it the app's default alert look. */
export function buildStatusMessage(text: string): HTMLElement {
  const status = document.createElement("p");
  status.setAttribute("role", "status");
  status.textContent = text;
  return status;
}

/** A badge: a `<span>` with `data-ot-variant`. */
export function buildBadge(text: string, variant: string): HTMLElement {
  const badge = document.createElement("span");
  badge.dataset.otVariant = variant;
  badge.textContent = text;
  return badge;
}
