#!/bin/sh
set -eu

COMPOSE_FILE="docker-compose.test.yml"
export DATABASE_URL="postgresql://postgres:postgres@localhost:5433/github_release_notifier_test"
export GITHUB_TOKEN=""
export SMTP_HOST="localhost"
export SMTP_PORT="1025"
export EMAIL_FROM="test@example.com"
export APP_URL="http://localhost:3000"
export API_KEY=""

cleanup() {
  docker compose -f "$COMPOSE_FILE" down -v --remove-orphans
}

trap cleanup EXIT

docker compose -f "$COMPOSE_FILE" down -v --remove-orphans
docker compose -f "$COMPOSE_FILE" up -d --wait db

npm run generate
npm run migrate
npm run test:integration:run
