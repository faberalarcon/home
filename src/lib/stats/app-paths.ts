const base = '/stats';

export function appPath(path = '/'): string {
  if (!path.startsWith('/')) return path;
  if (path === '/') return base || '/';
  return `${base}${path}`;
}

export function routePath(pathname: string): string {
  if (pathname === base) return '/';
  if (pathname.startsWith(`${base}/`)) return pathname.slice(base.length);
  return pathname;
}
