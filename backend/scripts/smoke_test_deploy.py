#!/usr/bin/env python3
"""HTTP smoke test against a deployed App Engine version URL."""
from __future__ import annotations

import argparse
import sys
import urllib.error
import urllib.request

MIN_IMAGE_BYTES = 2048


def fetch(url: str) -> tuple[int, str, bytes]:
    req = urllib.request.Request(url, headers={'User-Agent': 'afa-backend-deploy-smoke/1.0'})
    with urllib.request.urlopen(req, timeout=120) as resp:
        body = resp.read()
        ctype = resp.headers.get('Content-Type', '')
        return resp.status, ctype, body


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('--base-url', required=True, help='e.g. https://ci-abc123-dot-afa-editor.ew.r.appspot.com')
    args = parser.parse_args()
    base = args.base_url.rstrip('/')

    cases = [
        ('background #0', f'{base}/api/get-background-color?tokenId=0'),
        ('render #0', f'{base}/api/get-asset?tokenId=0&assetType=AFA'),
        ('death bot fur #228', f'{base}/api/get-asset?tokenId=228&assetType=AFA'),
    ]

    for label, url in cases:
        try:
            status, ctype, body = fetch(url)
        except urllib.error.HTTPError as exc:
            print(f'FAIL {label}: HTTP {exc.code} {url}', file=sys.stderr)
            return 1
        except Exception as exc:  # noqa: BLE001
            print(f'FAIL {label}: {exc} {url}', file=sys.stderr)
            return 1

        if label.startswith('background'):
            if status != 200 or 'json' not in ctype.lower():
                print(f'FAIL {label}: status={status} content-type={ctype}', file=sys.stderr)
                return 1
        else:
            if status != 200:
                print(f'FAIL {label}: status={status}', file=sys.stderr)
                return 1
            if 'image' not in ctype.lower():
                print(f'FAIL {label}: expected image content-type, got {ctype}', file=sys.stderr)
                return 1
            if len(body) < MIN_IMAGE_BYTES:
                print(f'FAIL {label}: body too small ({len(body)} bytes)', file=sys.stderr)
                return 1
        print(f'OK {label} ({len(body)} bytes, {ctype})')

    print('Smoke tests passed.')
    return 0


if __name__ == '__main__':
    sys.exit(main())