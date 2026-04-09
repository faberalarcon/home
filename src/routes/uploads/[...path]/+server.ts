import { readFile } from 'node:fs/promises';
import { join, dirname, resolve, normalize } from 'node:path';
import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const dbPath = process.env.DATABASE_PATH ?? './data/drink-hub.db';
const UPLOADS_ROOT = resolve(join(dirname(dbPath), 'uploads'));

const MIME: Record<string, string> = {
  webp: 'image/webp',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif'
};

export const GET: RequestHandler = async ({ params }) => {
  const safe = normalize(params.path).replace(/^(\.\.(\/|\\|$))+/, '');
  const filePath = join(UPLOADS_ROOT, safe);

  if (!filePath.startsWith(UPLOADS_ROOT + '/') && filePath !== UPLOADS_ROOT) {
    throw error(403, 'Forbidden');
  }

  let buf: Buffer;
  try {
    buf = await readFile(filePath);
  } catch {
    throw error(404, 'Not found');
  }

  const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
  const contentType = MIME[ext] ?? 'application/octet-stream';

  return new Response(new Uint8Array(buf), {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=31536000'
    }
  });
};
