#!/bin/bash
# Sync Obsidian notes to garden and deploy

cd "$(dirname "$0")"

echo "syncing from obsidian..."
cd garden && npm run sync

echo "committing changes..."
cd ..
git add garden/content garden/data
git commit -m "update garden content" --allow-empty

echo "pushing to github..."
git push

echo "done!"
