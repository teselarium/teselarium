import { act, fireEvent, screen } from "@testing-library/react";

function focusElement(element: HTMLElement): void {
  element.focus();
}

/** Focuses `trigger`, as the keyboard does, and returns the text of the tooltip it opens. */
export async function readTooltipOnFocus(
  trigger: HTMLElement,
): Promise<string> {
  act(focusElement.bind(undefined, trigger));
  const tooltip = await screen.findByRole("tooltip");
  const text = tooltip.textContent ?? "";
  return text;
}

/** Rests a mouse pointer on `trigger` and returns the text of the tooltip it opens. */
export async function readTooltipOnHover(
  trigger: HTMLElement,
): Promise<string> {
  fireEvent.pointerMove(trigger, { pointerType: "mouse" });
  const tooltip = await screen.findByRole("tooltip");
  const text = tooltip.textContent ?? "";
  return text;
}
