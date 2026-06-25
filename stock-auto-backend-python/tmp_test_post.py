#!/usr/bin/env python3
"""Test POST endpoints correctly."""
import urllib.request, json

base = "http://localhost:5000/api"

# Test validation start with POST
try:
    req = urllib.request.Request(f"{base}/validation/start", method='POST', data=b'')
    resp = urllib.request.urlopen(req, timeout=10)
    data = json.loads(resp.read().decode())
    print(f"POST /api/validation/start -> {data}")
except urllib.error.HTTPError as e:
    print(f"POST /api/validation/start -> {e.code} {e.read().decode()[:200]}")
except Exception as e:
    print(f"POST /api/validation/start -> ERROR: {e}")

# Test validation status
try:
    resp = urllib.request.urlopen(f"{base}/validation/status", timeout=10)
    data = json.loads(resp.read().decode())
    print(f"GET /api/validation/status -> {json.dumps(data)[:200]}")
except Exception as e:
    print(f"GET /api/validation/status -> ERROR: {e}")

# Test auto-promote with POST
try:
    req = urllib.request.Request(f"{base}/portfolio/auto-promote", method='POST', data=b'')
    resp = urllib.request.urlopen(req, timeout=10)
    data = json.loads(resp.read().decode())
    print(f"POST /api/portfolio/auto-promote -> {data}")
except urllib.error.HTTPError as e:
    resp_body = e.read().decode()[:200]
    print(f"POST /api/portfolio/auto-promote -> {e.code} {resp_body}")
except Exception as e:
    print(f"POST /api/portfolio/auto-promote -> ERROR: {e}")
