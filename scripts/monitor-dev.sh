#!/bin/bash
# Monitor and restart dev server if dead
while true; do
  sleep 1
  if ! pgrep -f "next-server" > /dev/null; then
    cd /home/z/my-project
    # Try to restart in same process group
    bun x next dev -p 3000 >> /home/z/my-project/dev.log 2>&1 &
    disown
  fi
done
