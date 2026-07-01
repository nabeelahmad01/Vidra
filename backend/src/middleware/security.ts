import { Request, Response, NextFunction } from 'express';
import dns from 'dns';
import jwt from 'jsonwebtoken';
import { JWT_SECRET, SSRF_BLACKLIST_CIDRS } from '../config/constants';

// Helper to check if an IP falls in private ranges
export function isPrivateIP(ip: string): boolean {
  // Normalize IPv6 mapped IPv4 address
  if (ip.startsWith('::ffff:')) {
    ip = ip.substring(7);
  }

  // IPv4 check
  const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const match = ip.match(ipv4Regex);
  if (match) {
    const octets = match.slice(1).map(Number);
    // Validate octet values
    if (octets.some(o => o > 255)) return true;

    // 127.0.0.0/8
    if (octets[0] === 127) return true;
    // 10.0.0.0/8
    if (octets[0] === 10) return true;
    // 172.16.0.0/12
    if (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) return true;
    // 192.168.0.0/16
    if (octets[0] === 192 && octets[1] === 168) return true;
    // 169.254.0.0/16
    if (octets[0] === 169 && octets[1] === 254) return true;
    // 0.0.0.0/8
    if (octets[0] === 0) return true;

    return false;
  }

  // IPv6 check
  if (ip === '::1' || ip === '0:0:0:0:0:0:0:1') return true;
  if (ip.toLowerCase().startsWith('fe80:') || ip.toLowerCase().startsWith('fc00:') || ip.toLowerCase().startsWith('fd00:')) {
    return true;
  }

  return false;
}

// SSRF Validation utility
export async function validateURL(urlStr: string): Promise<boolean> {
  try {
    const parsed = new URL(urlStr);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return false;
    }

    const hostname = parsed.hostname;
    // Fast path: check if hostname is direct IP
    if (isPrivateIP(hostname)) {
      return false;
    }

    if (hostname.toLowerCase() === 'localhost') {
      return false;
    }

    // Resolve DNS records to check IP address of the target host
    const addresses = await new Promise<string[]>((resolve, reject) => {
      dns.resolve(hostname, (err, addresses) => {
        if (err) {
          // If we can't resolve, fallback to dns.lookup
          dns.lookup(hostname, (err2, address) => {
            if (err2 || !address) resolve([]);
            else resolve([address]);
          });
        } else {
          resolve(addresses);
        }
      });
    });

    if (addresses.length === 0) {
      return false;
    }

    for (const addr of addresses) {
      if (isPrivateIP(addr)) {
        return false;
      }
    }

    return true;
  } catch {
    return false;
  }
}

// SSRF middleware wrapper
export async function ssrfFilter(req: Request, res: Response, next: NextFunction): Promise<void> {
  const url = req.body.url || req.query.url;
  if (!url || typeof url !== 'string') {
    res.status(400).json({ error: 'Missing or invalid URL parameter' });
    return;
  }

  const isValid = await validateURL(url);
  if (!isValid) {
    res.status(403).json({ error: 'Forbidden URL' });
    return;
  }
  next();
}

// JWT Auth Middleware
export function authenticateJWT(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    res.status(401).json({ error: 'Authorization header required' });
    return;
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    res.status(401).json({ error: 'Bearer token format required' });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    (req as any).user = decoded;
    next();
  } catch (err) {
    res.status(403).json({ error: 'Invalid or expired access token' });
  }
}
