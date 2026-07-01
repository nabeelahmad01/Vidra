import dotenv from 'dotenv';
// Load environment variables first
dotenv.config();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import fs from 'fs';
import apiRouter from './routes/api';
import webRouter from './routes/web';
import './queue/worker'; // Start BullMQ workers
import { PORT, NODE_ENV } from './config/constants';
import { initializeYtdlp } from './services/updater';

const app = express();

// Enable security headers (bypassing CSP to allow Adsense and inline extract scripts)
app.use(helmet({
  contentSecurityPolicy: false
}));

// CORS configuration (allow requests from the app client or all origins for development)
app.use(cors({
  origin: '*', // Set to specific domain/IP in production if required
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static elements
app.use('/public', express.static(path.join(__dirname, '../../public')));

// Configure EJS view templates
app.set('view engine', 'ejs');
app.set('views', fs.existsSync(path.join(__dirname, 'views')) ? path.join(__dirname, 'views') : path.join(__dirname, '../src/views'));

// Mount Web & API Routers
app.use('/', webRouter);
app.use('/api', apiRouter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', node_env: NODE_ENV });
});

// Centralized error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('[Error Middleware]', err.stack || err);
  
  // Don't leak raw paths or errors in production
  const message = NODE_ENV === 'production' 
    ? 'An internal server error occurred' 
    : err.message || 'Internal Server Error';

  res.status(500).json({ error: message });
});

// Start Express Server and trigger yt-dlp initialization
app.listen(PORT, async () => {
  console.log(`[server] Vidra backend active on port ${PORT} in ${NODE_ENV} mode.`);
  
  try {
    await initializeYtdlp();
  } catch (err) {
    console.error('[server] yt-dlp binary initialization failed:', err);
  }
});
