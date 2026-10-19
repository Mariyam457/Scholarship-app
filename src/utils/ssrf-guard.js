import { URL } from 'url';

const DISALLOWED_HOSTNAMES = new Set([
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  'metadata.google.internal',
  '169.254.169.254',
]);

const PRIVATE_IP_RANGES = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^fc00:/i,
  /^fe80:/i,
];

export function validateSafeUrl(targetUrl) {
  if (!targetUrl || typeof targetUrl !== 'string') {
    return { isSafe: false, reason: 'URL must be a non-empty string' };
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(targetUrl.trim());
  } catch {
    return { isSafe: false, reason: 'Malformed URL' };
  }

  // Only allow http and https protocols
  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    return { isSafe: false, reason: `Disallowed protocol: ${parsedUrl.protocol}` };
  }

  const hostname = parsedUrl.hostname.toLowerCase();

  // Check blacklisted hostnames
  if (DISALLOWED_HOSTNAMES.has(hostname)) {
    return { isSafe: false, reason: `Restricted hostname: ${hostname}` };
  }

  // Check private IP ranges
  for (const regex of PRIVATE_IP_RANGES) {
    if (regex.test(hostname)) {
      return { isSafe: false, reason: `Private IP addresses are forbidden: ${hostname}` };
    }
  }

  // Prevent port hijacking (only allow standard ports 80, 443 or none specified)
  if (parsedUrl.port && parsedUrl.port !== '80' && parsedUrl.port !== '443') {
    return { isSafe: false, reason: `Non-standard port disallowed: ${parsedUrl.port}` };
  }

  return { isSafe: true, url: parsedUrl.toString() };
}
