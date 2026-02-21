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
