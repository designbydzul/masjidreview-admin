export function resolvePhotoUrl(url) {
  if (!url) return url;
  if (url.startsWith('/images/')) return 'https://masjidreview.id' + url;
  return url;
}
