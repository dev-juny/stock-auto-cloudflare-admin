#!/usr/bin/env python3
"""Check readiness details and fix portfolio health."""
import urllib.request, json

base = "http://localhost:5000/api"

# Readiness
try:
    d = json.loads(urllib.request.urlopen(f"{base}/live-trading/readiness", timeout=10).read().decode())
    print("=== Readiness ===")
    print(json.dumps(d, indent=2))
except Exception as e:
    print(f"Readiness error: {e}")

# Portfolio health
try:
    d = json.loads(urllib.request.urlopen(f"{base}/portfolio/health", timeout=10).read().decode())
    print("\n=== Portfolio Health ===")
    print(json.dumps(d, indent=2)[:500])
except urllib.error.HTTPError as e:
    print(f"\nPortfolio Health error {e.code}: {e.read().decode()[:300]}")
except Exception as e:
    print(f"\nPortfolio Health error: {e}")
