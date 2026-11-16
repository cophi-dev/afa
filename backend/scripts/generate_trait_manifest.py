#!/usr/bin/env python3
"""Build trait_manifest.json from db.json trait values and app.py asset paths."""
from __future__ import annotations

import ast
import json
import os
import re
import sys

BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
TRAITS_DIR = os.path.join(BACKEND_DIR, 'traits')
DB_PATH = os.path.join(BACKEND_DIR, 'db.json')
APP_PATH = os.path.join(BACKEND_DIR, 'app.py')
MANIFEST_PATH = os.path.join(BACKEND_DIR, 'trait_manifest.json')

TRAIT_FOLDER_MAP = {
    'Background': 'Background',
    'Clothes': 'Clothes',
    'Earring': 'Earring',
    'Eyes': 'Eyes',
    'Fur': 'Fur',
    'Hat': 'Hat',
    'Mouth': 'Mouth',
}

# Minimum PNG counts per folder (sanity check for full trait pack from Drive/GCS).
FOLDER_MINIMUM_COUNTS = {
    'Background': 8,
    'Clothes': 43,
    'Earring': 6,
    'Eyes': 23,
    'Fur': 19,
    'Hat': 36,
    'Mouth': 33,
    'Heads': 19,
    'Hoodie_Fur': 19,
    'Special Cases/Clothes': 3,
    'Special Cases/Eyes': 7,
    'memes': 118,  # root-level PNGs only (subfolders excluded)
    'memes/silvester_eyes': 23,
}

SPECIAL_CASE_PATHS = [
    'Special Cases/Eyes/Crazy Left Eye.png',
    'Special Cases/Eyes/Blue Beams.png',
]

STAR_GLASSES_OPTIONAL = [
    'memes/star_glasses.png',
]


def rel(path: str) -> str:
    return os.path.relpath(path, TRAITS_DIR).replace('\\', '/')


def collect_db_trait_paths() -> set[str]:
    with open(DB_PATH, encoding='utf-8') as f:
        data = json.load(f)
    paths: set[str] = set()
    eyes_values: set[str] = set()
    for ape in data.get('apes', []):
        for attr in ape.get('metadata', {}).get('attributes', []):
            trait_type = attr.get('trait_type')
            value = attr.get('value')
            if not value or trait_type not in TRAIT_FOLDER_MAP:
                continue
            folder = TRAIT_FOLDER_MAP[trait_type]
            paths.add(f'{folder}/{value}.png')
            if trait_type == 'Eyes':
                eyes_values.add(value)
    for eye in eyes_values:
        paths.add(f'memes/silvester_eyes/{eye}.png')
    paths.add('_blank.png')
    return paths


def collect_app_py_paths() -> set[str]:
    with open(APP_PATH, encoding='utf-8') as f:
        source = f.read()
    paths: set[str] = set()
    join_pattern = re.compile(
        r"os\.path\.join\(base_dir,\s*['\"]([^'\"]+)['\"]"
        r"\s*(?:,\s*['\"]([^'\"]+)['\"])?"
        r"\s*(?:,\s*['\"]([^'\"]+)['\"])?\s*\)"
    )
    for match in join_pattern.finditer(source):
        parts = [p for p in match.groups() if p]
        if not parts:
            continue
        if parts[0] == 'memes' and len(parts) == 3 and parts[1] == 'smile':
            paths.add(f'memes/smile/{parts[2]}')
        elif parts[0] == 'memes' and len(parts) == 2:
            paths.add(f'memes/{parts[1]}')
        elif parts[0] == 'Heads' and len(parts) == 2:
            paths.add(f'Heads/{parts[1]}')
        elif parts[0] == 'Hoodie_Fur' and len(parts) == 2:
            paths.add(f'Hoodie_Fur/{parts[1]}')
        elif len(parts) == 1 and parts[0] == '_blank.png':
            paths.add('_blank.png')
    paths.update(SPECIAL_CASE_PATHS)
    return paths


def main() -> int:
    required = sorted(collect_db_trait_paths() | collect_app_py_paths())
    manifest = {
        'generated_from': ['backend/db.json', 'backend/app.py'],
        'traits_root': 'traits',
        'folder_minimum_counts': FOLDER_MINIMUM_COUNTS,
        'required_paths': required,
        'optional_paths': sorted(STAR_GLASSES_OPTIONAL),
    }
    with open(MANIFEST_PATH, 'w', encoding='utf-8') as f:
        json.dump(manifest, f, indent=2)
        f.write('\n')
    print(f'Wrote {len(required)} required paths to {MANIFEST_PATH}')
    return 0


if __name__ == '__main__':
    sys.exit(main())