import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { authRouter } from './auth.js';
import { chatRouter } from './proxy.js';
import { planRouter } from './plan.js';

const PORT = parseInt(process.env.PORT || '3001', 10);
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:1420,tauri://localhost')
  .split(',')
  .map(s => s.trim());

const app = express();

app.use(helmet());
app.use(cors({
  origin: ALLOWED_ORIGINS,
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Bento-Token', 'X-Session-Id'],
}));
app.use(express.json());

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', version: '1.0.0', timestamp: Date.now() });
});

// Routes
app.use('/api/auth', authRouter);
app.use('/api/chat', chatRouter);
app.use('/api/plan', planRouter);

app.listen(PORT, () => {
  console.log(`[bento-proxy] server running on port ${PORT}`);
  console.log(`[bento-proxy] allowed origins: ${ALLOWED_ORIGINS.join(', ')}`);
});
