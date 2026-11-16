"""db.json integrity: one row per token id 0..9999 and correct lookup for #0."""
import json
import os
import unittest


BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BACKEND_DIR, 'db.json')

EXPECTED_APE_ZERO = {
    'Background': 'Orange',
    'Fur': 'Robot',
    'Clothes': 'Striped Tee',
    'Mouth': 'Discomfort',
    'Eyes': 'X Eyes',
    'Earring': 'Silver Hoop',
}


def load_db():
    with open(DB_PATH, encoding='utf-8') as f:
        return json.load(f)


def lookup_ape(apes, token_id: str):
    return next((item for item in apes if str(item.get('id')) == token_id), None)


class DbIntegrityTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data = load_db()
        cls.apes = cls.data['apes']

    def test_exactly_one_row_per_id_0_through_9999(self):
        ids = [str(ape['id']) for ape in self.apes]
        self.assertEqual(len(ids), 10000)
        for i in range(10000):
            self.assertEqual(ids.count(str(i)), 1, f'id {i} count={ids.count(str(i))}')

    def test_token_zero_resolves_to_canonical_record(self):
        ape = lookup_ape(self.apes, '0')
        self.assertIsNotNone(ape)
        self.assertIn('/0', ape.get('uri', ''))
        self.assertNotIn('/3478', ape.get('uri', ''))
        attrs = {
            attr['trait_type']: attr['value']
            for attr in ape['metadata']['attributes']
        }
        for trait_type, expected in EXPECTED_APE_ZERO.items():
            self.assertEqual(attrs.get(trait_type), expected, trait_type)

    def test_compose_lookup_matches_canonical_zero(self):
        """Mirrors compose_ape / get_background_color first-match semantics."""
        ape = lookup_ape(self.apes, '0')
        self.assertIsNotNone(ape)
        background = next(
            (attr['value'] for attr in ape['metadata']['attributes'] if attr['trait_type'] == 'Background'),
            None,
        )
        self.assertEqual(background, 'Orange')


if __name__ == '__main__':
    unittest.main()