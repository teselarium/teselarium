/**
 * Tests of the sample mod, which `mods.check` runs after mounting it. Each
 * case runs in a fresh hidden frame with a throwaway storage slot, and
 * mounts the mod itself through its context.
 */

async function listsTheSampleBooks(context) {
  await context.mount();
  context.expect(context.root.querySelectorAll("li").length).toBe(3);
}

async function highlightsTheRememberedBook(context) {
  await context.storage.set("selected", context.tiles[1].source);
  await context.mount();
  const pressed = context.root.querySelector('button[aria-pressed="true"]');
  context.expect(pressed.textContent).toContain("Kallocain");
}

export default function registerBookListTests(t) {
  t.test("lists the sample books", listsTheSampleBooks);
  t.test("highlights the remembered book", highlightsTheRememberedBook);
}
