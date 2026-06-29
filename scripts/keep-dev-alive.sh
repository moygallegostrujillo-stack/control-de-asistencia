#!/bin/bash
# Auto-restart wrapper for Next.js dev server
cd /home/z/my-project
while true; do
  echo "[$(date)] Starting dev server..."
  bun x next dev -p 3000 > /home/z/my-project/dev.log 2>&1
  EXIT_CODE=$?
  echo "[$(date)] Dev server exited with code $EXIT_CODE, restarting in 2s..."
  sleep 2
done
