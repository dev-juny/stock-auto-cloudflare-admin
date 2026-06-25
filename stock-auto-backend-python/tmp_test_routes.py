#!/usr/bin/env python3
"""Test correct API routes."""
import urllib.request, json
base = "http://localhost:5000/api"
paths = [
    "/paper-trading/performance",
    "/paper-trading/positions",
    "/paper-trading/trades",
    "/live-trading/readiness",
    "/risk/check",
    "/risk/settings",
]
for path in paths:
    url = base + path
    try:
        resp = urllib.request.urlopen(url, timeout=5)
        data = json.loads(resp.read().decode())
        if isinstance(data, dict):
            k = list(data.keys())[:10]
            print(f"200 {path} keys={k}")
            if path == "/live-trading/readiness":
                print(f"  -> {json.dumps(data, indent=2)[:500]}")
            if path == "/risk/check":
                print(f"  -> {json.dumps(data, indent=2)[:300]}")
        elif isinstance(data, list):
            print(f"200 {path} len={len(data)}")
        else:
            print(f"200 {path} {str(data)[:120]}")
    except urllib.error.HTTPError as e:
        print(f"{e.code} {path}")
    except Exception as e:
        print(f"ERR {path}: {e}")
