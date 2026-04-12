#!/bin/sh
set -e

echo "⏳ Waiting for database to be ready..."

# Wait until PostgreSQL is accepting connections
until npx prisma db execute --stdin <<< "SELECT 1" > /dev/null 2>&1; do
  sleep 2
  echo "  still waiting for DB..."
done

echo "✅ Database is ready"

echo "🔄 Running database migrations..."
npx prisma migrate deploy

echo "🚀 Starting server..."
exec node dist/server.js
