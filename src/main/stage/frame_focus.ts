/**
 * The focus moving into a frame, which is how the stage bar knows the user
 * clicked in a mod's frame. Radix closes a popover or menu on a pointer-down
 * in the app's document, which a click in a frame never reaches, but the
 * click moves the focus to the frame, and the window loses it.
 */

/** A watch of the window's focus, with the check that runs once a blur has finished. */
interface FrameFocusWatch {
  onFrameFocus: () => void;
  timer: ReturnType<typeof setTimeout> | null;
}

export function isFocusInFrame(): boolean {
  return document.activeElement instanceof HTMLIFrameElement;
}

function checkFrameFocus(watch: FrameFocusWatch): void {
  watch.timer = null;
  if (isFocusInFrame()) {
    watch.onFrameFocus();
  }
}

/**
 * Checks the focus after the blur. When an element of the app had the focus,
 * Firefox fires the window's blur while the focus is still on the body, and
 * gives it to the frame afterwards.
 */
function scheduleFrameFocusCheck(watch: FrameFocusWatch): void {
  if (watch.timer !== null) {
    clearTimeout(watch.timer);
  }
  watch.timer = setTimeout(checkFrameFocus.bind(undefined, watch), 0);
}

function stopWatchingFrameFocus(
  watch: FrameFocusWatch,
  listener: () => void,
): void {
  window.removeEventListener("blur", listener);
  if (watch.timer !== null) {
    clearTimeout(watch.timer);
  }
}

/**
 * Calls `onFrameFocus` when the window loses the focus to a frame, and not
 * when it loses it to another window. Returns the function that stops it.
 */
export function listenForFrameFocus(onFrameFocus: () => void): () => void {
  const watch: FrameFocusWatch = { onFrameFocus, timer: null };
  const listener = scheduleFrameFocusCheck.bind(undefined, watch);
  window.addEventListener("blur", listener);
  return stopWatchingFrameFocus.bind(undefined, watch, listener);
}

/**
 * For a popover's or menu's `onCloseAutoFocus`: when it closed because the
 * user clicked in a frame, the focus stays in the frame instead of going back
 * to the button that opened it, so the mod keeps the keyboard.
 */
export function keepFocusInFrame(event: Event): void {
  if (isFocusInFrame()) {
    event.preventDefault();
  }
}
