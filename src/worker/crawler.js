import axios from 'axios';
import * as cheerio from 'cheerio';
import { validateSafeUrl } from '../utils/ssrf-guard.js';
import { sha256Fingerprint, cleanHtml } from '../utils/text.utils.js';
import { parseFlexibleDate } from '../utils/date.utils.js';
import { parseCurrencyString } from '../utils/currency.utils.js';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

const REALISTIC_BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache',
  'Upgrade-Insecure-Requests': '1',
};

const RETRYABLE_CODES = new Set(['ECONNRESET', 'ETIMEDOUT', 'ECONNABORTED', 'EAI_AGAIN', 'ENETUNREACH']);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(url, customHeaders = {}, maxRetries = 2, timeoutMs = env.SOURCE_REQUEST_TIMEOUT_MS) {
  let lastErr = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await axios.get(url, {
        timeout: timeoutMs,
        maxContentLength: env.SOURCE_MAX_RESPONSE_SIZE_BYTES,
        maxRedirects: 5,
        headers: {
          ...REALISTIC_BROWSER_HEADERS,
          ...customHeaders,
        },
        validateStatus: () => true, // Inspect all HTTP statuses explicitly
      });

      // Retry transient 502/503/504 gateway errors
      if ([502, 503, 504].includes(response.status) && attempt < maxRetries) {
        await sleep(600 * (attempt + 1));
        continue;
      }

      return response;
    } catch (err) {
      lastErr = err;
      const isRetryable = RETRYABLE_CODES.has(err.code) || /timeout/i.test(err.message);
      if (isRetryable && attempt < maxRetries) {
        await sleep(600 * (attempt + 1));
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

function detectBrokenPage(httpStatus, finalUrl, $) {
  if (httpStatus === 404 || httpStatus === 410 || httpStatus === 451) {
    return `Official URL returned HTTP ${httpStatus} (Page Not Found / Gone)`;
  }

  if (httpStatus >= 500) {
    return `Official server returned HTTP ${httpStatus}`;
  }

  // Soft-404 redirect path detection
  if (finalUrl) {
    try {
      const parsedPath = new URL(finalUrl).pathname.toLowerCase();
      if (/\/(404|not-found|page-not-found|error-404)(\.html?)?\/?$/.test(parsedPath)) {
        return `Redirected to error page (${parsedPath})`;
      }
    } catch {
      // ignore URL parse error
    }
  }

  if ($) {
    const pageTitle = $('title').first().text().trim();
    const h1Text = $('h1').first().text().trim();
    const soft404Pattern =
      /^(404\b|error\s*404\b|page\s+not\s+found|not\s+found|this\s+page\s+(doesn't|does\s+not|could\s+not)\s+(exist|be\s+found)|seite\s+nicht\s+gefunden|404\s*-\s*not\s*found)/i;

    if (soft404Pattern.test(pageTitle) || soft404Pattern.test(h1Text)) {
      return `Soft 404 detected on page ("${h1Text || pageTitle}")`;
    }
  }

  return null;
}

/**
 * Probe a URL to confirm it is live, reachable, and not a 404 / dead domain.
 * Returns { isBroken, checkedUrl, finalUrl, statusCode, brokenReason, html }
 */
export async function verifyLinkHealth(url, customHeaders = {}) {
  if (!url || typeof url !== 'string' || !/^https?:\/\//i.test(url.trim())) {
    return {
      isBroken: true,
      checkedUrl: url || '',
      statusCode: 0,
      brokenReason: 'Missing or invalid HTTP/HTTPS URL format',
    };
  }

  const safetyCheck = validateSafeUrl(url.trim());
  if (!safetyCheck.isSafe) {
    return {
      isBroken: true,
      checkedUrl: url.trim(),
      statusCode: 0,
      brokenReason: `Unsafe or invalid URL: ${safetyCheck.reason}`,
    };
  }

  try {
    const response = await fetchWithRetry(safetyCheck.url, customHeaders, 2, 15000);
    const httpStatus = response.status;
    const finalUrl = response.request?.res?.responseUrl || safetyCheck.url;
    const rawHtml = typeof response.data === 'string' ? response.data : '';
    const $ = rawHtml ? cheerio.load(rawHtml) : null;

    // Bot protection (403/429) on valid domains should not blindly hide an official scholarship
    if (httpStatus === 403 || httpStatus === 429) {
      return {
        isBroken: false,
        checkedUrl: safetyCheck.url,
        finalUrl,
        statusCode: httpStatus,
        brokenReason: '',
        wafBlocked: true,
      };
    }

    const brokenReason = detectBrokenPage(httpStatus, finalUrl, $);
    if (brokenReason) {
      return {
        isBroken: true,
        checkedUrl: safetyCheck.url,
        finalUrl,
        statusCode: httpStatus,
        brokenReason,
      };
    }

    return {
      isBroken: false,
      checkedUrl: safetyCheck.url,
      finalUrl,
      statusCode: httpStatus,
      brokenReason: '',
      rawHtml,
    };
  } catch (err) {
    const code = err.code || '';
    const isHardDnsOrRefused =
      code === 'ENOTFOUND' ||
      code === 'ERR_NAME_NOT_RESOLVED' ||
      code === 'ECONNREFUSED' ||
      code === 'CERT_HAS_EXPIRED' ||
      code === 'ERR_TLS_CERT_ALTNAME_INVALID' ||
      /ENOTFOUND|ECONNREFUSED|getaddrinfo/i.test(err.message);

    if (isHardDnsOrRefused) {
      return {
        isBroken: true,
        checkedUrl: safetyCheck.url,
        statusCode: 0,
        brokenReason: `Domain unreachable (${code || err.message})`,
      };
    }

    // Transient timeouts shouldn't automatically hide a valid portal
    return {
      isBroken: false,
      checkedUrl: safetyCheck.url,
      statusCode: 408,
      brokenReason: '',
      transientError: err.message,
    };
  }
}

/**
 * Verify both the direct applicationUrl and officialSourceUrl of a scholarship.
 */
export async function verifyScholarshipLinks(scholarship) {
  const appUrl = scholarship?.sourceAttribution?.applicationUrl;
  const officialUrl = scholarship?.sourceAttribution?.officialSourceUrl;

  const primaryCheck = await verifyLinkHealth(appUrl || officialUrl);
  if (primaryCheck.isBroken) {
    return primaryCheck;
  }

  if (officialUrl && appUrl && officialUrl.trim() !== appUrl.trim()) {
    const secondaryCheck = await verifyLinkHealth(officialUrl);
    if (secondaryCheck.isBroken) {
      return secondaryCheck;
    }
  }

  return primaryCheck;
}

function extractDeadlineCandidates($, crawlConfig) {
  const candidates = [];

  if (crawlConfig.selectorDeadline && $(crawlConfig.selectorDeadline).length) {
    $(crawlConfig.selectorDeadline).each((_, el) => {
      const txt = $(el).text().trim();
      if (txt) candidates.push(txt);
    });
  }

  // Check semantic <time> elements and deadline-classed elements
  $('time[datetime], [class*="deadline"], [id*="deadline"], [class*="closing"]').each((_, el) => {
    const dtAttr = $(el).attr('datetime');
    if (dtAttr) candidates.push(dtAttr.trim());
    const txt = $(el).text().trim();
    if (txt && txt.length <= 80) candidates.push(txt);
  });

  // Scan cleaned body text with multiple international deadline regex patterns
  const pageText = $('body').text().replace(/\s+/g, ' ');
  const deadlinePatterns = [
    /(?:application\s+deadline|closing\s+date|applications\s+close|apply\s+by|submission\s+deadline|last\s+date(?:\s+to\s+apply)?|deadline\s+for\s+applications?)[:\s\-–]+([A-Za-z0-9,\.\s\/\-]{5,40})/gi,
    /(?:deadline)[:\s]+(\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]{3,12}\s+\d{4})/gi,
    /(?:deadline)[:\s]+([A-Za-z]{3,12}\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4})/gi,
    /(?:closes?\s+on|ends?\s+on|due\s+by)[:\s]+(\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]{3,12}\s+\d{4}|[A-Za-z]{3,12}\s+\d{1,2},?\s+\d{4}|\d{4}-\d{2}-\d{2})/gi,
  ];

  for (const regex of deadlinePatterns) {
    let match;
    while ((match = regex.exec(pageText)) !== null) {
      if (match[1]) {
        candidates.push(match[1].trim());
      }
      if (candidates.length >= 15) break;
    }
  }

  for (const raw of candidates) {
    const parsed = parseFlexibleDate(raw);
    if (parsed) {
      return { rawDeadlineText: raw, parsedDeadline: parsed };
    }
  }

  return { rawDeadlineText: candidates[0] || '', parsedDeadline: null };
}

function extractIntakeStatus($) {
  const headlineText = $('h1, h2, .alert, .banner, [class*="status"], [class*="notice"]')
    .map((_, el) => $(el).text().trim())
    .get()
    .join(' ')
    .replace(/\s+/g, ' ');

  const closedMatch = headlineText.match(
    /(applications\s+(?:are\s+)?(?:currently|now)?\s*closed|call\s+(?:is\s+)?closed|submissions?\s+(?:are\s+)?closed|programme\s+(?:is\s+)?closed)/i
  );
  if (closedMatch) {
    return { status: 'closed', indicatorText: closedMatch[0] };
  }

  const openMatch = headlineText.match(
    /(applications\s+(?:are\s+)?(?:currently|now)?\s*open|now\s+accepting\s+applications|call\s+for\s+applications\s+(?:is\s+)?open)/i
  );
  if (openMatch) {
    return { status: 'open', indicatorText: openMatch[0] };
  }

  return { status: 'unknown', indicatorText: '' };
}

export async function crawlSource(sourceConfig) {
  const targetUrl = sourceConfig.targetScholarshipUrl || sourceConfig.officialUrl;
  const safetyCheck = validateSafeUrl(targetUrl);

  if (!safetyCheck.isSafe) {
    throw new Error(`SSRF Security Violation: ${safetyCheck.reason}`);
  }

  const startTime = Date.now();
  logger.info(`[CRAWLER] Initiating accurate fetch for ${sourceConfig.name}: ${safetyCheck.url}`);

  const customHeaders = sourceConfig.crawlConfig?.headers
    ? Object.fromEntries(
        sourceConfig.crawlConfig.headers instanceof Map
          ? sourceConfig.crawlConfig.headers
          : Object.entries(sourceConfig.crawlConfig.headers)
      )
    : {};

  const response = await fetchWithRetry(safetyCheck.url, customHeaders, 2);

  const durationMs = Date.now() - startTime;
  const httpStatus = response.status;
  const finalUrl = response.request?.res?.responseUrl || safetyCheck.url;
  const rawHtml = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
  const contentHash = sha256Fingerprint(rawHtml);

  const $ = cheerio.load(rawHtml);
  const crawlConfig = sourceConfig.crawlConfig || {};

  const brokenReason = httpStatus === 403 || httpStatus === 429 ? null : detectBrokenPage(httpStatus, finalUrl, $);
  const linkCheck = {
    isBroken: Boolean(brokenReason),
    checkedUrl: safetyCheck.url,
    finalUrl,
    statusCode: httpStatus,
    brokenReason: brokenReason || '',
  };

  // Extract title
  let extractedTitle = '';
  if (crawlConfig.selectorTitle && $(crawlConfig.selectorTitle).length) {
    extractedTitle = $(crawlConfig.selectorTitle).first().text().trim();
  } else {
    extractedTitle =
      $('h1').first().text().trim() ||
      $('meta[property="og:title"]').attr('content')?.trim() ||
      $('title').text().trim();
  }

  // Extract deadline accurately across multiple international patterns
  const { rawDeadlineText, parsedDeadline } = extractDeadlineCandidates($, crawlConfig);

  // Extract intake open/closed status
  const intakeStatus = extractIntakeStatus($);

  // Extract description
  let extractedDescription = '';
  if (crawlConfig.selectorDescription && $(crawlConfig.selectorDescription).length) {
    extractedDescription = cleanHtml($(crawlConfig.selectorDescription).html() || '');
  } else {
    extractedDescription = cleanHtml(
      $('meta[name="description"]').attr('content') ||
        $('meta[property="og:description"]').attr('content') ||
        $('p').slice(0, 4).text() ||
        ''
    );
  }

  // Extract funding / stipend amount
  let extractedFundingStr = '';
  if (crawlConfig.selectorFunding && $(crawlConfig.selectorFunding).length) {
    extractedFundingStr = $(crawlConfig.selectorFunding).first().text().trim();
  } else {
    const bodyText = $('body').text().replace(/\s+/g, ' ');
    const fundingMatch = bodyText.match(
      /(?:monthly\s+stipend|living\s+allowance|stipend\s+of|subsistence\s+allowance|allowance\s+of)\s*[:\-]?\s*([€£$]|CHF|USD|EUR|GBP|JPY)?\s*([\d,]+(?:\.\d+)?)\s*(?:per\s+month|\/\s*month|monthly|CHF|USD|EUR|GBP|JPY)?/i
    );
    if (fundingMatch) {
      extractedFundingStr = fundingMatch[0].trim();
    }
  }

  const parsedFunding = parseCurrencyString(extractedFundingStr);

  return {
    httpStatus,
    finalUrl,
    durationMs,
    contentHash,
    linkCheck,
    extractedData: {
      title: extractedTitle,
      rawDeadlineText,
      parsedDeadline,
      intakeStatus,
      descriptionSnippet: extractedDescription.slice(0, 1000),
      rawFundingText: extractedFundingStr,
      parsedFunding,
    },
    rawSnippet: cleanHtml(rawHtml).slice(0, 2000),
    capturedAt: new Date(),
  };
}
