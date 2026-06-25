#!/usr/bin/env python3
"""Check evolution errors over time."""
import json, sys
from collections import Counter

with open(sys.stdin.fileno(), encoding="utf-8") as f:
    data = json.load(f)

errors = [r for r in data if r.get("source") == "evolution_scheduler"]
print(f"Total evolution errors: {len(errors)}")

by_hour = Counter()
for r in errors:
    t = r.get("created_at_kst", "")[:13]
    by_hour[t] += 1

print("\nBy hour:")
for h in sorted(by_hour):
    print(f"  {h}: {by_hour[h]} errors")

print("\nLast 3 errors:")
for r in errors[:3]:
    print(f"  {r.get('created_at_kst','')} {r.get('message','')[:100]}")
