import * as cheerio from 'cheerio';
import { ExtractedVideo, ExtractionResult } from '../ytdlp-handler';

// Helper to check if a string is a video URL
function findVideoUrlsInText(text: string): string[] {
  const urls: string[] = [];
  const regex = /https?:\/\/[^\s"'`<>]+?\.(?:mp4|m3u8|webm|mpd)(?:[?#][^\s"'`<>]*)?/gi;
  let match;
  while ((match = regex.exec(text)) !== null) {
    urls.push(match[0]);
  }
  return urls;
}

export async function cheerioScrapingPass(url: string): Promise<ExtractionResult | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      signal: AbortSignal.timeout(5000) // 5s timeout for fast pass
    });

    if (!response.ok) {
      return null;
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const videoUrls = new Set<string>();
    let title = $('title').text().trim() || $('meta[property="og:title"]').attr('content') || 'Generic Video';
    let thumbnail = $('meta[property="og:image"]').attr('content') || $('meta[name="twitter:image"]').attr('content') || '';

    // 1. og:video tags
    $('meta[property^="og:video"]').each((_, el) => {
      const content = $(el).attr('content');
      if (content && (content.startsWith('http://') || content.startsWith('https://'))) {
        videoUrls.add(content);
      }
    });

    // 2. video and source tags
    $('video source').each((_, el) => {
      const src = $(el).attr('src');
      if (src) videoUrls.add(new URL(src, url).href);
    });
    $('video').each((_, el) => {
      const src = $(el).attr('src');
      if (src) videoUrls.add(new URL(src, url).href);
    });

    // 3. JSON-LD VideoObject
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const text = $(el).text();
        const json = JSON.parse(text);
        
        const scanObject = (obj: any) => {
          if (!obj || typeof obj !== 'object') return;
          if (obj['@type'] === 'VideoObject') {
            if (obj.contentUrl) videoUrls.add(obj.contentUrl);
            if (obj.embedUrl) videoUrls.add(obj.embedUrl);
            if (obj.thumbnailUrl) thumbnail = obj.thumbnailUrl;
            if (obj.name) title = obj.name;
          }
          for (const key of Object.keys(obj)) {
            scanObject(obj[key]);
          }
        };

        if (Array.isArray(json)) {
          json.forEach(scanObject);
        } else {
          scanObject(json);
        }
      } catch {}
    });

    // 4. Regex scan scripts
    $('script').each((_, el) => {
      const text = $(el).text();
      const urls = findVideoUrlsInText(text);
      urls.forEach(u => videoUrls.add(u));
    });

    if (videoUrls.size === 0) {
      return null;
    }

    const videos: ExtractedVideo[] = [];
    for (const vUrl of videoUrls) {
      let ext = 'mp4';
      if (vUrl.includes('.m3u8')) ext = 'm3u8';
      else if (vUrl.includes('.webm')) ext = 'webm';
      else if (vUrl.includes('.mpd')) ext = 'mpd';

      const type = ext === 'm3u8' ? 'application/x-mpegURL' : ext === 'mpd' ? 'application/dash+xml' : `video/${ext}`;

      videos.push({
        quality: ext === 'm3u8' || ext === 'mpd' ? 'Adaptive' : 'Source',
        format: ext.toUpperCase(),
        url: vUrl,
        requiresMerge: false,
        type,
        formatId: ext
      });
    }

    return {
      title,
      thumbnail,
      sourcePlatform: 'generic',
      videos
    };
  } catch {
    return null;
  }
}
