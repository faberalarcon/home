import fs from 'node:fs';
import path from 'node:path';
import { error, type RequestHandler } from '@sveltejs/kit';

const mediaDir = process.env.UPLOADS_DIR || '/var/www/21bristoe-media';

const contentTypes: Record<string, string> = {
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.json': 'application/json',
  '.png': 'image/png',
  '.webp': 'image/webp'
};

export const GET: RequestHandler = ({ params }) => {
  const requested = params.path || '';
  const clean = path.normalize(requested).replace(/^(\.\.(\/|\\|$))+/, '');
  const filePath = path.join(mediaDir, clean);
  const resolved = path.resolve(filePath);
  const root = path.resolve(mediaDir);

  if (!resolved.startsWith(root + path.sep) && resolved !== root) {
    throw error(403, 'Forbidden');
  }

  try {
    const data = fs.readFileSync(resolved);
    const ext = path.extname(resolved).toLowerCase();
    return new Response(data, {
      headers: {
        'content-type': contentTypes[ext] || 'application/octet-stream',
        'cache-control': ext === '.json' ? 'no-cache' : 'public, max-age=604800'
      }
    });
  } catch {
    throw error(404, 'Not found');
  }
};
