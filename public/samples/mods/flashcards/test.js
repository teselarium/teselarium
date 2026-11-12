/**
 * Tests of the sample flashcards mod, which `mods.check` runs after mounting
 * it. Each case runs in a fresh hidden frame with a throwaway storage slot,
 * and mounts the mod itself through its context.
 *
 * `tiles.renderBody` renders only the tiles of the check's collection, so
 * the cases that need other metadata keep a sample tile's source and body,
 * and the tiles with a source of their own have no body.
 *
 * Where the focus goes is tested in e2e/sample_flashcards.spec.ts: some
 * browsers do not move the focus in a check's hidden frames. A case cannot
 * reload the tiles either, so "Reload tiles" is tested there too.
 */

const SAMPLE_NAMES = [
  "Emphasis",
  "Links",
  "Task lists",
  "Tables",
  "Code blocks",
  "Math",
  "Diagrams",
  "Alerts",
];

const STUDY_FIELDS_KEY = "study_fields";

/** A tile without a title, a heading or a body. */
const NOTES_TILE = {
  source: "https://example.org/cards/notes_03.md",
  metadata: {},
  body: "",
};

function findSampleTile(context, fileName) {
  for (const tile of context.tiles) {
    if (tile.source.endsWith(`/${fileName}`)) {
      return tile;
    }
  }
  throw new Error(`The sample collection has no tile ${fileName}`);
}

/** A sample tile, with its source and body, and other metadata. */
function withMetadata(context, fileName, metadata) {
  const tile = { ...findSampleTile(context, fileName), metadata };
  return tile;
}

/** The sample tiles, each with its metadata changed by `changeMetadata`. */
function mapSampleMetadata(context, changeMetadata) {
  const tiles = [];
  for (const tile of context.tiles) {
    tiles.push({ ...tile, metadata: changeMetadata(tile.metadata) });
  }
  return tiles;
}

function keepOnlyTitle(metadata) {
  const titleOnly = { title: metadata.title };
  return titleOnly;
}

function leaveOutAnswer(metadata) {
  const withoutAnswer = { title: metadata.title, question: metadata.question };
  return withoutAnswer;
}

function addBlankHint(metadata) {
  const withHint = { ...metadata, hint: " " };
  return withHint;
}

function readTexts(elements) {
  const texts = [];
  for (const element of elements) {
    texts.push(element.textContent);
  }
  return texts;
}

function queryButton(context, text) {
  for (const button of context.root.querySelectorAll("button")) {
    if (button.textContent.trim() === text) {
      return button;
    }
  }
  return null;
}

function findButton(context, text) {
  const button = queryButton(context, text);
  if (button === null) {
    throw new Error(`The mod shows no button "${text}"`);
  }
  return button;
}

function findRowButton(context, name) {
  for (const button of context.root.querySelectorAll("td > button")) {
    if (button.getAttribute("aria-label").startsWith(`${name}, `)) {
      return button;
    }
  }
  throw new Error(`No row button is named "${name}"`);
}

function readRowNames(context) {
  const names = readTexts(context.root.querySelectorAll("td > button"));
  return names;
}

function readFileCells(context) {
  const files = readTexts(context.root.querySelectorAll("td:nth-child(2)"));
  return files;
}

function findTileCard(context) {
  const card = context.root.querySelector(
    'dialog[aria-labelledby="tile-card-title"]',
  );
  return card;
}

function findSetup(context) {
  const setup = context.root.querySelector(
    'dialog[aria-labelledby="study-setup-title"]',
  );
  return setup;
}

function countOpenDialogs(context) {
  return context.root.querySelectorAll("dialog[open]").length;
}

function findSetupSelect(context, name) {
  const select = findSetup(context).querySelector(`select[name="${name}"]`);
  return select;
}

function readOptionTexts(select) {
  const texts = readTexts(select.options);
  return texts;
}

function readSelectedText(select) {
  return select.options[select.selectedIndex].textContent;
}

function chooseOption(select, value) {
  select.value = value;
  select.dispatchEvent(new Event("change"));
}

function readCount(context) {
  return findSetup(context).querySelector("output").textContent;
}

function findStartButton(context) {
  const startButton = findSetup(context).querySelector(
    'button[data-action="start"]',
  );
  return startButton;
}

function pressStudy(context) {
  findButton(context, "Study").click();
  const setup = findSetup(context);
  return setup;
}

/** Presses Start, and waits for the session: the mod stores the fields first. */
async function pressStart(context) {
  findStartButton(context).click();
  await context.waitFor(isSetupClosed.bind(undefined, context));
}

async function mountAndStudy(context, options) {
  await context.mount(options);
  const setup = pressStudy(context);
  return setup;
}

/** Mounts the mod, presses Study, and starts with the shown fields, or the given question. */
async function startStudying(context, options, question) {
  await mountAndStudy(context, options);
  if (question !== undefined) {
    chooseOption(findSetupSelect(context, "question"), question);
  }
  await pressStart(context);
}

function readPosition(context) {
  const position = context.root.querySelector("article > header > p");
  if (position === null) {
    return null;
  }
  return position.textContent;
}

function findSide(context, sideName) {
  const side = context.root.querySelector(`[data-side="${sideName}"]`);
  return side;
}

function readQuestionText(context) {
  return findSide(context, "question").textContent;
}

/** The visible top-level children of the study card's rendered body. */
function listShownBodyParts(context) {
  const body = context.root.querySelector("article ot-tile-body");
  const shown = [];
  for (const child of body.children) {
    if (!child.hidden) {
      shown.push(child);
    }
  }
  return shown;
}

function readShownBodyText(context) {
  const texts = readTexts(listShownBodyParts(context));
  return texts.join("\n");
}

/** True once the study card's First heading body is drawn: only its heading is shown. */
function showsOnlyTheHeading(context) {
  const shown = listShownBodyParts(context);
  return shown.length === 1 && /^H[1-6]$/.test(shown[0].tagName);
}

function isTileCardOpen(context) {
  return findTileCard(context).open;
}

function isSetupClosed(context) {
  return !findSetup(context).open;
}

function hasNoOpenDialog(context) {
  return countOpenDialogs(context) === 0;
}

/** Goes through the session, pressing "Show answer" then "Next" on each card, and gives each card's position and question. */
function goThroughDeck(context, cardLimit) {
  const shownCards = [];
  for (let step = 0; step < cardLimit; step += 1) {
    if (queryButton(context, "Show answer") === null) {
      break;
    }
    shownCards.push({
      position: readPosition(context),
      question: readQuestionText(context),
    });
    findButton(context, "Show answer").click();
    findButton(context, "Next").click();
  }
  return shownCards;
}

function stepToThirdCard(context) {
  for (let step = 0; step < 2; step += 1) {
    findButton(context, "Show answer").click();
    findButton(context, "Next").click();
  }
}

// Which tiles are cards, and field values --------------------------------------

async function leavesOutATileWithoutTheAnswerKey(context) {
  const tiles = [
    findSampleTile(context, "emphasis.md"),
    withMetadata(
      context,
      "links.md",
      leaveOutAnswer(findSampleTile(context, "links.md").metadata),
    ),
    findSampleTile(context, "tables.md"),
  ];
  await mountAndStudy(context, { tiles });
  context.expect(readCount(context)).toBe("2 of 3 tiles have these fields.");
  await pressStart(context);

  const shownCards = goThroughDeck(context, 5);

  context.expect(shownCards.length).toBe(2);
  for (const shownCard of shownCards) {
    context.expect(shownCard.question).not.toBe(tiles[1].metadata.question);
  }
}

async function leavesOutABlankQuestion(context) {
  const tiles = [
    findSampleTile(context, "emphasis.md"),
    withMetadata(context, "links.md", { question: "  ", answer: "x" }),
  ];
  await mountAndStudy(context, { tiles });

  context.expect(readCount(context)).toBe("1 of 2 tiles have these fields.");
}

async function leavesOutAMappingAnswer(context) {
  const tiles = [
    findSampleTile(context, "emphasis.md"),
    withMetadata(context, "links.md", {
      question: "What is it?",
      answer: { text: "x" },
    }),
  ];
  await mountAndStudy(context, { tiles });

  context.expect(readCount(context)).toBe("1 of 2 tiles have these fields.");
}

async function showsAFieldAsWritten(context) {
  await startStudying(context, {
    tiles: [findSampleTile(context, "emphasis.md")],
  });

  findButton(context, "Show answer").click();

  const answer = findSide(context, "answer");
  context.expect(answer.textContent).toContain("~~text~~");
  context.expect(answer.querySelector("del")).toBe(null);
}

async function joinsAListAndWritesANumber(context) {
  const tiles = [
    withMetadata(context, "links.md", {
      question: ["Name", "two", "markups"],
      answer: 1953,
    }),
  ];
  await startStudying(context, { tiles });

  findButton(context, "Show answer").click();

  context.expect(readQuestionText(context)).toBe("Name, two, markups");
  context.expect(findSide(context, "answer").textContent).toBe("1953");
}

// The heading and its section ---------------------------------------------------

async function stopsTheSectionAtAHeadingOfTheSameLevel(context) {
  await startStudying(
    context,
    { tiles: [findSampleTile(context, "tables.md")] },
    "first-heading",
  );
  await context.waitFor(showsOnlyTheHeading.bind(undefined, context));

  findButton(context, "Show answer").click();

  const shownText = readShownBodyText(context);
  context.expect(shownText).toContain("Alignment");
  context.expect(shownText).not.toContain("See also");
  const shownTags = [];
  for (const part of listShownBodyParts(context)) {
    shownTags.push(part.tagName);
  }
  context.expect(shownTags).toContain("TABLE");
  context.expect(shownTags).toContain("H3");
}

async function hidesTheTextBeforeTheHeading(context) {
  await startStudying(
    context,
    { tiles: [findSampleTile(context, "diagrams.md")] },
    "first-heading",
  );
  await context.waitFor(showsOnlyTheHeading.bind(undefined, context));
  context.expect(readShownBodyText(context)).not.toContain("This note");

  findButton(context, "Show answer").click();

  context.expect(readShownBodyText(context)).not.toContain("This note");
  context.expect(readShownBodyText(context)).toContain("is drawn as a diagram");
}

async function ignoresAHeadingInsideAnAlert(context) {
  await startStudying(
    context,
    { tiles: [findSampleTile(context, "alerts.md")] },
    "first-heading",
  );
  await context.waitFor(showsOnlyTheHeading.bind(undefined, context));

  findButton(context, "Show answer").click();

  const shownText = readShownBodyText(context);
  context.expect(shownText).toContain("Study often");
  context.expect(shownText).toContain("they belong to the alert");
}

// Explore -----------------------------------------------------------------------

async function listsTheSampleTiles(context) {
  await context.mount();

  context.expect(readRowNames(context)).toEqual(SAMPLE_NAMES);
  const files = readFileCells(context);
  context.expect(files.length).toBe(8);
  context.expect(files[0]).toBe("emphasis.md");
  context.expect(files[7]).toBe("alerts.md");
  context
    .expect(findRowButton(context, "Tables").getAttribute("aria-label"))
    .toBe("Tables, tables.md");
  context.expect(findButton(context, "Explore").ariaPressed).toBe("true");
  context.expect(findButton(context, "Study").ariaPressed).toBe("false");
}

async function switchesToStudy(context) {
  await context.mount();

  findButton(context, "Study").click();

  context.expect(findButton(context, "Study").ariaPressed).toBe("true");
  context.expect(findButton(context, "Explore").ariaPressed).toBe("false");
  context.expect(context.root.querySelector("table")).toBe(null);
}

async function namesATileByItsFirstHeading(context) {
  const tiles = [withMetadata(context, "math.md", { question: "?" })];
  await context.mount({ tiles });

  context.expect(readRowNames(context)[0]).toContain("Formulas such as");
  context.expect(readRowNames(context)[0]).not.toContain("a^2");
}

async function namesATileByItsHeadingWhenTheTitleIsNotAString(context) {
  const tiles = [withMetadata(context, "math.md", { title: 1984 })];
  await context.mount({ tiles });

  context.expect(readRowNames(context)[0]).toContain("Formulas such as");
}

async function showsNoTitle(context) {
  await context.mount({ tiles: [NOTES_TILE] });

  const button = context.root.querySelector("td > button");
  context
    .expect(button.querySelector("span[data-untitled]").textContent)
    .toBe("No title");
  context.expect(button.getAttribute("aria-label")).toContain("No title");
  context.expect(button.getAttribute("aria-label")).toContain("notes_03.md");
}

async function decodesTheFileName(context) {
  const tile = {
    source: "https://example.org/cards/my%20notes.md",
    metadata: { title: "My notes" },
    body: "",
  };
  await context.mount({ tiles: [tile] });

  context.expect(readFileCells(context)).toEqual(["my notes.md"]);
}

async function saysWhenThereAreNoTiles(context) {
  await context.mount({ tiles: [] });

  context
    .expect(context.root.querySelector('[role="status"]').textContent)
    .toBe("There are no tiles to show.");
  context.expect(queryButton(context, "Explore")).toBe(null);
  context.expect(queryButton(context, "Study")).toBe(null);
  context.expect(context.root.querySelector("table")).toBe(null);
  context.expect(countOpenDialogs(context)).toBe(0);
}

// Tile card -------------------------------------------------------------------

async function showsTheMetadataOfTables(context) {
  await context.mount();

  findRowButton(context, "Tables").click();

  const card = findTileCard(context);
  context.expect(card.open).toBe(true);
  context.expect(card.querySelector("h2").textContent).toBe("Tables");
  context
    .expect(readTexts(card.querySelectorAll("dt")))
    .toEqual(["title", "question", "answer"]);
  context
    .expect(readTexts(card.querySelectorAll("dd")))
    .toEqual([
      "Tables",
      "Which character separates the cells of a table?",
      "The pipe, |",
    ]);
  context.expect(card.querySelector("ot-tile-body")).not.toBe(null);
}

async function writesAListAndAMapping(context) {
  const tile = {
    source: "https://example.org/cards/tagged.md",
    metadata: {
      title: "Tagged",
      tags: ["md", "gfm"],
      source_info: { page: 3 },
    },
    body: "",
  };
  await context.mount({ tiles: [tile] });

  findRowButton(context, "Tagged").click();

  const card = findTileCard(context);
  context
    .expect(readTexts(card.querySelectorAll("dd")))
    .toEqual(["Tagged", "md, gfm", '{"page":3}']);
}

async function namesTheCardOfAnUnnamedTileByItsFile(context) {
  await context.mount({ tiles: [NOTES_TILE] });

  context.root.querySelector("td > button").click();

  context
    .expect(findTileCard(context).querySelector("h2").textContent)
    .toBe("notes_03.md");
}

async function opensTheCardFromTheFileCell(context) {
  await context.mount();
  const tablesButton = findRowButton(context, "Tables");

  tablesButton.closest("tr").querySelector("td:nth-child(2)").click();

  context.expect(isTileCardOpen(context)).toBe(true);
  const states = [];
  for (const button of context.root.querySelectorAll("td > button")) {
    states.push(button.getAttribute("aria-expanded"));
  }
  context
    .expect(states)
    .toEqual([
      "false",
      "false",
      "false",
      "true",
      "false",
      "false",
      "false",
      "false",
    ]);
}

function isCollapsed(button) {
  return button.getAttribute("aria-expanded") === "false";
}

async function unmarksTheRowWhenItsCardCloses(context) {
  await context.mount();
  const tablesButton = findRowButton(context, "Tables");
  tablesButton.click();

  findTileCard(context).querySelector('button[aria-label="Close"]').click();

  context.expect(isTileCardOpen(context)).toBe(false);
  await context.waitFor(isCollapsed.bind(undefined, tablesButton));
}

// Study setup -------------------------------------------------------------------

async function opensTheSetupOnStudy(context) {
  const setup = await mountAndStudy(context);

  context.expect(setup.open).toBe(true);
  context.expect(setup.querySelector("h2").textContent).toBe("Study setup");
  context.expect(findSetupSelect(context, "question")).not.toBe(null);
  context.expect(findSetupSelect(context, "answer")).not.toBe(null);
  context.expect(findStartButton(context).textContent).toBe("Start");
}

async function saysNoSessionAfterClosingTheSetup(context) {
  const setup = await mountAndStudy(context);

  setup.close();

  await context.waitFor(hasNoOpenDialog.bind(undefined, context));
  context
    .expect(context.root.querySelector("main").textContent)
    .toContain("No study session.");
  findButton(context, "New session").click();
  context.expect(setup.open).toBe(true);
}

async function offersTheKeysOfTheSampleDeck(context) {
  await mountAndStudy(context);

  context
    .expect(readOptionTexts(findSetupSelect(context, "question")))
    .toEqual(["First heading", "title", "question", "answer"]);
  context
    .expect(readOptionTexts(findSetupSelect(context, "answer")))
    .toEqual(["Body", "title", "question", "answer"]);
}

async function locksTheAnswerUnderFirstHeading(context) {
  await mountAndStudy(context);

  chooseOption(findSetupSelect(context, "question"), "first-heading");

  const answer = findSetupSelect(context, "answer");
  context.expect(answer.disabled).toBe(true);
  context.expect(readSelectedText(answer)).toBe("Section under the heading");
  context.expect(readCount(context)).toBe("8 of 8 tiles have these fields.");
}

async function defaultsToTheQuestionAndAnswerKeys(context) {
  await mountAndStudy(context);

  context
    .expect(findSetupSelect(context, "question").value)
    .toBe("key:question");
  context.expect(findSetupSelect(context, "answer").value).toBe("key:answer");
  context.expect(readCount(context)).toBe("8 of 8 tiles have these fields.");
  context.expect(findStartButton(context).disabled).toBe(false);
}

async function defaultsToFirstHeadingWithoutTheKeys(context) {
  await mountAndStudy(context, {
    tiles: mapSampleMetadata(context, keepOnlyTitle),
  });

  context
    .expect(readSelectedText(findSetupSelect(context, "question")))
    .toBe("First heading");
  context
    .expect(readSelectedText(findSetupSelect(context, "answer")))
    .toBe("Section under the heading");
}

async function defaultsToBodyWithoutTheAnswerKey(context) {
  await mountAndStudy(context, {
    tiles: mapSampleMetadata(context, leaveOutAnswer),
  });

  context
    .expect(findSetupSelect(context, "question").value)
    .toBe("key:question");
  context
    .expect(readSelectedText(findSetupSelect(context, "answer")))
    .toBe("Body");
}

async function disablesStartWithoutCards(context) {
  await mountAndStudy(context, {
    tiles: mapSampleMetadata(context, addBlankHint),
  });

  chooseOption(findSetupSelect(context, "question"), "key:hint");

  context.expect(readCount(context)).toBe("0 of 8 tiles have these fields.");
  context.expect(findStartButton(context).disabled).toBe(true);
}

async function remembersTheChosenFields(context) {
  await context.storage.set(STUDY_FIELDS_KEY, {
    question: "key:title",
    answer: "body",
  });

  await mountAndStudy(context);

  context.expect(findSetupSelect(context, "question").value).toBe("key:title");
  context.expect(findSetupSelect(context, "answer").value).toBe("body");
}

async function storesTheFieldsAtStart(context) {
  await mountAndStudy(context);
  chooseOption(findSetupSelect(context, "question"), "key:title");
  chooseOption(findSetupSelect(context, "answer"), "body");

  await pressStart(context);

  const stored = await context.waitFor(
    context.storage.get.bind(undefined, STUDY_FIELDS_KEY),
  );
  context.expect(stored).toEqual({ question: "key:title", answer: "body" });
}

async function ignoresAStoredKeyNoLongerOffered(context) {
  await context.storage.set(STUDY_FIELDS_KEY, {
    question: "key:term",
    answer: "key:title",
  });

  await mountAndStudy(context);

  context
    .expect(findSetupSelect(context, "question").value)
    .toBe("key:question");
  context.expect(findSetupSelect(context, "answer").value).toBe("key:title");
}

// Study session -------------------------------------------------------------------

async function showsTheFirstCard(context) {
  await startStudying(context);

  context.expect(isSetupClosed(context)).toBe(true);
  context.expect(readPosition(context)).toBe("Card 1 of 8");
  const questions = [];
  for (const tile of context.tiles) {
    questions.push(tile.metadata.question);
  }
  context.expect(questions).toContain(readQuestionText(context));
  context.expect(queryButton(context, "Show answer")).not.toBe(null);
  context.expect(findSide(context, "answer")).toBe(null);
  context.expect(queryButton(context, "Open full tile")).toBe(null);
  context.expect(queryButton(context, "Restart")).not.toBe(null);
}

async function showsTheAnswer(context) {
  await startStudying(context);

  findButton(context, "Show answer").click();

  context.expect(findSide(context, "question")).not.toBe(null);
  context.expect(findSide(context, "answer")).not.toBe(null);
  context.expect(queryButton(context, "Show answer")).toBe(null);
  context.expect(queryButton(context, "Next")).not.toBe(null);
  context.expect(queryButton(context, "Open full tile")).not.toBe(null);
}

async function showsEachCardOnce(context) {
  await startStudying(context);

  const shownCards = goThroughDeck(context, 10);

  const positions = [];
  const questions = [];
  for (const shownCard of shownCards) {
    positions.push(shownCard.position);
    questions.push(shownCard.question);
  }
  context
    .expect(positions)
    .toEqual([
      "Card 1 of 8",
      "Card 2 of 8",
      "Card 3 of 8",
      "Card 4 of 8",
      "Card 5 of 8",
      "Card 6 of 8",
      "Card 7 of 8",
      "Card 8 of 8",
    ]);
  for (const tile of context.tiles) {
    context.expect(questions).toContain(tile.metadata.question);
  }
}

async function opensTheFullTileFromTheAnswer(context) {
  await startStudying(context, {
    tiles: [findSampleTile(context, "tables.md")],
  });
  findButton(context, "Show answer").click();
  const fullTileButton = findButton(context, "Open full tile");

  fullTileButton.click();

  const card = findTileCard(context);
  context.expect(card.open).toBe(true);
  context.expect(card.querySelector("h2").textContent).toBe("Tables");
  card.close();

  context.expect(isTileCardOpen(context)).toBe(false);
  context.expect(readPosition(context)).toBe("Card 1 of 1");
  context.expect(findSide(context, "answer")).not.toBe(null);
}

async function restartsWithOtherFields(context) {
  await startStudying(context);
  stepToThirdCard(context);
  context.expect(readPosition(context)).toBe("Card 3 of 8");

  findButton(context, "Restart").click();
  chooseOption(findSetupSelect(context, "question"), "first-heading");
  await pressStart(context);

  context.expect(readPosition(context)).toBe("Card 1 of 8");
  await context.waitFor(showsOnlyTheHeading.bind(undefined, context));
}

async function keepsTheSessionWhenTheRestartIsCancelled(context) {
  await startStudying(context);
  stepToThirdCard(context);
  const question = readQuestionText(context);

  findButton(context, "Restart").click();
  context
    .expect(findSetupSelect(context, "question").value)
    .toBe("key:question");
  findSetup(context).close();

  await context.waitFor(isSetupClosed.bind(undefined, context));
  context.expect(readPosition(context)).toBe("Card 3 of 8");
  context.expect(readQuestionText(context)).toBe(question);
}

async function endsAfterTheLastCard(context) {
  await startStudying(context);

  goThroughDeck(context, 10);

  const main = context.root.querySelector("main");
  context.expect(main.textContent).toContain("You studied all 8 cards.");
  context.expect(context.root.querySelector("article")).toBe(null);
  findButton(context, "Start again").click();
  context.expect(findSetup(context).open).toBe(true);
}

async function pausesTheSessionInExplore(context) {
  await startStudying(context);
  stepToThirdCard(context);
  findButton(context, "Show answer").click();
  const question = readQuestionText(context);

  findButton(context, "Explore").click();
  context.expect(context.root.querySelector("table")).not.toBe(null);
  findButton(context, "Study").click();

  context.expect(readPosition(context)).toBe("Card 3 of 8");
  context.expect(readQuestionText(context)).toBe(question);
  context.expect(findSide(context, "answer")).not.toBe(null);
  context.expect(countOpenDialogs(context)).toBe(0);
}

export default function registerFlashcardsTests(t) {
  t.test(
    "leaves out a tile without the answer key",
    leavesOutATileWithoutTheAnswerKey,
  );
  t.test("leaves out a blank question", leavesOutABlankQuestion);
  t.test("leaves out a mapping answer", leavesOutAMappingAnswer);
  t.test("shows a field as written", showsAFieldAsWritten);
  t.test("joins a list and writes a number", joinsAListAndWritesANumber);
  t.test(
    "stops the section at a heading of the same level",
    stopsTheSectionAtAHeadingOfTheSameLevel,
  );
  t.test("hides the text before the heading", hidesTheTextBeforeTheHeading);
  t.test("ignores a heading inside an alert", ignoresAHeadingInsideAnAlert);
  t.test("lists the sample tiles", listsTheSampleTiles);
  t.test("switches to Study", switchesToStudy);
  t.test("names a tile by its first heading", namesATileByItsFirstHeading);
  t.test(
    "names a tile by its heading when the title is not a string",
    namesATileByItsHeadingWhenTheTitleIsNotAString,
  );
  t.test("shows No title", showsNoTitle);
  t.test("decodes the file name", decodesTheFileName);
  t.test("says when there are no tiles", saysWhenThereAreNoTiles);
  t.test("shows the metadata of Tables", showsTheMetadataOfTables);
  t.test("writes a list and a mapping", writesAListAndAMapping);
  t.test(
    "names the card of an unnamed tile by its file",
    namesTheCardOfAnUnnamedTileByItsFile,
  );
  t.test("opens the card from the file cell", opensTheCardFromTheFileCell);
  t.test(
    "unmarks the row when its card closes",
    unmarksTheRowWhenItsCardCloses,
  );
  t.test("opens the setup on Study", opensTheSetupOnStudy);
  t.test(
    "says no session after closing the setup",
    saysNoSessionAfterClosingTheSetup,
  );
  t.test("offers the keys of the sample deck", offersTheKeysOfTheSampleDeck);
  t.test(
    "locks the answer under First heading",
    locksTheAnswerUnderFirstHeading,
  );
  t.test(
    "defaults to the question and answer keys",
    defaultsToTheQuestionAndAnswerKeys,
  );
  t.test(
    "defaults to First heading without the keys",
    defaultsToFirstHeadingWithoutTheKeys,
  );
  t.test(
    "defaults to Body without the answer key",
    defaultsToBodyWithoutTheAnswerKey,
  );
  t.test("disables Start without cards", disablesStartWithoutCards);
  t.test("remembers the chosen fields", remembersTheChosenFields);
  t.test("stores the fields at Start", storesTheFieldsAtStart);
  t.test(
    "ignores a stored key no longer offered",
    ignoresAStoredKeyNoLongerOffered,
  );
  t.test("shows the first card", showsTheFirstCard);
  t.test("shows the answer", showsTheAnswer);
  t.test("shows each card once", showsEachCardOnce);
  t.test("opens the full tile from the answer", opensTheFullTileFromTheAnswer);
  t.test("restarts with other fields", restartsWithOtherFields);
  t.test(
    "keeps the session when the restart is cancelled",
    keepsTheSessionWhenTheRestartIsCancelled,
  );
  t.test("ends after the last card", endsAfterTheLastCard);
  t.test("pauses the session in Explore", pausesTheSessionInExplore);
}
