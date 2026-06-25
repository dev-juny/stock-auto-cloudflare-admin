#!/usr/bin/env python3
"""Verify all fixes after restart."""
import urllib.request, json

base = "http://localhost:5000/api"

tests = [
    ("GET", "/risk/check", None),
    ("GET", "/validation/status", None),
    ("GET", "/paper-trading/positions", None),
    ("GET", "/paper-trading/performance", None),
    ("GET", "/live-trading/readiness", None),
    ("GET", "/scheduler/status", None),
    ("GET", "/portfolio/health", None),
    ("GET", "/evolution/dashboard", None),
]

for method, path, body in tests:
    try:
        if method == "POST":
            req = urllib.request.Request(base + path, method='POST', data=body or b'')
        else:
            req = urllib.request.Request(base + path, method='GET')
        resp = urllib.request.urlopen(req, timeout=10)
        data = json.loads(resp.read().decode())
        if isinstance(data, dict):
            k = list(data.keys())[:8]
            print(f"200 {path}: keys={k}")
            if path == "/risk/check":
                print(f"  blocked={data.get('blocked')} status={data.get('risk_status')} mdd={data.get('portfolio_mdd')} reasons={data.get('reasons')} warnings={data.get('warnings')}")
            if path == "/live-trading/readiness":
                print(f"  ready={data.get('ready')} reason={data.get('reason')[:80]}")
        elif isinstance(data, list):
            print(f"200 {path}: len={len(data)}")
        else:
            print(f"200 {path}: {str(data)[:100]}")
    except urllib.error.HTTPError as e:
        print(f"{e.code} {path}: {e.read().decode()[:100]}")
    except Exception as e:
        print(f"ERR {path}: {e}")
