#!/bin/bash
echo "=== Test JSON content ==="
python3 -c "
import json
with open('/tmp/scan_test.json') as f:
    data = json.load(f)
print(type(data).__name__)
print(json.dumps(data)[:200])
"
echo "=== Test scan POST ==="
RESPONSE=$(curl -s -X POST "http://localhost:5000/api/backtest/scan" \
  -H "Content-Type: application/json" \
  -d @/tmp/scan_test.json --max-time 10)
echo "POST: $RESPONSE"
SCAN_ID=$(echo "$RESPONSE" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(d.get('scan_id', 'MISSING'))
" 2>/dev/null || echo "EXTRACT_FAIL")
echo "SID=$SCAN_ID"
sleep 3
STATUS=$(curl -s --max-time 4 "http://localhost:5000/api/backtest/scan/$SCAN_ID")
echo "POLL: $STATUS"
