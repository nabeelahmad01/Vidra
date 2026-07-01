import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { blogRepository } from '../models/blog';
import { PUBLIC_HOST, DOWNLOADS_DIR } from '../config/constants';

const router = Router();
const PUBLIC_DIR = path.resolve(__dirname, '../../public');
const APK_PATH = path.join(PUBLIC_DIR, 'vidra-latest.apk');

// Ensures public directory and static dummy APK exists for initial distribution setups
if (!fs.existsSync(PUBLIC_DIR)) {
  fs.mkdirSync(PUBLIC_DIR, { recursive: true });
}
if (!fs.existsSync(APK_PATH)) {
  fs.writeFileSync(APK_PATH, 'Vidra Standalone Android Package (APK) Binary Placeholder - Replace this file with your compiled production release build.', 'utf8');
}

// GET / - Web Landing Page + Online Downloader
router.get('/', (req: Request, res: Response) => {
  res.render('landing', { siteHost: PUBLIC_HOST });
});

// GET /blog - Articles index list
router.get('/blog', (req: Request, res: Response) => {
  const posts = blogRepository.getAll();
  res.render('blog-list', { posts, siteHost: PUBLIC_HOST });
});

// GET /blog/:slug - Single Article render
router.get('/blog/:slug', (req: Request, res: Response) => {
  const { slug } = req.params;
  const post = blogRepository.getBySlug(slug);
  
  if (!post) {
    return res.status(404).send('Article not found');
  }
  
  return res.render('blog-post', { post, siteHost: PUBLIC_HOST });
});

// GET /admin/blog - Publisher dashboard panel
router.get('/admin/blog', (req: Request, res: Response) => {
  const posts = blogRepository.getAll();
  res.render('admin', { posts });
});

// POST /admin/blog - Create new post
router.post('/admin/blog', (req: Request, res: Response) => {
  const { title, summary, content, coverImage, keywords } = req.body;
  if (!title || !summary || !content) {
    return res.status(400).send('Title, Summary, and Content fields are required');
  }

  blogRepository.create({
    title,
    summary,
    content,
    coverImage,
    keywords
  });

  return res.redirect('/admin/blog');
});

// POST /admin/blog/delete/:id - Remove post
router.post('/admin/blog/delete/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  blogRepository.delete(id);
  return res.redirect('/admin/blog');
});

// GET /download/apk - Standalone APK distribution endpoint
router.get('/download/apk', (req: Request, res: Response) => {
  if (!fs.existsSync(APK_PATH)) {
    return res.status(404).send('APK file not found on server');
  }
  return res.download(APK_PATH, 'vidra-latest.apk');
});

export default router;
