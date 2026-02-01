#!/bin/bash
# Setup script for Phase 2 testing

set -e

echo "🚀 Phase 2: Testing Ingestion Dispatcher"
echo ""

# Check if docker is running
if ! docker ps > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

echo "✅ Docker is running"
echo ""

# Start services
echo "📦 Starting PostgreSQL and Electric Sync..."
cd infra
# Use Docker Compose plugin ("docker compose") where available
docker compose up -d

echo "⏳ Waiting for PostgreSQL to be ready..."
sleep 5

# Set environment variables
export DATABASE_URL=postgresql://postgres:postgres@localhost:54321/aidashboard

echo "🔄 Running migrations..."
sqlx migrate run --source ./server/migrations || true

echo ""
echo "✨ Phase 2 Setup Complete!"
echo ""
echo "To test the dispatcher, run:"
echo "  cd server/ingestor"
echo "  cargo run --bin ingestor"
echo ""
echo "Or to insert test data first:"
echo "  psql postgresql://postgres:postgres@localhost:54321/aidashboard -c 'INSERT INTO sources (name, type, medium, ingest_url, active, meta) VALUES ('"'"'arxiv-qfin'"'"', '"'"'arxiv'"'"', '"'"'paper'"'"', '"'"'http://export.arxiv.org/api/query'"'"', true, '"'"'{}'"'"');'"
