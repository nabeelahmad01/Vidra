import fs from 'fs';
import path from 'path';
import { DOWNLOADS_DIR } from '../config/constants';

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  content: string; // HTML or Markdown format
  summary: string;
  coverImage: string;
  createdAt: number;
  keywords: string;
}

const DB_FILE = path.join(DOWNLOADS_DIR, 'blogs.json');

// Sample Seed Articles for immediate SEO value and Adsense readiness
const SEED_POSTS: BlogPost[] = [
  {
    id: 'seed-1',
    title: 'How to Download Web Videos Safely in 2026',
    slug: 'how-to-download-web-videos-safely',
    summary: 'A complete guide to downloading and storing web video streams securely using sandboxed utility applications.',
    content: `
      <h2>The Evolution of Video Streaming</h2>
      <p>Web video downloading has changed significantly. In 2026, modern platforms utilize complex HLS and DASH segmenting protocols to serve video elements. Finding direct media links requires advanced extraction engines.</p>
      
      <h2>Why Direct APK Tools are Safer</h2>
      <p>Distributed APK platforms bypass browser-based extension adware. Standard extensions often inject trackable cookies or redirect search engines. Sandboxed mobile applications like Vidra operate inside scoped containers, securing user files and ensuring zero background tracking loops.</p>
      
      <h2>Best Practices for Offline Archives</h2>
      <p>When downloading offline archives for personal use, prioritize high-quality progressive streams or stitch segment files locally to avoid server overhead. Check storage folders to verify format compliance.</p>
    `,
    coverImage: 'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?auto=format&fit=crop&w=800&q=80',
    createdAt: Date.now() - 24 * 3600 * 1000 * 2, // 2 days ago
    keywords: 'video downloader, download web videos, safe offline video archive, apk download'
  },
  {
    id: 'seed-2',
    title: 'Exploring Hybrid Video Extraction Engines',
    slug: 'exploring-hybrid-video-extraction-engines',
    summary: 'An architectural deep dive into combining yt-dlp binary wrappers with dynamic Puppeteer headless pools.',
    content: `
      <h2>How Modern Scrapers Parse Dynamic Pages</h2>
      <p>Static HTML parsers like Cheerio are incredibly fast but fail when video elements are dynamically loaded via JavaScript. To solve this, advanced systems use a hybrid structure: running optimized subprocess binaries first, and falling back to connection-pooled headless browsers to intercept network streams.</p>
      
      <h2>Decoupling Workers using BullMQ</h2>
      <p>By putting heavy scraping scripts in dedicated background queues (like BullMQ), fast extraction requests remain unblocked. Decoupling workers allows scalable, stateless horizontal node extensions behind load balancers.</p>
    `,
    coverImage: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=800&q=80',
    createdAt: Date.now() - 24 * 3600 * 1000, // 1 day ago
    keywords: 'hybrid extractor, yt-dlp scraper, puppeteer connection pool, nodejs crawler'
  }
];

class BlogRepository {
  private posts: BlogPost[] = [];

  constructor() {
    this.loadDatabase();
  }

  private loadDatabase() {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf8');
        this.posts = JSON.parse(raw);
      } else {
        // Seed database
        this.posts = [...SEED_POSTS];
        this.saveDatabase();
      }
    } catch (err) {
      console.error('[Blog DB] Failed to load blogs JSON:', err);
      this.posts = [...SEED_POSTS];
    }
  }

  private saveDatabase() {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(this.posts, null, 2), 'utf8');
    } catch (err) {
      console.error('[Blog DB] Failed to save database:', err);
    }
  }

  public getAll(): BlogPost[] {
    return this.posts.sort((a, b) => b.createdAt - a.createdAt);
  }

  public getBySlug(slug: string): BlogPost | undefined {
    return this.posts.find(p => p.slug === slug);
  }

  public create(data: { title: string; content: string; summary: string; coverImage?: string; keywords?: string }): BlogPost {
    const slug = data.title
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');

    const newPost: BlogPost = {
      id: 'post_' + Math.random().toString(36).substring(2, 9),
      title: data.title,
      slug: this.posts.some(p => p.slug === slug) ? `${slug}-${Date.now().toString().slice(-4)}` : slug,
      content: data.content,
      summary: data.summary,
      coverImage: data.coverImage || 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=800&q=80',
      createdAt: Date.now(),
      keywords: data.keywords || 'universal video downloader'
    };

    this.posts.push(newPost);
    this.saveDatabase();
    return newPost;
  }

  public delete(id: string): boolean {
    const index = this.posts.findIndex(p => p.id === id);
    if (index !== -1) {
      this.posts.splice(index, 1);
      this.saveDatabase();
      return true;
    }
    return false;
  }
}

export const blogRepository = new BlogRepository();
