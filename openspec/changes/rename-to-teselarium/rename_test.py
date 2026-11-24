"""Tests of the rename rules (design D2). Run from this folder:

    python3 -I -m unittest discover -s . -p '*_test.py'
"""

import unittest

import rename


class RenameTextTest(unittest.TestCase):
    def assert_renamed(self, source: str, expected: str) -> None:
        self.assertEqual(rename.rename_text(source), expected)

    def assert_unchanged(self, source: str) -> None:
        self.assertEqual(rename.rename_text(source), source)

    # Rule 1: the article changes with the name.
    def test_article_an_before_name_becomes_a(self) -> None:
        self.assert_renamed("an OpenTesela mod", "a Teselarium mod")

    def test_capital_article_before_name_becomes_a(self) -> None:
        self.assert_renamed("An OpenTesela mod", "A Teselarium mod")

    def test_article_before_lowercase_name_becomes_a(self) -> None:
        self.assert_renamed("an opentesela key", "a teselarium key")

    def test_article_inside_a_word_is_kept(self) -> None:
        self.assert_renamed("plan OpenTesela", "plan Teselarium")

    # Rule 2 to 4: the name in its three spellings.
    def test_pascal_name(self) -> None:
        self.assert_renamed("OpenTesela is a tool", "Teselarium is a tool")

    def test_camel_name(self) -> None:
        self.assert_renamed("openTeselaYamlCodeRan", "teselariumYamlCodeRan")

    def test_lower_name(self) -> None:
        self.assert_renamed("opentesela.theme-choice", "teselarium.theme-choice")

    def test_browser_scheme(self) -> None:
        self.assert_renamed("opentesela-browser:", "teselarium-browser:")

    def test_icon_name(self) -> None:
        self.assert_renamed("lucide-opentesela-mosaic", "lucide-teselarium-mosaic")

    def test_spec_file_name(self) -> None:
        self.assert_renamed("docs/opentesela_spec.md", "docs/teselarium_spec.md")

    # Rule 5: uppercase tag names.
    def test_uppercase_tag_name(self) -> None:
        self.assert_renamed("OT-TILE-BODY", "TES-TILE-BODY")

    # Rule 6: the short prefix.
    def test_css_variable(self) -> None:
        self.assert_renamed("var(--ot-surface)", "var(--tes-surface)")

    def test_data_attribute(self) -> None:
        self.assert_renamed("[data-ot-variant]", "[data-tes-variant]")

    def test_class_name(self) -> None:
        self.assert_renamed('class="ot-card"', 'class="tes-card"')

    def test_prefix_before_backtick(self) -> None:
        self.assert_renamed("the `--ot-` prefix", "the `--tes-` prefix")

    def test_prefix_at_line_start(self) -> None:
        self.assert_renamed("ot-tile-body", "tes-tile-body")

    # Rule 7: the camel form of an attribute.
    def test_dataset_camel_form(self) -> None:
        self.assert_renamed("dataset.otVariant", "dataset.tesVariant")

    # Rule 8: stale links.
    def test_stale_spec_link(self) -> None:
        self.assert_renamed("see tesela_spec.md", "see teselarium_spec.md")

    # Rule 9: the property form of an attribute (hast, React).
    def test_property_camel_form(self) -> None:
        self.assert_renamed("dataOtAlert: kind", "dataTesAlert: kind")

    def test_data_other_is_kept(self) -> None:
        self.assert_unchanged("dataOther dataOtherValue")

    # Guards: words that contain `ot` must not change.
    def test_testid_is_kept(self) -> None:
        self.assert_unchanged("data-testid")

    def test_slot_is_kept(self) -> None:
        self.assert_unchanged("slot-name")

    def test_not_is_kept(self) -> None:
        self.assert_unchanged("not-found")

    def test_latest_is_kept(self) -> None:
        self.assert_unchanged("latest-version")

    def test_other_api_range_is_kept(self) -> None:
        self.assert_unchanged("OTHER_API_RANGE")

    def test_otherwise_is_kept(self) -> None:
        self.assert_unchanged("OTHERWISE")

    def test_other_is_kept(self) -> None:
        self.assert_unchanged("other")

    def test_other_camel_is_kept(self) -> None:
        self.assert_unchanged("otherValue")

    def test_underscore_prefixed_ot_is_kept(self) -> None:
        self.assert_unchanged("my_ot-thing")

    def test_rename_is_idempotent(self) -> None:
        once = rename.rename_text("an OpenTesela --ot-x dataset.otY")
        self.assertEqual(rename.rename_text(once), once)


class FileSelectionTest(unittest.TestCase):
    def test_history_is_excluded(self) -> None:
        for path in [
            "openspec/changes/archive/2026-01-01-x/proposal.md",
            "openspec/discarded-changes/x/design.md",
            "openspec/changes/rename-to-teselarium/tasks.md",
            ".changeset/some-change.md",
            "CHANGELOG.md",
            "e2e/npm_files/leaflet.js",
            "package-lock.json",
        ]:
            self.assertFalse(rename.is_included(path), path)

    def test_live_files_are_included(self) -> None:
        for path in [
            "src/main/App.tsx",
            "docs/code_conventions.md",
            "openspec/specs/theme/spec.md",
            "openspec/changes/other-change/proposal.md",
            "package.json",
        ]:
            self.assertTrue(rename.is_included(path), path)


class ExistingNameTest(unittest.TestCase):
    def test_finds_new_names_already_present(self) -> None:
        found = rename.find_new_names("a --tes-x and Teselarium")
        self.assertEqual(sorted(found), ["--tes-", "Teselarium"])

    def test_ignores_words_that_end_in_tes(self) -> None:
        self.assertEqual(rename.find_new_names("test-x latest-y notes-z"), [])


if __name__ == "__main__":
    unittest.main()
