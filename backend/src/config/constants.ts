import path from 'path';
import fs from 'fs';

export const PORT = process.env.PORT || 3000;
export const NODE_ENV = process.env.NODE_ENV || 'production';
export const REDIS_HOST = process.env.REDIS_HOST || '127.0.0.1';
export const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10);
export const REDIS_PASSWORD = process.env.REDIS_PASSWORD || '';
export const REDIS_TLS = process.env.REDIS_TLS === 'true' || REDIS_HOST.includes('upstash.io') || REDIS_HOST.includes('aivencloud.com');
export const JWT_SECRET = process.env.JWT_SECRET || 'super_secure_vidra_jwt_secret_change_me_in_production';

// Location to store downloaded / merged assets temporarilly
export const DOWNLOADS_DIR = path.resolve(process.env.DOWNLOADS_DIR || './temp_downloads');
if (!fs.existsSync(DOWNLOADS_DIR)) {
  fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
}

export const PUBLIC_HOST = process.env.PUBLIC_HOST || `http://localhost:${PORT}`;

// Extraction timing configurations
export const YTDLP_TIMEOUT_MS = 60000;
export const PUPPETEER_STAGE_TIMEOUT_MS = 10000;
export const REDIS_TTL_SEC = 600; // 10 minutes cache TTL

// Whitelisted domains that bypass generic scraper passes
export const YTDLP_ONLY_DOMAINS = [
  'youtube.com',
  'youtu.be',
  'instagram.com',
  'facebook.com',
  'tiktok.com',
  'twitter.com',
  'x.com',
  'vimeo.com',
  'twitch.tv',
  'dailymotion.com'
];

// SSRF Blacklist CIDRs (Private IPs)
export const SSRF_BLACKLIST_CIDRS = [
  '127.0.0.0/8',
  '10.0.0.0/8',
  '172.16.0.0/12',
  '192.168.0.0/16',
  '169.254.0.0/16',
  '::1/128',
  'fc00::/7',
  'fe80::/10'
];
