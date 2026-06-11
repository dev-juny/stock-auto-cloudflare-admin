#!/bin/bash
for i in 1 2 3 4 5 6 7 8 9 10 11 12; do
  sleep 5
  curl -s --max-time 4 "http://localhost:5000/api/backtest/scan/$1" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(f'STATUS={d[\"status\"]} total={d[\"total\"]} processed={d[\"processed\"]} completed={d[\"completed\"]}')
print(f'  msg={str(d.get(\"message\",\"\"))[:80]}')
if d.get('results'):
    print(f'  results={len(d[\"results\"])}')
"
done
