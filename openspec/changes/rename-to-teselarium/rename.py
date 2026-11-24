"""Renames the project from OpenTesela to Teselarium (design D1 to D5).

Run from anywhere inside the repository:

    python3 -I rename.py            # dry run: prints the report, writes nothing
    python3 -I rename.py --apply    # writes the files and saves the list

The script is kept with the change only as the record of what ran.
"""

import json
import re
import subprocess
import sys
from collections import Counter
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Union

OLD_SPEC_PATH = "docs/opentesela_spec.md"
NEW_SPEC_PATH = "docs/teselarium_spec.md"
LOCKFILE_PATH = "package-lock.json"
CHANGED_FILES_LIST = Path(__file__).resolve().parent / "rename_changed_files.txt"

EXCLUDED_PREFIXES = [
    "openspec/changes/archive/",
    "openspec/discarded-changes/",
    "openspec/changes/rename-to-teselarium/",
    ".changeset/",
    "e2e/npm_files/",
]
EXCLUDED_FILES = ["CHANGELOG.md", LOCKFILE_PATH]

NAME_CHAR = "A-Za-z0-9_"
WORD_CHARS = "A-Za-z0-9_-"
TOKEN_CHAR = re.compile(rf"[{NAME_CHAR}.-]")

Replacement = Union[str, Callable[["re.Match[str]"], str]]


def replace_article_and_name(match: "re.Match[str]") -> str:
    article = "A" if match.group(1) == "An" else "a"
    name = "teselarium" if match.group(2) == "opentesela" else "Teselarium"
    result = f"{article} {name}"
    return result


@dataclass(frozen=True)
class Rule:
    label: str
    pattern: "re.Pattern[str]"
    replacement: Replacement


RULES = [
    Rule(
        "1 article",
        re.compile(r"\b(an|An) (OpenTesela|opentesela)"),
        replace_article_and_name,
    ),
    Rule("2 OpenTesela", re.compile(r"OpenTesela"), "Teselarium"),
    Rule("3 openTesela", re.compile(r"openTesela"), "teselarium"),
    Rule("4 opentesela", re.compile(r"opentesela"), "teselarium"),
    Rule("5 OT-", re.compile(rf"(?<![{NAME_CHAR}])OT-"), "TES-"),
    Rule("6 ot-", re.compile(rf"(?<![{NAME_CHAR}])ot-"), "tes-"),
    Rule("7 otCamel", re.compile(rf"(?<![{NAME_CHAR}])ot(?=[A-Z][a-z])"), "tes"),
    Rule(
        "8 tesela_spec.md",
        re.compile(r"(?<![A-Za-z])tesela_spec\.md"),
        "teselarium_spec.md",
    ),
    Rule("9 dataOtCamel", re.compile(r"(?<=data)Ot(?=[A-Z][a-z])"), "Tes"),
]

NEW_NAME_PATTERNS = {
    "tes-": re.compile(rf"(?<![{WORD_CHARS}])tes-"),
    "--tes-": re.compile(rf"(?<![{WORD_CHARS}])--tes-"),
    "data-tes-": re.compile(r"data-tes-"),
    "Teselarium": re.compile(r"Teselarium"),
    "teselarium": re.compile(r"teselarium"),
}


def rename_text(text: str) -> str:
    renamed = text
    for rule in RULES:
        renamed = rule.pattern.sub(rule.replacement, renamed)
    return renamed


def is_included(path: str) -> bool:
    if path in EXCLUDED_FILES:
        return False
    for prefix in EXCLUDED_PREFIXES:
        if path.startswith(prefix):
            return False
    return True


def find_new_names(text: str) -> list[str]:
    found = []
    for label, pattern in NEW_NAME_PATTERNS.items():
        if pattern.search(text):
            found.append(label)
    return found


def surrounding_token(text: str, start: int, end: int) -> str:
    left = start
    while left > 0 and TOKEN_CHAR.match(text[left - 1]):
        left -= 1
    right = end
    while right < len(text) and TOKEN_CHAR.match(text[right]):
        right += 1
    token = text[left:right]
    return token


def run_git(repo_root: Path, *args: str) -> str:
    completed = subprocess.run(
        ["git", *args], cwd=repo_root, capture_output=True, text=True, check=True
    )
    return completed.stdout


def find_repo_root() -> Path:
    output = subprocess.run(
        ["git", "rev-parse", "--show-toplevel"],
        cwd=Path(__file__).resolve().parent,
        capture_output=True,
        text=True,
        check=True,
    ).stdout
    root = Path(output.strip())
    return root


def list_tracked_files(repo_root: Path) -> list[str]:
    output = run_git(repo_root, "ls-files", "-z")
    paths = [path for path in output.split("\0") if path]
    return paths


def read_text_or_none(path: Path) -> Union[str, None]:
    if not path.is_file():
        return None
    try:
        text = path.read_bytes().decode("utf-8")
    except UnicodeDecodeError:
        return None
    return text


@dataclass
class Report:
    files_by_rule: dict[str, set[str]]
    tokens_by_rule: dict[str, Counter]
    changed: dict[str, str]
    skipped: list[str]


def collect_changes(repo_root: Path, paths: list[str]) -> Report:
    report = Report(
        files_by_rule={rule.label: set() for rule in RULES},
        tokens_by_rule={rule.label: Counter() for rule in RULES},
        changed={},
        skipped=[],
    )
    for path in paths:
        if not is_included(path):
            continue
        text = read_text_or_none(repo_root / path)
        if text is None:
            report.skipped.append(path)
            continue
        renamed = rename_with_report(path, text, report)
        if renamed != text:
            report.changed[path] = renamed
    return report


def rename_with_report(path: str, text: str, report: Report) -> str:
    current = text
    for rule in RULES:
        for match in rule.pattern.finditer(current):
            token = surrounding_token(current, match.start(), match.end())
            report.tokens_by_rule[rule.label][token] += 1
            report.files_by_rule[rule.label].add(path)
        current = rule.pattern.sub(rule.replacement, current)
    return current


def find_existing_new_names(repo_root: Path, paths: list[str]) -> list[str]:
    problems = []
    for path in paths:
        if not is_included(path):
            continue
        text = read_text_or_none(repo_root / path)
        if text is None:
            continue
        for label in find_new_names(text):
            problems.append(f"{path}: {label}")
    return problems


def renamed_lockfile_text(repo_root: Path) -> Union[str, None]:
    original = (repo_root / LOCKFILE_PATH).read_text(encoding="utf-8")
    data = json.loads(original)
    roundtrip = json.dumps(data, indent=2, ensure_ascii=False) + "\n"
    if roundtrip != original:
        raise SystemExit(
            f"{LOCKFILE_PATH}: JSON round trip changes the file, edit its names by hand"
        )
    data["name"] = rename_text(data["name"])
    root_package = data["packages"][""]
    root_package["name"] = rename_text(root_package["name"])
    updated = json.dumps(data, indent=2, ensure_ascii=False) + "\n"
    if updated == original:
        return None
    return updated


def print_report(report: Report, lockfile_changed: bool) -> None:
    for rule in RULES:
        files = report.files_by_rule[rule.label]
        tokens = report.tokens_by_rule[rule.label]
        print(f"\n== rule {rule.label}: {len(files)} files, {len(tokens)} distinct tokens")
        for token, count in sorted(tokens.items()):
            print(f"   {count:5d}  {token}")
    print(f"\nfiles that change: {len(report.changed)}")
    print(f"{LOCKFILE_PATH} names change: {lockfile_changed}")
    print(f"move: {OLD_SPEC_PATH} -> {NEW_SPEC_PATH}")
    for path in report.skipped:
        print(f"skipped (not UTF-8 text): {path}")


def apply_changes(repo_root: Path, report: Report, lockfile_text: Union[str, None]) -> None:
    changed_paths = []
    for path, renamed in sorted(report.changed.items()):
        (repo_root / path).write_bytes(renamed.encode("utf-8"))
        changed_paths.append(path)
    if lockfile_text is not None:
        (repo_root / LOCKFILE_PATH).write_bytes(lockfile_text.encode("utf-8"))
        changed_paths.append(LOCKFILE_PATH)
    if NEW_SPEC_PATH not in changed_paths:
        changed_paths.append(NEW_SPEC_PATH)
    listing = "\n".join(changed_paths) + "\n"
    CHANGED_FILES_LIST.write_text(listing, encoding="utf-8")
    print("\nchanged files:")
    for path in changed_paths:
        print(f"   {path}")
    print(f"\nlist saved in {CHANGED_FILES_LIST}")


def main(arguments: list[str]) -> int:
    apply = "--apply" in arguments
    repo_root = find_repo_root()
    paths = list_tracked_files(repo_root)

    problems = find_existing_new_names(repo_root, paths)
    if problems:
        print("abort: the new names already exist in included files:")
        for problem in problems:
            print(f"   {problem}")
        return 1

    if apply:
        run_git(repo_root, "mv", OLD_SPEC_PATH, NEW_SPEC_PATH)
        paths = list_tracked_files(repo_root)

    report = collect_changes(repo_root, paths)
    lockfile_text = renamed_lockfile_text(repo_root)
    print_report(report, lockfile_text is not None)
    if apply:
        apply_changes(repo_root, report, lockfile_text)
    else:
        print("\ndry run: nothing written, use --apply to write")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
