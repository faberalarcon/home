import { stat, readFile } from 'node:fs/promises';
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

export const GET: RequestHandler = async ({ params, request }) => {
  const safe = normalize(params.path).replace(/^(\.\.(\/|\\|$))+/, '');
  const filePath = join(UPLOADS_ROOT, safe);

  if (!filePath.startsWith(UPLOADS_ROOT + '/') && filePath !== UPLOADS_ROOT) {
    throw error(403, 'Forbidden');
  }

  let fileStat: Awaited<ReturnType<typeof stat>>;
  try {
    fileStat = await stat(filePath);
  } catch {
    throw error(404, 'Not found');
  }

  const lastModified = fileStat.mtime.toUTCString();
  const etag = `"${fileStat.mtimeMs.toString(36)}-${fileStat.size.toString(36)}"`;

  // Conditional request — return 304 if client already has the current version
  if (
    request.headers.get('if-none-match') === etag ||
    request.headers.get('if-modified-since') === lastModified
  ) {
    return new Response(null, {
      status: 304,
      headers: {
        ETag: etag,
        'Last-Modified': lastModified,
        'Cache-Control': 'public, max-age=0, must-revalidate'
      }
    });
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
      // must-revalidate: browser always checks freshness via ETag/Last-Modified
      // before serving from cache, so replaced images are never served stale.
      'Cache-Control': 'public, max-age=0, must-revalidate',
      ETag: etag,
      'Last-Modified': lastModified
    }
  });
};
