#!/bin/bash
for i in 1 2 3 4 5 6 7 8; do
  sleep 1
  curl -s -w '%{http_code}' --max-time 3 'http://localhost:5000/api/health'
  echo " POLL-$i"
done
