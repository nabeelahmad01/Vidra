import { Worker, Queue, Job } from 'bullmq';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { spawn, execFile } from 'child_process';
import { createClient } from 'redis';
import ffmpegStatic from 'ffmpeg-static';
import { queueConnection, queuePrefix } from './connection';
import { extractWithYtdlp, getDlpPath } from '../extractors/ytdlp-handler';
import { cheerioScrapingPass } from '../extractors/generic/cheerio-pass';
import { puppeteerScrapingPass } from '../extractors/generic/puppeteer-pass';
import { REDIS_HOST, REDIS_PORT, REDIS_PASSWORD, REDIS_TLS, REDIS_TTL_SEC, DOWNLOADS_DIR } from '../config/constants';

export const redisClient = createClient({
  socket: {
    host: REDIS_HOST,
    port: REDIS_PORT,
    tls: REDIS_TLS
  },
  username: 'default',
  password: REDIS_PASSWORD
});
redisClient.connect().catch(console.error);

// Define queues so workers can enqueue follow-up steps
export const puppeteerQueue = new Queue('puppeteer-queue', { connection: queueConnection, prefix: queuePrefix });
export const mergeQueue = new Queue('merge-queue', { connection: queueConnection, prefix: queuePrefix });

// Helper to hash URL for caching
export function getUrlHash(url: string): string {
  return crypto.createHash('sha256').update(url).digest('hex');
}

// 1. yt-dlp Worker (Fast Queue)
export const ytdlpWorker = new Worker(
  'ytdlp-queue',
  async (job: Job) => {
    const { url, jobId } = job.data;
    const cacheKey = `vidra:cache:${getUrlHash(url)}`;

    try {
      // Step 1: Run yt-dlp
      console.log(`[ytdlpWorker] Processing job ${jobId} for URL: ${url}`);
      const result = await extractWithYtdlp(url);
      
      // Cache results and update status
      await redisClient.setEx(cacheKey, REDIS_TTL_SEC, JSON.stringify(result));
      await redisClient.setEx(`vidra:job:${jobId}`, REDIS_TTL_SEC, JSON.stringify({ status: 'completed', result }));
      return result;
    } catch (err: any) {
      if (err.message === 'UNSUPPORTED_URL') {
        console.log(`[ytdlpWorker] yt-dlp unsupported URL. Falling back to Cheerio fast pass.`);
        
        // Step 2: Cheerio Fast Pass
        const cheerioResult = await cheerioScrapingPass(url);
        if (cheerioResult) {
          await redisClient.setEx(cacheKey, REDIS_TTL_SEC, JSON.stringify(cheerioResult));
          await redisClient.setEx(`vidra:job:${jobId}`, REDIS_TTL_SEC, JSON.stringify({ status: 'completed', result: cheerioResult }));
          return cheerioResult;
        }

        // Step 3: Enqueue into heavy Puppeteer queue
        console.log(`[ytdlpWorker] Cheerio found nothing. Enqueuing to Puppeteer queue.`);
        await puppeteerQueue.add('puppeteer-extract', { url, jobId }, { jobId });
        await redisClient.setEx(`vidra:job:${jobId}`, REDIS_TTL_SEC, JSON.stringify({ status: 'processing', step: 'puppeteer' }));
        return { status: 'delegated_to_puppeteer' };
      } else {
        console.error(`[ytdlpWorker] Failed extraction: ${err.message}`);
        await redisClient.setEx(`vidra:job:${jobId}`, REDIS_TTL_SEC, JSON.stringify({ status: 'failed', error: err.message }));
        throw err;
      }
    }
  },
  { connection: queueConnection, concurrency: 5, prefix: queuePrefix }
);

// 2. Puppeteer Worker (Heavy Queue)
export const puppeteerWorker = new Worker(
  'puppeteer-queue',
  async (job: Job) => {
    const { url, jobId } = job.data;
    const cacheKey = `vidra:cache:${getUrlHash(url)}`;

    try {
      console.log(`[puppeteerWorker] Running browser extraction for job ${jobId}`);
      const result = await puppeteerScrapingPass(url);
      
      if (result) {
        await redisClient.setEx(cacheKey, REDIS_TTL_SEC, JSON.stringify(result));
        await redisClient.setEx(`vidra:job:${jobId}`, REDIS_TTL_SEC, JSON.stringify({ status: 'completed', result }));
        return result;
      }

      throw new Error('No video sources detected on webpage');
    } catch (err: any) {
      console.error(`[puppeteerWorker] Failed browser pass: ${err.message}`);
      await redisClient.setEx(`vidra:job:${jobId}`, REDIS_TTL_SEC, JSON.stringify({ status: 'failed', error: err.message }));
      throw err;
    }
  },
  { connection: queueConnection, concurrency: 2, prefix: queuePrefix } // Keep low to limit browser resource usage
);

function downloadStream(url: string, formatId: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const dlpPath = getDlpPath();
    const args = [
      '-f', formatId,
      '-o', destPath,
      url
    ];

    console.log(`[downloadStream] Running: ${dlpPath} ${args.join(' ')}`);

    const child = spawn(dlpPath, args);
    let stderrData = '';

    child.stderr.on('data', (data) => {
      stderrData += data.toString();
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        console.error(`[downloadStream] yt-dlp failed with code ${code}. Error: ${stderrData}`);
        reject(new Error(`yt-dlp download failed with code ${code}: ${stderrData.split('\n')[0]}`));
      }
    });
  });
}

// 3. Merging Worker
export const mergeWorker = new Worker(
  'merge-queue',
  async (job: Job) => {
    const { url, formatId, mergeJobId } = job.data;
    const outputFilename = `vidra_merged_${mergeJobId}.mp4`;
    const outputPath = path.join(DOWNLOADS_DIR, outputFilename);

    const tempVideoPath = path.join(DOWNLOADS_DIR, `temp_v_${mergeJobId}.mp4`);
    const tempAudioPath = path.join(DOWNLOADS_DIR, `temp_a_${mergeJobId}.m4a`);

    try {
      console.log(`[mergeWorker] Starting merge process for ${url} (format: ${formatId})`);
      await redisClient.setEx(`vidra:merge:${mergeJobId}`, REDIS_TTL_SEC, JSON.stringify({ status: 'downloading' }));

      // Download both video stream and best audio stream in parallel
      await Promise.all([
        downloadStream(url, formatId, tempVideoPath),
        downloadStream(url, 'bestaudio', tempAudioPath)
      ]);

      console.log(`[mergeWorker] Downloads completed. Starting ffmpeg merge.`);
      await redisClient.setEx(`vidra:merge:${mergeJobId}`, REDIS_TTL_SEC, JSON.stringify({ status: 'merging' }));

      // Run FFmpeg to merge the streams
      await new Promise<void>((resolve, reject) => {
        if (!ffmpegStatic) {
          return reject(new Error('ffmpeg-static binary path not found'));
        }
        
        const args = [
          '-y',
          '-i', tempVideoPath,
          '-i', tempAudioPath,
          '-c:v', 'copy',
          '-c:a', 'aac',
          '-map', '0:v:0',
          '-map', '1:a:0',
          outputPath
        ];

        execFile(ffmpegStatic, args, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      console.log(`[mergeWorker] Merge completed successfully: ${outputFilename}`);
      const fileData = {
        status: 'completed',
        filename: outputFilename,
        expiresAt: Date.now() + 3600 * 1000 // 1 hour expiration
      };
      
      await redisClient.setEx(`vidra:merge:${mergeJobId}`, REDIS_TTL_SEC, JSON.stringify(fileData));
      return fileData;
    } catch (err: any) {
      console.error(`[mergeWorker] Merge failed: ${err.message}`);
      await redisClient.setEx(`vidra:merge:${mergeJobId}`, REDIS_TTL_SEC, JSON.stringify({ status: 'failed', error: err.message }));
      throw err;
    } finally {
      // Clean up temporary segment files
      try {
        if (fs.existsSync(tempVideoPath)) fs.unlinkSync(tempVideoPath);
        if (fs.existsSync(tempAudioPath)) fs.unlinkSync(tempAudioPath);
      } catch {}
    }
  },
  { connection: queueConnection, concurrency: 2, prefix: queuePrefix }
);
