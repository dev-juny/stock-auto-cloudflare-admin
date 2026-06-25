#!/usr/bin/env python3
"""Find actual API routes."""
import urllib.request, json

base = "http://localhost:5000"
paths = [
    '/paper/positions', '/paper/trades', '/paper/performance',
    '/api/paper/positions', '/api/paper/trades', '/api/paper/performance',
    '/readiness', '/api/readiness',
    '/api/portfolio/risk-check', '/api/portfolio/risk-check/',
    '/api/portfolio/risk/check',
    '/api/validation/start', '/api/validation/status',
    '/api/scheduler/status', '/api/scheduler/jobs',
    '/api/portfolio/health', '/api/portfolio/holdings',
    '/api/evolution/dashboard', '/api/logs',
    '/api/portfolio/promotion-history',
    '/api/portfolio/rebalance-history',
    '/api/portfolio/auto-promote',
]

for path in paths:
    url = base + path
    try:
        req = urllib.request.Request(url, method='GET')
        resp = urllib.request.urlopen(req, timeout=5)
        data = json.loads(resp.read().decode())
        if isinstance(data, dict):
            if 'items' in data and isinstance(data['items'], list):
                print(f"200 {path}: {len(data['items'])} items, keys={list(data.keys())[:5]}")
            else:
                print(f"200 {path}: keys={list(data.keys())[:8]}, val_preview={str(list(data.values())[:3])[:80]}")
        elif isinstance(data, list):
            print(f"200 {path}: len={len(data)}")
        else:
            print(f"200 {path}: {str(data)[:100]}")
    except urllib.error.HTTPError as e:
        print(f"{e.code} {path}")
    except Exception as e:
        print(f"ERR {path}: {e}")
