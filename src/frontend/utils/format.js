export function formatWA(number) {
  if (!number) return '-';
  let n = String(number);
  if (n.startsWith('62')) {
    n = '0' + n.slice(2);
  }
  // Format: 0812-3456-7890
  if (n.length > 4) {
    let result = n.slice(0, 4);
    let rest = n.slice(4);
    while (rest.length > 0) {
      result += '-' + rest.slice(0, 4);
      rest = rest.slice(4);
    }
    return result;
  }
  return n;
}

export function formatDate(isoString) {
  if (!isoString) return '-';
  try {
    return new Date(isoString).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return isoString;
  }
}

export function truncate(text, maxLen = 50) {
  if (!text) return '-';
  return text.length > maxLen ? text.slice(0, maxLen) + '...' : text;
}

export function formatRelativeTime(isoString) {
  if (!isoString) return '-';
  const now = new Date();
  const date = new Date(isoString);
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'Baru saja';
  if (diffMin < 60) return `${diffMin} menit lalu`;
  if (diffHour < 24) return `${diffHour} jam lalu`;
  if (diffDay < 7) return `${diffDay} hari lalu`;
  return formatDate(isoString);
}
