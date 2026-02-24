require('dotenv').config();
const Fastify = require('fastify');
const cors = require('@fastify/cors');
const jwt = require('@fastify/jwt');
const { Server: SocketIO } = require('socket.io');
const http = require('http');

const { createRedisClient } = require('./lib/redis');
const { createPool, initializeDatabase } = require('./lib/database');
const { LocationService } = require('./services/location');
const { MusicService } = require('./services/music');
const { NotificationService } = require('./services/notification');
const { RecommendationEngine } = require('./services/recommendation');
const { registerAuthRoutes } = require('./routes/auth');
const { registerMusicRoutes } = require('./routes/music');
const { registerConnectionRoutes } = require('./routes/connections');
const { registerDiscoveryRoutes } = require('./routes/discovery');
const { setupRealtimeHandlers } = require('./realtime/handlers');

async function start() {
  // ── Core infrastructure ──────────────────────────────────
  const redis = createRedisClient();
  const db = createPool();

  await initializeDatabase(db);
  console.log('✓ Database initialized');

  // ── Fastify + HTTP server ────────────────────────────────
  const fastify = Fastify({ logger: true });
  await fastify.register(cors, { origin: true });
  await fastify.register(jwt, { secret: process.env.JWT_SECRET || 'dev-secret' });

  // Auth decorator
  fastify.decorate('authenticate', async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch (err) {
      reply.status(401).send({ error: 'Unauthorized' });
    }
  });

  // ── Services ─────────────────────────────────────────────
  const locationService = new LocationService(redis, db);
  const musicService = new MusicService(redis, db);
  const notificationService = new NotificationService(redis, db);
  const recommendationEngine = new RecommendationEngine(redis, db);

  // Inject services into request context
  fastify.decorate('services', {
    location: locationService,
    music: musicService,
    notification: notificationService,
    recommendation: recommendationEngine,
  });

  // ── REST routes ──────────────────────────────────────────
  registerAuthRoutes(fastify);
  registerMusicRoutes(fastify);
  registerConnectionRoutes(fastify);
  registerDiscoveryRoutes(fastify);

  // Health check
  fastify.get('/health', async () => ({ status: 'ok', service: 'chord' }));

  // ── Start HTTP server ────────────────────────────────────
  await fastify.listen({ port: parseInt(process.env.PORT || '3000'), host: '0.0.0.0' });

  // ── Socket.IO (attach to the same HTTP server) ───────────
  const io = new SocketIO(fastify.server, {
    cors: { origin: '*' },
    transports: ['websocket', 'polling'],
  });

  setupRealtimeHandlers(io, { locationService, musicService, notificationService, redis });
  console.log(`✓ Chord server running on port ${process.env.PORT || 3000}`);
}

start().catch((err) => {
  console.error('Failed to start Chord server:', err);
  process.exit(1);
});
