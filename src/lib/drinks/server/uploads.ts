import { mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import sharp from 'sharp';

const dbPath = process.env.DATABASE_PATH ?? './data/drink-hub.db';
const UPLOADS_DIR = join(dirname(dbPath), 'uploads');

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

function toSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export async function saveImage(
  file: File,
  subdir: string,
  id: number,
  name: string
): Promise<string> {
  if (file.size > MAX_BYTES) {
    throw new Error(
      `Image too large — max 10 MB, uploaded file is ${(file.size / 1024 / 1024).toFixed(1)} MB`
    );
  }

  const dir = join(UPLOADS_DIR, subdir);
  mkdirSync(dir, { recursive: true });

  const buffer = Buffer.from(await file.arrayBuffer());
  const base = `${id}-${toSlug(name)}`;

  await sharp(buffer)
    .rotate()                              // auto-rotate from EXIF orientation, then strip tag
    .resize(512, 512, { fit: 'cover' })
    .webp({ quality: 85 })
    .toFile(join(dir, `${base}.webp`));

  await sharp(buffer)
    .rotate()
    .resize(128, 128, { fit: 'cover' })
    .webp({ quality: 80 })
    .toFile(join(dir, `${base}-thumb.webp`));

  return `/uploads/${subdir}/${base}.webp`;
}
