import { createHash } from 'crypto';

export function slugify(text) {
  if (!text) return '';
  return String(text)
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function cleanHtml(rawHtml) {
  if (!rawHtml) return '';
  return String(rawHtml)
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

export function sha256Fingerprint(content) {
  if (!content) return '';
  return createHash('sha256').update(String(content).trim()).digest('hex');
}

export function truncateText(text, maxLength = 160) {
  if (!text || text.length <= maxLength) return text || '';
  return text.substring(0, maxLength).trim() + '...';
}

export function generateDiffSummary(oldVal, newVal) {
  if (oldVal === undefined && newVal !== undefined) {
    return `Added: ${JSON.stringify(newVal)}`;
  }
  if (oldVal !== undefined && newVal === undefined) {
    return `Removed: ${JSON.stringify(oldVal)}`;
  }
  return `Changed from "${String(oldVal)}" to "${String(newVal)}"`;
}
