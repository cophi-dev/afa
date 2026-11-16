"""Cache headers, cache keys, and rate limiting for /api/get-asset."""
import unittest
from unittest import mock

from app import (
    build_render_cache_key,
    json_error,
    render_rate_limited,
    app,
)


class RenderCacheKeyTest(unittest.TestCase):
    def test_unknown_query_params_ignored(self):
        base = build_render_cache_key('get-asset', {
            'tokenId': '42', 'assetType': 'AFA', 'size': '256',
            'cacheBust': '123', 'evil': 'x',
        })
        clean = build_render_cache_key('get-asset', {
            'tokenId': '42', 'assetType': 'AFA', 'size': '256',
        })
        self.assertEqual(base, clean)

    def test_invalid_size_not_in_key(self):
        without = build_render_cache_key('get-asset', {'tokenId': '1', 'size': '999'})
        with_valid = build_render_cache_key('get-asset', {'tokenId': '1', 'size': '256'})
        self.assertEqual(without, 'get-asset?tokenId=1')
        self.assertEqual(with_valid, 'get-asset?size=256&tokenId=1')


class JsonErrorCacheTest(unittest.TestCase):
    def test_no_store_on_errors(self):
        with app.app_context():
            resp, code = json_error({'error': 'nope'}, 403)
        self.assertEqual(code, 403)
        self.assertEqual(resp.headers.get('Cache-Control'), 'no-store')


class GetAssetRouteTest(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()

    @mock.patch('app.is_minted', return_value=False)
    def test_not_minted_403_no_store(self, _minted):
        resp = self.client.get('/api/get-asset?tokenId=9999')
        self.assertEqual(resp.status_code, 403)
        self.assertEqual(resp.headers.get('Cache-Control'), 'no-store')
        self.assertEqual(resp.get_json().get('code'), 'NOT_MINTED')

    @mock.patch('app.is_minted', return_value=True)
    @mock.patch('app.load_db')
    @mock.patch('app.compose_ape')
    def test_success_image_has_long_cache(self, compose, _db, _minted):
        buf = mock.Mock()
        buf.getvalue = mock.Mock(return_value=b'\x89PNG\r\n\x1a\n')
        with mock.patch('app.BytesIO', return_value=buf):
            img = mock.Mock()
            compose.return_value = img
            resp = self.client.get('/api/get-asset?tokenId=1&assetType=AFA')
        self.assertEqual(resp.status_code, 200)
        cc = resp.headers.get('Cache-Control', '')
        self.assertIn('immutable', cc)
        self.assertNotIn('no-store', cc)


class RenderRateLimitTest(unittest.TestCase):
    def test_rate_limit_trips(self):
        ip = 'test-client-127-0-0-1'
        limited = False
        for _ in range(302):
            limited = render_rate_limited(ip)
        self.assertTrue(limited)


if __name__ == '__main__':
    unittest.main()