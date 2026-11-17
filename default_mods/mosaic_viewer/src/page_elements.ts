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

export function buildButton(
  label: string,
  handleClick: (event: MouseEvent) => void,
): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.addEventListener("click", handleClick);
  return button;
}

export function buildCell(
  tagName: "td" | "th",
  content: string | Node,
): HTMLElement {
  const cell = document.createElement(tagName);
  cell.append(content);
  return cell;
}

/** A titled part of the page: a `<section>` named by its `<h2>`. */
export function buildTitledSection(title: string): HTMLElement {
  const section = document.createElement("section");
  section.setAttribute("aria-label", title);
  const heading = document.createElement("h2");
  heading.textContent = title;
  section.append(heading);
  return section;
}

/** Adds a term and its description to a `<dl>`. */
export function addDefinition(
  list: HTMLElement,
  term: string,
  description: string | Node,
): void {
  const termElement = document.createElement("dt");
  termElement.textContent = term;
  const descriptionElement = document.createElement("dd");
  descriptionElement.append(description);
  list.append(termElement, descriptionElement);
}

/** A file that cannot be inspected: its address and the error message, as an alert. */
export function buildFailureAlert(address: string, error: string): HTMLElement {
  const alert = document.createElement("div");
  alert.setAttribute("role", "alert");
  const addressCode = document.createElement("code");
  addressCode.textContent = address;
  const message = document.createElement("p");
  message.textContent = error;
  alert.append(addressCode, message);
  return alert;
}
