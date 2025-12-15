import Fastify from 'fastify';
import multipart from '@fastify/multipart';
import cors from '@fastify/cors';
import dotenv from 'dotenv';
import { initializePool, closePool, runMigrations } from './config/db';
import importsRoute from './http/importsRoute';
import importStatusRoute, { getUploadedMonthsHandler } from './http/importStatusRoute';
import { createRulesRoute } from './http/rulesRoute';
import { registerOverrideRoutes } from './http/overrideRoute';
import { registerUnclassifiedRoutes } from './http/unclassifiedRoute';
import { PostgresRuleRepository } from './infrastructure/repositories';

// Load environment variables
dotenv.config();

// Create Fastify instance
const server = Fastify({
  logger: true,
});

// Register CORS plugin
server.register(cors, {
  origin: true, // Allow all origins in development; restrict in production
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
if (Array.isArray(importsRoute)) {
  for (const route of importsRoute) {
    server.route(route);
  }
} else {
  server.route(importsRoute);
}

// Register /imports/months BEFORE /imports/:id  to avoid parameter matching
server.route({
  method: 'GET' as const,
  url: '/imports/months',
  handler: getUploadedMonthsHandler,
});

// Register the /:id route (must be after /months)
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

    // Register rules route
    const ruleRepository = new PostgresRuleRepository();
    await createRulesRoute(server, ruleRepository);

    // Register unclassified and override routes for manual review
    await registerUnclassifiedRoutes(server);
    await registerOverrideRoutes(server);

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
