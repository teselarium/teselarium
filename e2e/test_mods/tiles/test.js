/**
 * Tests of the tiles mod, which `mods.check` runs after mounting it. Each case
 * runs in a fresh hidden frame with a throwaway storage slot.
 */

async function listsTheTiles(context) {
  await context.mount();
  context.expect(context.root.querySelectorAll("li").length).toBe(3);
}

async function hidesTheImagesWhenTheyAreOff(context) {
  await context.mount({ config: { show_images: false } });
  context.expect(context.root.querySelectorAll("li").length).toBe(3);
  context.expect(context.root.querySelectorAll("img").length).toBe(0);
}

export default function registerTilesTests(t) {
  t.test("lists the tiles", listsTheTiles);
  t.test("hides the images when they are off", hidesTheImagesWhenTheyAreOff);
}
