#!/usr/bin/env python3
"""Find and replace text across multiple files."""
import sys
import os
import re
import glob
import argparse

def main():
    parser = argparse.ArgumentParser(description="Find and replace text in files")
    parser.add_argument("--folder", required=True)
    parser.add_argument("--find", required=True)
    parser.add_argument("--replace", default="")
    parser.add_argument("--use_regex", action="store_true", default=False)
    parser.add_argument("--file_pattern", default="*.txt")
    parser.add_argument("--recursive", action="store_true", default=False)
    parser.add_argument("--dry_run", action="store_true", default=True)
    parser.add_argument("--case_sensitive", action="store_true", default=True)
    args = parser.parse_args()

    if not os.path.isdir(args.folder):
        print(f"Error: Folder not found: {args.folder}", file=sys.stderr)
        sys.exit(1)

    # Find files
    pattern = os.path.join(args.folder, f"**{os.sep}{args.file_pattern}" if args.recursive else args.file_pattern)
    if args.recursive:
        files = glob.glob(pattern, recursive=True)
    else:
        files = glob.glob(os.path.join(args.folder, args.file_pattern))

    if not files:
        print(f"No files matching '{args.file_pattern}' found in {args.folder}")
        return

    # Compile search pattern
    flags = 0 if args.case_sensitive else re.IGNORECASE
    try:
        if args.use_regex:
            search = re.compile(args.find, flags)
        else:
            search = re.compile(re.escape(args.find), flags)
    except re.error as e:
        print(f"Invalid regex pattern: {e}", file=sys.stderr)
        sys.exit(1)

    total_matches = 0
    files_changed = 0

    for filepath in files:
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                content = f.read()
        except UnicodeDecodeError:
            try:
                with open(filepath, "r", encoding="gbk") as f:
                    content = f.read()
            except Exception:
                print(f"SKIP (cannot read): {filepath}")
                continue
        except Exception as e:
            print(f"SKIP (error): {filepath} - {e}")
            continue

        new_content, count = search.subn(args.replace, content)
        if count == 0:
            continue

        total_matches += count
        files_changed += 1
        relpath = os.path.relpath(filepath, args.folder)

        if args.dry_run:
            print(f"[DRY RUN] {relpath}: {count} match(es)")
            # Show first few changes
            matches = list(search.finditer(content))[:3]
            for m in matches:
                before = m.group()[:60]
                after = search.sub(args.replace, m.group())[:60]
                print(f"  '{before}' -> '{after}'")
            if len(list(search.finditer(content))) > 3:
                print(f"  ... and more")
        else:
            with open(filepath, "w", encoding="utf-8") as f:
                f.write(new_content)
            print(f"CHANGED: {relpath}: {count} replacement(s)")

    print(f"\n========== Summary ==========")
    print(f"  Files scanned: {len(files)}")
    print(f"  Files with matches: {files_changed}")
    print(f"  Total matches: {total_matches}")
    if args.dry_run:
        print(f"  Mode: DRY RUN (no files were changed)")
    else:
        print(f"  Mode: CHANGES APPLIED")


if __name__ == "__main__":
    main()
