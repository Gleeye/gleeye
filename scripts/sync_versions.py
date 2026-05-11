#!/usr/bin/env python3
"""
Sync all cache-busting `?v=NUMBER` markers across the codebase to a single version.

Why: every JS import and every <script>/<link> in index.html has its own `?v=NNNN`
hardcoded. Over time these drift (today: 24 different versions coexist), so a
collaborator can end up with a Frankenstein mix of cached files. This tool
forces a single global version everywhere in one shot.

Usage:
    python3 scripts/sync_versions.py                # bumps current+1
    python3 scripts/sync_versions.py 8000           # sets to 8000
    python3 scripts/sync_versions.py --dry-run      # show what would change
    python3 scripts/sync_versions.py 8000 --dry-run

Scope:
    - js/**/*.js  (static + dynamic imports with ?v=)
    - index.html  (<script src=... ?v=>  and  <link href=... ?v=>)
    - booking-app/src/**/*.{ts,tsx,js,jsx}  (best-effort, Vite handles its own
      cache busting on build so this mostly affects dev imports)

Excludes:
    - scripts/archive/  (legacy)
    - node_modules/
"""

from __future__ import annotations
import os
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent

# ---------- regexes -------------------------------------------------------------------

# Static ES6 import:   import ... from './path.js?v=NNNN'   or without ?v=
STATIC_IMPORT_RE = re.compile(
    r"""(?P<head>from\s*['"](?P<path>[^'"]+\.(?:js|mjs|css)))(?P<ver>\?v=\d+)?(?P<tail>['"])""",
    re.MULTILINE,
)

# Dynamic import:      import('./path.js?v=NNNN')
DYNAMIC_IMPORT_RE = re.compile(
    r"""(?P<head>import\(\s*['"](?P<path>[^'"]+\.(?:js|mjs|css)))(?P<ver>\?v=\d+)?(?P<tail>['"]\s*\))""",
    re.MULTILINE,
)

# Plain ?v=NNNN inside href/src in HTML (and in template literals for safety)
HTML_ATTR_RE = re.compile(
    r"""(?P<head>(?:src|href)\s*=\s*['"](?P<path>[^'"\s]+\.(?:js|mjs|css)))(?P<ver>\?v=\d+)?(?P<tail>['"])""",
    re.MULTILINE,
)

# Runtime cache buster anti-pattern:  './foo.js?v=' + Date.now()   |  '...css?v=' + new Date().getTime()
# Captures: open quote, path, ?v=, close quote, ` + Date.now()|new Date().getTime()`.
# We rewrite the whole match as a quoted literal with a static `?v=NNNN`.
DYNAMIC_BUSTER_RE = re.compile(
    r"""(?P<quote>['"])(?P<path>[^'"\n]*?)\?v=(?P=quote)\s*\+\s*(?:Date\.now\(\)|new\s+Date\(\)\.getTime\(\))""",
    re.MULTILINE,
)

INCLUDE_EXTS_JS = {".js", ".mjs", ".ts", ".tsx", ".jsx"}
INCLUDE_DIRS = [
    REPO_ROOT / "js",
    REPO_ROOT / "booking-app" / "src",
]
INCLUDE_HTML = [
    REPO_ROOT / "index.html",
]
EXCLUDE_PARTS = {"scripts/archive", "node_modules", "dist", ".git"}


def iter_target_files() -> list[Path]:
    out: list[Path] = []
    for base in INCLUDE_DIRS:
        if not base.exists():
            continue
        for p in base.rglob("*"):
            if not p.is_file():
                continue
            rel = p.relative_to(REPO_ROOT).as_posix()
            if any(part in rel for part in EXCLUDE_PARTS):
                continue
            if p.suffix in INCLUDE_EXTS_JS:
                out.append(p)
    for p in INCLUDE_HTML:
        if p.exists():
            out.append(p)
    return out


def detect_current_max(files: list[Path]) -> int:
    versions: list[int] = []
    ver_re = re.compile(r"\?v=(\d+)")
    for f in files:
        try:
            content = f.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        for m in ver_re.finditer(content):
            versions.append(int(m.group(1)))
    return max(versions) if versions else 1000


def replace_in_text(text: str, version: int, is_html: bool) -> tuple[str, int]:
    new_ver = f"?v={version}"
    count = 0

    def _sub(m: re.Match[str]) -> str:
        nonlocal count
        count += 1
        return f"{m.group('head')}{new_ver}{m.group('tail')}"

    if is_html:
        text = HTML_ATTR_RE.sub(_sub, text)
    text = STATIC_IMPORT_RE.sub(_sub, text)
    text = DYNAMIC_IMPORT_RE.sub(_sub, text)

    # Kill runtime cache busters (anti-pattern). They become static '<path>?v=NNNN'.
    def _sub_dyn(m: re.Match[str]) -> str:
        nonlocal count
        count += 1
        q = m.group("quote")
        path = m.group("path")
        return f"{q}{path}?v={version}{q}"

    text = DYNAMIC_BUSTER_RE.sub(_sub_dyn, text)
    return text, count


def main(argv: list[str]) -> int:
    dry_run = "--dry-run" in argv
    args = [a for a in argv[1:] if not a.startswith("--")]

    files = iter_target_files()
    if not files:
        print("No target files found", file=sys.stderr)
        return 1

    if args:
        try:
            target_version = int(args[0])
        except ValueError:
            print(f"Invalid version: {args[0]}", file=sys.stderr)
            return 2
    else:
        current_max = detect_current_max(files)
        target_version = current_max + 1
        print(f"[detect] current max version = {current_max}, will set everything to {target_version}")

    changed: list[tuple[Path, int]] = []
    total_replacements = 0
    for f in files:
        try:
            original = f.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        is_html = f.suffix == ".html"
        new_text, n = replace_in_text(original, target_version, is_html)
        if n > 0 and new_text != original:
            changed.append((f, n))
            total_replacements += n
            if not dry_run:
                f.write_text(new_text, encoding="utf-8")

    print(f"\n[{'dry-run' if dry_run else 'applied'}] target version: v={target_version}")
    print(f"Files modified: {len(changed)} | Total ?v= replacements: {total_replacements}\n")
    if changed:
        for f, n in sorted(changed)[:25]:
            print(f"  {f.relative_to(REPO_ROOT)}  ({n} replacements)")
        if len(changed) > 25:
            print(f"  ... and {len(changed) - 25} more files")

    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
