export const SERVER_URL = (import.meta.env.VITE_SERVER_URL || '').replace(/\/$/, '');

export function resolveMediaUrl(pathOrUrl: string): string {
  if (!pathOrUrl) return '';
  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://') || pathOrUrl.startsWith('blob:')) {
    return pathOrUrl;
  }
  return SERVER_URL ? `${SERVER_URL}${pathOrUrl}` : pathOrUrl;
}
