import axios from 'axios';
import * as cheerio from 'cheerio';
import { validateSafeUrl } from '../utils/ssrf-guard.js';
import { sha256Fingerprint, cleanHtml } from '../utils/text.utils.js';
import { parseFlexibleDate } from '../utils/date.utils.js';
import { parseCurrencyString } from '../utils/currency.utils.js';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

export async function crawlSource(sourceConfig) {
  const targetUrl = sourceConfig.targetScholarshipUrl || sourceConfig.officialUrl;
  const safetyCheck = validateSafeUrl(targetUrl);

  if (!safetyCheck.isSafe) {
    throw new Error(`SSRF Security Violation: ${safetyCheck.reason}`);
  }

  const startTime = Date.now();
  logger.info(`[CRAWLER] Initiating fetch for ${sourceConfig.name}: ${safetyCheck.url}`);

  const response = await axios.get(safetyCheck.url, {
    timeout: env.SOURCE_REQUEST_TIMEOUT_MS,
    maxContentLength: env.SOURCE_MAX_RESPONSE_SIZE_BYTES,
    headers: {
      'User-Agent': env.USER_AGENT,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      ...(sourceConfig.crawlConfig?.headers || {}),
    },
    validateStatus: (status) => status < 500,
  });

  const durationMs = Date.now() - startTime;
  const httpStatus = response.status;
  const rawHtml = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
  const contentHash = sha256Fingerprint(rawHtml);

  const $ = cheerio.load(rawHtml);
  const crawlConfig = sourceConfig.crawlConfig || {};

  // Extract fields using selectors if specified, or smart fallbacks
  let extractedTitle = '';
  if (crawlConfig.selectorTitle && $(crawlConfig.selectorTitle).length) {
    extractedTitle = $(crawlConfig.selectorTitle).first().text().trim();
  } else {
    extractedTitle = $('h1').first().text().trim() || $('title').text().trim();
  }

  let extractedDeadlineStr = '';
  if (crawlConfig.selectorDeadline && $(crawlConfig.selectorDeadline).length) {
    extractedDeadlineStr = $(crawlConfig.selectorDeadline).first().text().trim();
  } else {
    // Fallback: look for deadline patterns in text
    const pageText = $('body').text();
    const deadlineMatch = pageText.match(/(?:deadline|closing date|apply by|applications close)[:\s]+([A-Za-z0-9,\s\.\/-]{6,35})/i);
    if (deadlineMatch) {
      extractedDeadlineStr = deadlineMatch[1].trim();
    }
  }

  let extractedDescription = '';
  if (crawlConfig.selectorDescription && $(crawlConfig.selectorDescription).length) {
    extractedDescription = cleanHtml($(crawlConfig.selectorDescription).html() || '');
  } else {
    extractedDescription = cleanHtml($('meta[name="description"]').attr('content') || $('p').slice(0, 4).text() || '');
  }

  let extractedFundingStr = '';
  if (crawlConfig.selectorFunding && $(crawlConfig.selectorFunding).length) {
    extractedFundingStr = $(crawlConfig.selectorFunding).first().text().trim();
  }

  const parsedDeadline = parseFlexibleDate(extractedDeadlineStr);
  const parsedFunding = parseCurrencyString(extractedFundingStr);

  return {
    httpStatus,
    durationMs,
    contentHash,
    extractedData: {
      title: extractedTitle,
      rawDeadlineText: extractedDeadlineStr,
      parsedDeadline,
      descriptionSnippet: extractedDescription.slice(0, 1000),
      rawFundingText: extractedFundingStr,
      parsedFunding,
    },
    rawSnippet: cleanHtml(rawHtml).slice(0, 2000),
    capturedAt: new Date(),
  };
}
