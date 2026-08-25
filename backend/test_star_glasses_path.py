"""Unit tests for Star Glasses path naming / fallback resolution."""
import os
import shutil
import tempfile
import unittest
from unittest import mock


class ResolveStarGlassesPathTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.traits = os.path.join(self.tmp, 'traits')
        self.eyes = os.path.join(self.traits, 'Eyes')
        self.star_dir = os.path.join(self.traits, 'memes', 'star_glasses')
        self.legacy_dir = os.path.join(self.traits, 'memes', 'silvester_eyes')
        os.makedirs(self.eyes)
        os.makedirs(self.star_dir)
        os.makedirs(self.legacy_dir)

        # Patch module-level base_dir / eyes_assets used by the helper.
        import app as app_module
        self.app = app_module
        self._orig_base = app_module.base_dir
        self._orig_eyes_assets = dict(app_module.eyes_assets)
        app_module.base_dir = self.traits
        app_module.eyes_assets = {
            **app_module.eyes_assets,
            'star_glasses': os.path.join(self.traits, 'memes', 'star_glasses.png'),
        }

    def tearDown(self):
        self.app.base_dir = self._orig_base
        self.app.eyes_assets = self._orig_eyes_assets
        shutil.rmtree(self.tmp, ignore_errors=True)

    def _write(self, path, content: bytes):
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, 'wb') as f:
            f.write(content)

    def test_prefers_star_glasses_folder_over_legacy(self):
        self._write(os.path.join(self.eyes, 'Bored.png'), b'base-bored')
        self._write(os.path.join(self.legacy_dir, 'Bored.png'), b'legacy-stars')
        preferred = os.path.join(self.star_dir, 'Bored.png')
        self._write(preferred, b'preferred-stars')

        resolved = self.app.resolve_star_glasses_path('Bored')
        self.assertEqual(resolved, preferred)

    def test_falls_back_to_legacy_silvester_eyes(self):
        self._write(os.path.join(self.eyes, 'Angry.png'), b'base-angry')
        legacy = os.path.join(self.legacy_dir, 'angry.png')  # legacy lowercase name
        self._write(legacy, b'legacy-angry-stars')

        resolved = self.app.resolve_star_glasses_path('Angry')
        self.assertEqual(os.path.abspath(resolved), os.path.abspath(legacy))

    def test_skips_placeholder_identical_to_base_eyes(self):
        placeholder = b'same-bytes-for-heart'
        self._write(os.path.join(self.eyes, 'Heart.png'), placeholder)
        self._write(os.path.join(self.legacy_dir, 'Heart.png'), placeholder)
        generic = os.path.join(self.traits, 'memes', 'star_glasses.png')
        self._write(generic, b'generic-star-glasses')

        resolved = self.app.resolve_star_glasses_path('Heart')
        self.assertEqual(resolved, generic)

    def test_generic_fallback_when_no_per_eye_variant(self):
        self._write(os.path.join(self.eyes, 'Robot.png'), b'base-robot')
        generic = os.path.join(self.traits, 'memes', 'star_glasses.png')
        self._write(generic, b'generic-star-glasses')

        resolved = self.app.resolve_star_glasses_path('Robot')
        self.assertEqual(resolved, generic)

    def test_last_resort_uses_bored_generic_from_legacy_pack(self):
        self._write(os.path.join(self.eyes, '3d.png'), b'base-3d')
        # No star_glasses.png — use Bored.png from legacy pack as known generic copy
        bored_generic = os.path.join(self.legacy_dir, 'Bored.png')
        self._write(bored_generic, b'generic-via-bored')
        self._write(os.path.join(self.eyes, 'Bored.png'), b'base-bored-different')

        resolved = self.app.resolve_star_glasses_path('3d')
        self.assertEqual(os.path.abspath(resolved), os.path.abspath(bored_generic))


if __name__ == '__main__':
    unittest.main()
