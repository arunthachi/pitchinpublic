const DEFAULT_MARKETING_URL = 'https://www.pitchinpublic.io';
const DEFAULT_APP_URL = 'https://app.pitchinpublic.io';

export function normalizeSiteOrigin(value: string | undefined, fallback: string) {
  try {
    const url = new URL(value || fallback);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return fallback;
    return url.origin;
  } catch {
    return fallback;
  }
}

export const marketingUrl = normalizeSiteOrigin(
  process.env.NEXT_PUBLIC_MARKETING_URL,
  DEFAULT_MARKETING_URL
);

export const appUrl = normalizeSiteOrigin(process.env.NEXT_PUBLIC_APP_URL, DEFAULT_APP_URL);

function urlFor(origin: string, path: string) {
  if (!path || path === '/') return `${origin}/`;
  const localPath = `/${path.replace(/^\/+/, '')}`;
  return new URL(localPath, `${origin}/`).toString();
}

export function marketingUrlFor(path: string) {
  return urlFor(marketingUrl, path);
}

export function appUrlFor(path: string) {
  return urlFor(appUrl, path);
}
