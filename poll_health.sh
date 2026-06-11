#!/bin/bash
for i in 1 2 3 4 5 6 7 8 9 10; do
  sleep 2
  curl -s -w '%{http_code} %{time_total}' --max-time 4 http://localhost:5000/api/health
  echo " HLTH-$i"
done
