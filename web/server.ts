// Simple write API proxy for bidirectional sync with ElectricSQL
// This server handles writes to Postgres, which Electric then syncs to clients

import { createServer } from 'http';
import { parse } from 'url';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:changeme@localhost:5432/aidashboard',
});

const PORT = process.env.API_PORT || 3001;

const server = createServer(async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const { pathname } = parse(req.url || '', true);

  // Health check
  if (pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
    return;
  }

  // Sources API
  if (pathname?.startsWith('/api/sources')) {
    try {
      let body = '';
      for await (const chunk of req) {
        body += chunk;
      }

      if (req.method === 'POST' && pathname === '/api/sources') {
        // Create source
        const data = JSON.parse(body);
        const { name, type, medium, ingestUrl, active, frequency, meta } = data;

        const result = await pool.query(
          `INSERT INTO sources (name, type, medium, ingest_url, active, frequency, meta, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
           ON CONFLICT (name, type) DO UPDATE SET
             medium = EXCLUDED.medium,
             ingest_url = EXCLUDED.ingest_url,
             active = EXCLUDED.active,
             frequency = EXCLUDED.frequency,
             meta = EXCLUDED.meta,
             updated_at = NOW()
           RETURNING *`,
          [name, type, medium, ingestUrl, active ?? true, frequency, JSON.stringify(meta || {})]
        );

        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result.rows[0]));
        return;
      }

      if (req.method === 'PUT' || req.method === 'PATCH') {
        // Update source
        const idMatch = pathname.match(/\/api\/sources\/(\d+)/);
        if (!idMatch) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid source ID' }));
          return;
        }

        const id = parseInt(idMatch[1], 10);
        const data = JSON.parse(body);
        const { name, type, medium, ingestUrl, active, frequency, meta } = data;

        const result = await pool.query(
          `UPDATE sources SET
             name = COALESCE($1, name),
             type = COALESCE($2, type),
             medium = COALESCE($3, medium),
             ingest_url = COALESCE($4, ingest_url),
             active = COALESCE($5, active),
             frequency = COALESCE($6, frequency),
             meta = COALESCE($7, meta),
             updated_at = NOW()
           WHERE id = $8
           RETURNING *`,
          [name, type, medium, ingestUrl, active, frequency, meta ? JSON.stringify(meta) : null, id]
        );

        if (result.rows.length === 0) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Source not found' }));
          return;
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result.rows[0]));
        return;
      }

      if (req.method === 'DELETE') {
        // Delete source
        const idMatch = pathname.match(/\/api\/sources\/(\d+)/);
        if (!idMatch) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid source ID' }));
          return;
        }

        const id = parseInt(idMatch[1], 10);
        const result = await pool.query('DELETE FROM sources WHERE id = $1 RETURNING *', [id]);

        if (result.rows.length === 0) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Source not found' }));
          return;
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ deleted: true, source: result.rows[0] }));
        return;
      }

      res.writeHead(405, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Method not allowed' }));
    } catch (error) {
      console.error('API Error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }));
    }
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, () => {
  console.log(`Write API running on http://localhost:${PORT}`);
  console.log(`Database: ${process.env.DATABASE_URL || 'postgresql://postgres:changeme@localhost:5432/aidashboard'}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing server...');
  server.close();
  await pool.end();
  process.exit(0);
});
