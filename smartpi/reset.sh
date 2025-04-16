#!/bin/sh
# Reset script for Supabase project

echo "Stopping all containers..."
docker compose down -v --remove-orphans

echo "Removing database data..."
rm -rf ./volumes/db/data

echo "Recreating database data directory..."
mkdir -p ./volumes/db/data

echo "Reset complete. You can now start the project with: docker compose up