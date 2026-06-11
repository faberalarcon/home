import fs from 'node:fs';
import path from 'node:path';
import { error, type RequestHandler } from '@sveltejs/kit';
import sharp from 'sharp';

const mediaDir = process.env.UPLOADS_DIR || '/var/www/21bristoe-media';
const variantsDirName = '_variants';

const VARIANT_WIDTHS = new Set(['480', '960', '1440']);
const VARIANT_SOURCE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp']);

const contentTypes: Record<string, string> = {
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.json': 'application/json',
  '.png': 'image/png',
  '.webp': 'image/webp'
};

function respond(data: Buffer, ext: string): Response {
  return new Response(new Uint8Array(data), {
    headers: {
      'content-type': contentTypes[ext] || 'application/octet-stream',
      'cache-control': ext === '.json' ? 'no-cache' : 'public, max-age=604800'
    }
  });
}

async function variantResponse(resolved: string, clean: string, width: string, toWebp: boolean): Promise<Response> {
  const root = path.resolve(mediaDir);
  const sourceExt = path.extname(resolved).toLowerCase();
  const ext = toWebp ? '.webp' : sourceExt;
  const variantRel = toWebp ? clean.slice(0, -sourceExt.length) + '.webp' : clean;
  const variantPath = path.resolve(path.join(root, variantsDirName, width, variantRel));

  if (!variantPath.startsWith(root + path.sep)) throw error(403, 'Forbidden');

  try {
    return respond(await fs.promises.readFile(variantPath), ext);
  } catch {
    // Not generated yet.
  }

  await fs.promises.mkdir(path.dirname(variantPath), { recursive: true });
  let pipeline = sharp(resolved).rotate().resize({ width: Number(width), withoutEnlargement: true });
  pipeline = toWebp ? pipeline.webp({ quality: 82 }) : pipeline;
  await pipeline.toFile(variantPath);
  return respond(await fs.promises.readFile(variantPath), ext);
}

export const GET: RequestHandler = async ({ params, url }) => {
  const requested = params.path || '';
  const clean = path.normalize(requested).replace(/^(\.\.(\/|\\|$))+/, '');
  const filePath = path.join(mediaDir, clean);
  const resolved = path.resolve(filePath);
  const root = path.resolve(mediaDir);

  if (!resolved.startsWith(root + path.sep) && resolved !== root) {
    throw error(403, 'Forbidden');
  }

  const ext = path.extname(resolved).toLowerCase();
  const width = url.searchParams.get('w');
  if (width) {
    if (!VARIANT_WIDTHS.has(width) || !VARIANT_SOURCE_EXTS.has(ext)) {
      throw error(400, 'Unsupported variant');
    }
    if (!fs.existsSync(resolved)) throw error(404, 'Not found');
    try {
      return await variantResponse(resolved, clean, width, url.searchParams.get('format') === 'webp');
    } catch (err) {
      if (err && typeof err === 'object' && 'status' in err) throw err;
      throw error(404, 'Not found');
    }
  }

  try {
    return respond(fs.readFileSync(resolved), ext);
  } catch {
    throw error(404, 'Not found');
  }
};
