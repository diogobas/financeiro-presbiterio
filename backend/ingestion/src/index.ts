import Fastify from 'fastify';
import multipart from '@fastify/multipart';
import dotenv from 'dotenv';
import { initializePool, closePool, runMigrations } from './config/db';
import importsRoute from './http/importsRoute';
import importStatusRoute from './http/importStatusRoute';

// Load environment variables
dotenv.config();

// Create Fastify instance
const server = Fastify({
  logger: true,
});

// Register multipart plugin
server.register(multipart, {
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB
  },
});

// Health check endpoint
server.get('/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

// Database health check endpoint
server.get('/health/db', async () => {
  try {
    const { query } = await import('./config/db');
    const result = await query('SELECT NOW()');
    return {
      status: 'ok',
      database: 'connected',
      timestamp: result[0].now,
    };
  } catch (err) {
    return {
      status: 'error',
      database: 'disconnected',
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
});

// Register routes
server.route(importsRoute);
server.route(importStatusRoute);

// Start the server
const start = async () => {
  try {
    // Initialize database connection pool
    console.log('Initializing database connection pool...');
    await initializePool();

    // Run migrations if enabled
    if (process.env.ENABLE_MIGRATIONS_ON_STARTUP === 'true') {
      console.log('Running database migrations...');
      await runMigrations();
    }

    const port = Number(process.env.PORT) || 3000;
    await server.listen({ port, host: '0.0.0.0' });
    console.log(`✓ Server is running on http://localhost:${port}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

// Graceful shutdown
const shutdown = async () => {
  console.log('\nShutting down gracefully...');
  await server.close();
  await closePool();
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

start();
