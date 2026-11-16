#!/usr/bin/env python3
"""Fail CI when trait assets are missing or folder counts are below the manifest."""
from __future__ import annotations

import json
import os
import sys

BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, BACKEND_DIR)

from app import resolve_asset_path  # noqa: E402

TRAITS_DIR = os.path.join(BACKEND_DIR, 'traits')
MANIFEST_PATH = os.path.join(BACKEND_DIR, 'trait_manifest.json')


def count_pngs_in_folder(abs_dir: str, recursive: bool = False) -> int:
    if not os.path.isdir(abs_dir):
        return 0
    count = 0
    if recursive:
        for root, _dirs, files in os.walk(abs_dir):
            count += sum(1 for f in files if f.lower().endswith('.png'))
    else:
        count = sum(
            1 for f in os.listdir(abs_dir)
            if f.lower().endswith('.png') and os.path.isfile(os.path.join(abs_dir, f))
        )
    return count


def main() -> int:
    if not os.path.isfile(MANIFEST_PATH):
        print(f'Missing manifest: {MANIFEST_PATH}', file=sys.stderr)
        return 1
    with open(MANIFEST_PATH, encoding='utf-8') as f:
        manifest = json.load(f)

    errors: list[str] = []

    for rel_folder, minimum in manifest.get('folder_minimum_counts', {}).items():
        abs_folder = os.path.join(TRAITS_DIR, rel_folder)
        if rel_folder == 'memes':
            actual = count_pngs_in_folder(abs_folder, recursive=False)
        else:
            actual = count_pngs_in_folder(abs_folder, recursive=False)
        if actual < minimum:
            errors.append(
                f'Folder {rel_folder}: expected at least {minimum} PNGs, found {actual}'
            )

    for rel_path in manifest.get('required_paths', []):
        abs_path = os.path.join(TRAITS_DIR, rel_path)
        resolved = resolve_asset_path(abs_path)
        if not os.path.isfile(resolved):
            errors.append(f'Missing required asset: {rel_path} (resolved: {resolved})')

    for rel_path in manifest.get('optional_paths', []):
        abs_path = os.path.join(TRAITS_DIR, rel_path)
        resolved = resolve_asset_path(abs_path)
        if not os.path.isfile(resolved):
            print(f'Note: optional asset not present: {rel_path}')

    if errors:
        print('Trait verification FAILED:', file=sys.stderr)
        for err in errors:
            print(f'  - {err}', file=sys.stderr)
        return 1

    print(
        f'Trait verification OK ({len(manifest.get("required_paths", []))} required paths, '
        f'{len(manifest.get("folder_minimum_counts", {}))} folders checked).'
    )
    return 0


if __name__ == '__main__':
    sys.exit(main())