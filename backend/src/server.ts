import express from 'express';
import http from 'http';
import cors from 'cors';
import mqtt from 'mqtt';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import dotenv from 'dotenv';
import { validateTelemetryPayload } from './telemetry/validator';
import { upsertSeat, setSeatServicePrisma } from './services/seatService';
import { setupWebSocket, broadcastSeatUpdate } from './websocket/broadcaster';
import authRouter, { setAuthPrisma } from './routes/auth';
import adminAuthRouter, { setAdminAuthPrisma } from './routes/adminAuth';
import { createSeatsRouter } from './routes/seats';
import { createMenuRouter } from './routes/menu';
import { createAnalyticsRouter } from './routes/analytics';
import { createOrdersRouter } from './routes/orders';
import { createInventoryRouter } from './routes/inventory';
import { seedAdminAccount } from './services/adminSeed';

dotenv.config();

const app = express();
const server = http.createServer(app);

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/vokafe?schema=public';
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// Initialize service modules with the shared Prisma client.
setSeatServicePrisma(prisma);
setAuthPrisma(prisma);
setAdminAuthPrisma(prisma);

// Setup WebSocket broadcaster with CORS and initial state emission
const io = setupWebSocket(server, prisma);

// Middleware — CORS accepts a comma-separated list of origins from
// CORS_ORIGIN. In dev (NODE_ENV !== 'production') we allow all origins.
const corsOrigins =
  process.env.NODE_ENV === 'production' && process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((s) => s.trim()).filter(Boolean)
    : true;
app.use(cors({ origin: corsOrigins, credentials: true }));
app.use(express.json());

// Basic Route
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'VOKA-SEAT Backend' });
});

// --- Auth Routes -----------------------------------------------------
// /api/auth/login + /api/auth/register   → customer JWT (role=customer)
// /api/auth/admin/login                  → admin JWT    (role=admin)
app.use('/api/auth', authRouter);
app.use('/api/auth/admin', adminAuthRouter);

// --- Public REST APIs -----------------------------------------------
app.use('/api/seats', createSeatsRouter(prisma));
app.use('/api/menu', createMenuRouter(prisma));

// --- Mixed-auth APIs ------------------------------------------------
// Orders: POST is optional-auth (Property 20). Other routes inside
// `createOrdersRouter` apply customer or admin middleware per-route.
app.use('/api/orders', createOrdersRouter(prisma));

// --- Admin-only APIs (role=admin guard inside each router) ----------
app.use('/api/inventory', createInventoryRouter(prisma));
app.use('/api/analytics', createAnalyticsRouter(prisma));

// --- MQTT Setup -----------------------------------------------------
const MQTT_BROKER = process.env.MQTT_BROKER || 'mqtt://test.mosquitto.org';
const MQTT_TOPIC = 'vokafe/iot/telemetry';

const mqttClient = mqtt.connect(MQTT_BROKER);

mqttClient.on('connect', () => {
  console.log(`📡 Connected to MQTT Broker: ${MQTT_BROKER}`);
  mqttClient.subscribe(MQTT_TOPIC, (err) => {
    if (!err) {
      console.log(`✅ Subscribed to topic: ${MQTT_TOPIC}`);
    } else {
      console.error(`❌ MQTT Subscribe Error:`, err);
    }
  });
});

mqttClient.on('message', async (topic, message) => {
  if (topic !== MQTT_TOPIC) return;

  const result = validateTelemetryPayload(message);
  if (!result.valid) {
    console.error(`❌ Invalid telemetry payload: ${result.error}`);
    return;
  }

  const { id_kursi, status } = result.payload;
  console.log(`📥 Received Telemetry -> Seat ${id_kursi}: Status ${status}`);

  try {
    const updatedSeat = await upsertSeat(id_kursi, status);
    broadcastSeatUpdate(io, updatedSeat);
  } catch (dbError) {
    console.error(`⚠️ Database error for seat ${id_kursi}:`, dbError);
    return;
  }
});

const PORT = process.env.PORT || 4000;

// Seed the admin account on boot from ADMIN_USERNAME / ADMIN_PASSWORD,
// then start listening. We block the listen() until the seeder resolves
// so the server never accepts admin login requests against an empty
// AdminUser table.
async function bootstrap() {
  try {
    const seedResult = await seedAdminAccount(prisma);
    console.log(
      `🔐 Admin account ${seedResult.created ? 'created' : 'refreshed'}: username="${seedResult.username}"`,
    );
  } catch (err) {
    console.error('❌ Failed to seed admin account:', err);
    process.exit(1);
  }

  server.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });
}

void bootstrap();
