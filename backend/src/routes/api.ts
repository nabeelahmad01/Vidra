import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { Queue } from 'bullmq';
import crypto from 'crypto';
import https from 'https';
import http from 'http';
import { URL } from 'url';
import path from 'path';
import fs from 'fs';
import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { queueConnection, queuePrefix } from '../queue/connection';
import { redisClient, getUrlHash } from '../queue/worker';
import { authenticateJWT, ssrfFilter } from '../middleware/security';
import { resolveManifestVariants } from '../extractors/generic/manifest-resolver';
import { JWT_SECRET, DOWNLOADS_DIR, PUBLIC_HOST, YTDLP_ONLY_DOMAINS } from '../config/constants';

const router = Router();

// Initialize BullMQ queues
const ytdlpQueue = new Queue('ytdlp-queue', { connection: queueConnection, prefix: queuePrefix });
const mergeQueue = new Queue('merge-queue', { connection: queueConnection, prefix: queuePrefix });

// 1. Rate Limiting Setup using Redis
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP or device to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({
    // @ts-ignore
    sendCommand: (...args: string[]) => redisClient.sendCommand(args),
  }),
  keyGenerator: (req: Request) => {
    // Rate limit by Device ID (from JWT) if available, fallback to IP address
    const authHeader = req.headers.authorization;
    if (authHeader) {
      try {
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        if (decoded && decoded.deviceId) {
          return `limit:device:${decoded.deviceId}`;
        }
      } catch {}
    }
    return `limit:ip:${req.ip}`;
  },
  message: { error: 'Too many requests. Please try again later.' }
});

// Device Registration Route
router.post('/device/register', (req: Request, res: Response) => {
  const { deviceId } = req.body;
  if (!deviceId || typeof deviceId !== 'string') {
    return res.status(400).json({ error: 'deviceId parameter is required' });
  }

  // Issue sign JWT token for device
  const token = jwt.sign({ deviceId }, JWT_SECRET, { expiresIn: '365d' });
  return res.status(200).json({ token });
});

// POST /extract - Start URL extraction
router.post('/extract', authenticateJWT, apiLimiter, ssrfFilter, async (req: Request, res: Response) => {
  const { url } = req.body;
  const hash = getUrlHash(url);
  const cacheKey = `vidra:cache:${hash}`;

  try {
    // Check cache
    const cachedData = await redisClient.get(cacheKey);
    if (cachedData) {
      console.log(`[api] Returning cached extraction for: ${url}`);
      return res.status(200).json({ status: 'completed', result: JSON.parse(cachedData) });
    }

    // Generate unique job ID
    const jobId = `ext_${crypto.randomUUID()}`;
    await redisClient.setEx(`vidra:job:${jobId}`, 600, JSON.stringify({ status: 'pending' }));

    // Add to yt-dlp Queue
    console.log(`[api] Enqueuing extraction job ${jobId} for: ${url}`);
    await ytdlpQueue.add('extract-ytdlp', { url, jobId }, { jobId });

    return res.status(202).json({ status: 'pending', jobId });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to queue extraction process' });
  }
});

// GET /extract/status/:jobId - Poll extraction progress
router.get('/extract/status/:jobId', authenticateJWT, async (req: Request, res: Response) => {
  const { jobId } = req.params;

  try {
    const jobState = await redisClient.get(`vidra:job:${jobId}`);
    if (!jobState) {
      return res.status(404).json({ error: 'Job not found or expired' });
    }

    return res.status(200).json(JSON.parse(jobState));
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to retrieve job status' });
  }
});

// GET /manifest/resolve - Fetch HLS/DASH variant listings
router.get('/manifest/resolve', authenticateJWT, ssrfFilter, async (req: Request, res: Response) => {
  const url = req.query.url as string;
  
  try {
    const variants = await resolveManifestVariants(url);
    return res.status(200).json({ variants });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to resolve manifest streams' });
  }
});

// POST /download/prepare - Prepare stream (merge audio/video if required)
router.post('/download/prepare', authenticateJWT, apiLimiter, async (req: Request, res: Response) => {
  const { url, formatId } = req.body;
  if (!url || !formatId) {
    return res.status(400).json({ error: 'url and formatId parameters are required' });
  }

  try {
    // 1. Check if the URL extraction metadata is cached
    const hash = getUrlHash(url);
    const cachedData = await redisClient.get(`vidra:cache:${hash}`);
    
    if (cachedData) {
      const extraction = JSON.parse(cachedData);
      const matchedVideo = extraction.videos?.find((v: any) => v.formatId === formatId);
      
      // If it is a progressive/direct stream, return it immediately
      if (matchedVideo && !matchedVideo.requiresMerge) {
        console.log(`[api] Direct stream available, skipping merge for: ${formatId}`);
        return res.status(200).json({ status: 'ready', url: matchedVideo.url });
      }
    }

    // 2. Queue merge job
    const mergeJobId = crypto.randomUUID();
    await redisClient.setEx(`vidra:merge:${mergeJobId}`, 3600, JSON.stringify({ status: 'pending' }));

    console.log(`[api] Enqueuing merge job ${mergeJobId} for: ${url} (format: ${formatId})`);
    await mergeQueue.add('merge-streams', { url, formatId, mergeJobId }, { jobId: mergeJobId });

    return res.status(202).json({ status: 'pending', mergeJobId });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to start merge processor' });
  }
});

// GET /download/prepare/status/:mergeJobId - Poll merge job status
router.get('/download/prepare/status/:mergeJobId', authenticateJWT, async (req: Request, res: Response) => {
  const { mergeJobId } = req.params;

  try {
    const mergeState = await redisClient.get(`vidra:merge:${mergeJobId}`);
    if (!mergeState) {
      return res.status(404).json({ error: 'Merge job not found or expired' });
    }

    const state = JSON.parse(mergeState);
    if (state.status === 'completed') {
      // Issue a short-lived download token (valid for 30 minutes)
      const downloadToken = jwt.sign({ filename: state.filename }, JWT_SECRET, { expiresIn: '30m' });
      state.downloadUrl = `${PUBLIC_HOST}/api/download/file/${state.filename}?token=${downloadToken}`;
    }

    return res.status(200).json(state);
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to retrieve merge status' });
  }
});

// GET /download/file/:filename - Secure file download endpoint
router.get('/download/file/:filename', async (req: Request, res: Response) => {
  const { filename } = req.params;
  const { token } = req.query;

  if (!token || typeof token !== 'string') {
    return res.status(401).json({ error: 'Download token is required' });
  }

  try {
    // Verify download token
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    if (decoded.filename !== filename) {
      return res.status(403).json({ error: 'Invalid download token metadata' });
    }

    const filePath = path.join(DOWNLOADS_DIR, filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Requested file not found or expired' });
    }

    // Serve the file. The periodic hourly cleanup cron will handle temporary file deletion.
    return res.download(filePath, filename);
  } catch (err) {
    return res.status(403).json({ error: 'Expired or invalid download token' });
  }
});

// Periodic task to delete merged files older than 1 hour
setInterval(() => {
  fs.readdir(DOWNLOADS_DIR, (err, files) => {
    if (err) return;
    const now = Date.now();
    const oneHour = 3600 * 1000;

    files.forEach(file => {
      const filePath = path.join(DOWNLOADS_DIR, file);
      fs.stat(filePath, (statErr, stats) => {
        if (statErr) return;
        if (now - stats.mtimeMs > oneHour) {
          fs.unlink(filePath, () => {
            console.log(`[cleanup] Deleted expired temporary file: ${file}`);
          });
        }
      });
    });
  });
}, 10 * 60 * 1000); // Check every 10 minutes

// 6. Proxy direct video streams to bypass YouTube 403 Forbidden limits
router.get('/download/proxy', ssrfFilter, (req: Request, res: Response) => {
  const { url, filename } = req.query;
  if (!url) {
    return res.status(400).send('URL is required');
  }

  const targetUrl = url as string;
  const targetFilename = (filename as string) || 'video.mp4';

  try {
    const parsedUrl = new URL(targetUrl);
    const client = parsedUrl.protocol === 'https:' ? https : http;

    const requestOptions = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Accept-Encoding': 'identity',
        'Connection': 'keep-alive'
      }
    };

    const proxyReq = client.get(targetUrl, requestOptions, (proxyRes) => {
      // Check for non-200 responses to prevent piping empty error pages
      if (proxyRes.statusCode !== 200) {
        console.error(`[Proxy Download] Remote server returned status ${proxyRes.statusCode}`);
        res.status(proxyRes.statusCode || 502).send(`Download failed. Remote server returned status ${proxyRes.statusCode}`);
        return;
      }

      // Set response headers to force download attachment
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(targetFilename)}"`);
      res.setHeader('Content-Type', proxyRes.headers['content-type'] || 'video/mp4');
      if (proxyRes.headers['content-length']) {
        res.setHeader('Content-Length', proxyRes.headers['content-length']);
      }
      
      proxyRes.pipe(res);
    });

    proxyReq.on('error', (err) => {
      console.error('[Proxy Download] Native stream fail:', err.message);
      res.status(500).send('Failed to stream download');
    });
  } catch (err: any) {
    console.error('[Proxy Download] Invalid URL parser error:', err.message);
    res.status(400).send('Invalid video URL provided');
  }
});

export default router;
