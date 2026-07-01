import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { YTDLP_TIMEOUT_MS } from '../config/constants';

export interface ExtractedVideo {
  quality: string;
  format: string;
  url: string;
  sizeEstimate?: number;
  type: string; // e.g. 'video/mp4', 'video/webm'
  requiresMerge: boolean;
  formatId: string;
}

export interface ExtractionResult {
  title: string;
  thumbnail: string;
  sourcePlatform: 'yt-dlp' | 'generic';
  videos: ExtractedVideo[];
}

// Find yt-dlp path: check local bin first, then system PATH
export function getDlpPath(): string {
  const localPath = path.resolve(__dirname, '../../bin/yt-dlp');
  const localExePath = path.resolve(__dirname, '../../bin/yt-dlp.exe');
  
  if (fs.existsSync(localExePath)) {
    return localExePath;
  }
  if (fs.existsSync(localPath)) {
    return localPath;
  }
  
  // Return name for PATH resolution
  return process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';
}

export async function extractWithYtdlp(url: string): Promise<ExtractionResult> {
  const dlpPath = getDlpPath();
  const args = [
    '--dump-json',
    '--no-warnings',
    '--no-playlist',
    '--client-impersonate', 'chrome',
    '--extractor-args', 'youtube:player_client=ios,web',
    url
  ];

  return new Promise((resolve, reject) => {
    const process = spawn(dlpPath, args);
    let stdoutData = '';
    let stderrData = '';

    const timeout = setTimeout(() => {
      process.kill();
      reject(new Error('Extraction timed out after 15 seconds'));
    }, YTDLP_TIMEOUT_MS);

    process.stdout.on('data', (data) => {
      stdoutData += data.toString();
    });

    process.stderr.on('data', (data) => {
      stderrData += data.toString();
    });

    process.on('close', (code) => {
      clearTimeout(timeout);
      if (code !== 0) {
        // Normalize errors gracefully to prevent leaking path info
        const isUnsupported = stderrData.includes('Unsupported URL') || stderrData.includes('not supported');
        if (isUnsupported) {
          reject(new Error('UNSUPPORTED_URL'));
        } else {
          const cleanError = stderrData.split('\n')[0] || 'Unknown yt-dlp error';
          reject(new Error(`YTDLP_ERROR: ${cleanError}`));
        }
        return;
      }

      try {
        const data = JSON.parse(stdoutData);
        const title = data.title || 'Untitled Video';
        const thumbnail = data.thumbnail || data.thumbnails?.[0]?.url || '';
        
        const videos: ExtractedVideo[] = [];

        if (Array.isArray(data.formats)) {
          for (const fmt of data.formats) {
            // We want formats that contain video stream
            const hasVideo = fmt.vcodec && fmt.vcodec !== 'none';
            if (!hasVideo) continue;

            const hasAudio = fmt.acodec && fmt.acodec !== 'none';
            const requiresMerge = !hasAudio;

            const width = fmt.width || 0;
            const height = fmt.height || 0;
            let quality = height ? `${height}p` : `${width}x${height}`;
            if (!height && !width) quality = 'Unknown';

            const sizeEstimate = fmt.filesize || fmt.filesize_approx || undefined;
            const ext = fmt.ext || 'mp4';
            const type = ext === 'webm' ? 'video/webm' : 'video/mp4';

            videos.push({
              quality,
              format: fmt.format_note || fmt.format || ext,
              url: fmt.url,
              sizeEstimate,
              type,
              requiresMerge,
              formatId: fmt.format_id
            });
          }
        }

        // Sort videos by quality/resolution descending
        videos.sort((a, b) => {
          const qA = parseInt(a.quality) || 0;
          const qB = parseInt(b.quality) || 0;
          return qB - qA;
        });

        resolve({
          title,
          thumbnail,
          sourcePlatform: 'yt-dlp',
          videos
        });
      } catch (err) {
        reject(new Error('Failed to parse yt-dlp metadata output'));
      }
    });
  });
}
