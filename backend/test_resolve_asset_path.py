"""Unit tests for resolve_asset_path space/underscore fallback."""
import os
import shutil
import tempfile
import unittest


class ResolveAssetPathTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.dir = os.path.join(self.tmp, 'Hoodie_Fur')
        os.makedirs(self.dir)
        import app as app_module
        self.app = app_module

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def test_finds_underscore_file_when_space_expected(self):
        underscored = os.path.join(self.dir, 'Death_Bot.png')
        with open(underscored, 'wb') as f:
            f.write(b'png-bytes')
        expected = os.path.join(self.dir, 'Death Bot.png')
        resolved = self.app.resolve_asset_path(expected)
        self.assertTrue(os.path.isfile(resolved))
        self.assertEqual(os.path.basename(resolved), 'Death_Bot.png')

    def test_finds_space_file_when_underscore_expected(self):
        spaced = os.path.join(self.dir, 'Dark Brown.png')
        with open(spaced, 'wb') as f:
            f.write(b'png-bytes')
        expected = os.path.join(self.dir, 'Dark_Brown.png')
        resolved = self.app.resolve_asset_path(expected)
        self.assertEqual(os.path.basename(resolved), 'Dark Brown.png')

    def test_case_insensitive_still_works(self):
        on_disk = os.path.join(self.dir, 'head_death_bot.PNG')
        with open(on_disk, 'wb') as f:
            f.write(b'png-bytes')
        expected = os.path.join(self.dir, 'head_death_bot.png')
        resolved = self.app.resolve_asset_path(expected)
        self.assertEqual(os.path.basename(resolved), 'head_death_bot.PNG')


if __name__ == '__main__':
    unittest.main()