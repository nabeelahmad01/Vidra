import puppeteer, { Browser, Page } from 'puppeteer';
import { ExtractedVideo, ExtractionResult } from '../ytdlp-handler';
import { PUPPETEER_STAGE_TIMEOUT_MS } from '../../config/constants';

class PuppeteerBrowserPool {
  private browser: Browser | null = null;

  private async getBrowser(): Promise<Browser> {
    if (this.browser && this.browser.connected) {
      return this.browser;
    }

    // Launch reusable browser
    this.browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu'
      ]
    });

    return this.browser;
  }

  public async acquirePage(): Promise<Page> {
    const browser = await this.getBrowser();
    return await browser.newPage();
  }

  public async releasePage(page: Page): Promise<void> {
    if (page && !page.isClosed()) {
      try {
        await page.close();
      } catch {}
    }
  }

  public async shutdown(): Promise<void> {
    if (this.browser) {
      try {
        await this.browser.close();
      } catch {}
      this.browser = null;
    }
  }
}

export const browserPool = new PuppeteerBrowserPool();

export async function puppeteerScrapingPass(url: string): Promise<ExtractionResult | null> {
  let page: Page | null = null;
  const videoUrls = new Set<string>();
  let title = 'Dynamic Video';
  let thumbnail = '';

  try {
    page = await browserPool.acquirePage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Enable response capture to catch media requests
    page.on('response', (response) => {
      const responseUrl = response.url();
      const contentType = response.headers()['content-type'] || '';
      
      const isVideoType = contentType.startsWith('video/') || 
                          contentType.includes('mpegurl') || 
                          contentType.includes('dash+xml');
                          
      const hasVideoExtension = /\.(mp4|m3u8|webm|mpd)(?:\?.*)?$/i.test(responseUrl);

      if (isVideoType || hasVideoExtension) {
        videoUrls.add(responseUrl);
      }
    });

    // Load page with timeout
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: PUPPETEER_STAGE_TIMEOUT_MS
    });

    title = await page.title();
    thumbnail = await page.evaluate(() => {
      const meta = document.querySelector('meta[property="og:image"]');
      if (meta) return meta.getAttribute('content') || '';
      return '';
    });

    // Check for iframes and scan them recursively
    const iframeSrcs = await page.evaluate(() => {
      const frames = Array.from(document.querySelectorAll('iframe')) as HTMLIFrameElement[];
      return frames
        .map((f: HTMLIFrameElement) => f.getAttribute('src'))
        .filter((src): src is string => !!src && src.startsWith('http'));
    });

    // Scan top 3 iframes to prevent getting stuck
    const processFrame = async (frameUrl: string) => {
      if (!page) return;
      try {
        const framePage = await browserPool.acquirePage();
        framePage.on('response', (resp) => {
          const u = resp.url();
          const ct = resp.headers()['content-type'] || '';
          if (ct.startsWith('video/') || u.includes('.m3u8') || u.includes('.mpd')) {
            videoUrls.add(u);
          }
        });
        await framePage.goto(frameUrl, {
          waitUntil: 'domcontentloaded',
          timeout: 5000
        });
        await browserPool.releasePage(framePage);
      } catch {}
    };

    await Promise.all(iframeSrcs.slice(0, 3).map(src => processFrame(src)));

    if (videoUrls.size === 0) {
      const domVideoSources = await page.evaluate(() => {
        const srcs: string[] = [];
        (document.querySelectorAll('video') as NodeListOf<HTMLVideoElement>).forEach(v => {
          const src = v.getAttribute('src');
          if (src) srcs.push(src);
        });
        (document.querySelectorAll('video source') as NodeListOf<HTMLSourceElement>).forEach(s => {
          const src = s.getAttribute('src');
          if (src) srcs.push(src);
        });
        return srcs;
      });

      domVideoSources.forEach(s => {
        if (s.startsWith('http')) {
          videoUrls.add(s);
        } else {
          videoUrls.add(new URL(s, url).href);
        }
      });
    }

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

  } catch (error) {
    return null;
  } finally {
    if (page) {
      await browserPool.releasePage(page);
    }
  }
}
