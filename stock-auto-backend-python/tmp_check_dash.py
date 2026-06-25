#!/usr/bin/env python3
"""Check evolution dashboard endpoint."""
import urllib.request, json

resp = urllib.request.urlopen("http://localhost:5000/api/evolution/dashboard")
d = json.loads(resp.read().decode())
print("current_generation:", d.get("current_generation"))
print("is_running:", d.get("is_running"))
print("status:", (d.get("status") or "")[:80])
print("last_run_at:", d.get("last_run_at"))
print("next_scheduled_run:", d.get("next_scheduled_run"))
