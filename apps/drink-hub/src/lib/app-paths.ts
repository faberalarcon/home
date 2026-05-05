import { base } from '$app/paths';

export function appPath(path = '/'): string {
  if (!path.startsWith('/')) return path;
  if (path === '/') return base || '/';
  return `${base}${path}`;
}

export function appAction(path: string, action: string): string {
  return `${appPath(path)}?/${action}`;
}

export function routePath(pathname: string): string {
  if (!base) return pathname;
  if (pathname === base) return '/';
  if (pathname.startsWith(`${base}/`)) return pathname.slice(base.length);
  return pathname;
}

export function assetPath(path: string | null | undefined): string {
  if (!path) return '';
  if (path.startsWith('/uploads/')) return appPath(path);
  return path;
}

export function thumbPath(path: string | null | undefined): string {
  return assetPath(path).replace('.webp', '-thumb.webp');
}
