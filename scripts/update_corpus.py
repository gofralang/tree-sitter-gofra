#!/usr/bin/env python3
"""Regenerate the expected trees of a tree-sitter corpus file.

Usage: python3 scripts/update_corpus.py test/corpus/*.txt
"""

from __future__ import annotations

import re
import subprocess
import sys
import tempfile
from pathlib import Path

SEP = "=" * 80
DIV = "-" * 80


def parse_corpus(text: str) -> list[tuple[str, str]]:
    """Split a corpus file into (name, source) pairs."""
    cases: list[tuple[str, str]] = []
    chunks = text.split(SEP)
    # chunks: ['', name, source+divider+expected, name, source+...]
    for i in range(1, len(chunks) - 1, 2):
        name = chunks[i].strip()
        body = chunks[i + 1]
        source = body.split(DIV)[0].strip("\n")
        cases.append((name, source))
    return cases


def parse_source(source: str, grammar_dir: Path) -> str:
    with tempfile.NamedTemporaryFile("w", suffix=".gof", delete=False) as tmp:
        tmp.write(source + "\n")
        path = tmp.name

    result = subprocess.run(
        ["tree-sitter", "parse", path],
        cwd=grammar_dir,
        capture_output=True,
        text=True,
        check=False,
    )
    Path(path).unlink(missing_ok=True)

    out = result.stdout
    start = out.find("(source_file")
    if start == -1:
        return "(ERROR)"

    # The tree ends as soon as the parenthesis balance is back to zero - the
    # lines after it are the parse summary.
    lines: list[str] = []
    depth = 0
    for line in out[start:].splitlines():
        lines.append(line)
        depth += line.count("(") - line.count(")")
        if depth <= 0:
            break

    tree = "\n".join(lines)
    # The corpus format does not use source positions.
    return re.sub(r" \[\d+, \d+\] - \[\d+, \d+\]", "", tree)


def main() -> int:
    grammar_dir = Path(__file__).resolve().parent.parent

    for path_str in sys.argv[1:]:
        path = Path(path_str)
        cases = parse_corpus(path.read_text())

        blocks = []
        for name, source in cases:
            tree = parse_source(source, grammar_dir)
            blocks.append(f"{SEP}\n{name}\n{SEP}\n\n{source}\n\n{DIV}\n\n{tree}\n")

        path.write_text("\n".join(blocks))
        print(f"updated {path} ({len(cases)} cases)")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
