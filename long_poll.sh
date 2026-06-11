#!/bin/bash
for i in $(seq 1 20); do
  sleep 2
  curl -s -w '%{http_code} %{time_total}' --max-time 4 http://localhost:5000/api/health
  echo ''
done
