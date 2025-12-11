import Fastify from 'fastify';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Create Fastify instance
const server = Fastify({
  logger: true,
});

// Health check endpoint
server.get('/health', async () => {
  return { status: 'ok' };
});

// Start the server
const start = async () => {
  try {
    const port = Number(process.env.PORT) || 3000;
    await server.listen({ port, host: '0.0.0.0' });
    console.log(`Server is running on http://localhost:${port}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
