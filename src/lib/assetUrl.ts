const RAW_BASE = (import.meta.env.VITE_ASSET_BASE_URL ?? '').trim();
const BASE = RAW_BASE.replace(/\/+$/, '');

export function assetUrl(path: string): string {
  if (!BASE) return path;
  if (/^https?:\/\//i.test(path)) return path;
  return `${BASE}${path.startsWith('/') ? '' : '/'}${path}`;
}
