import test from 'node:test';
import assert from 'node:assert/strict';
import { validateSafeUrl } from '../src/utils/ssrf-guard.js';
import { calculateMatchScore } from '../src/services/eligibility-matcher.service.js';
import { parseFlexibleDate, getDaysUntilDeadline } from '../src/utils/date.utils.js';
import { parseCurrencyString } from '../src/utils/currency.utils.js';
import { getCountryIsoCode, getCountryFlagEmoji } from '../src/utils/country.utils.js';
import { slugify, cleanHtml } from '../src/utils/text.utils.js';

test('SSRF Guard: Blocks private IP addresses and metadata endpoints', () => {
  const blockedUrls = [
    'http://localhost:3000',
    'http://127.0.0.1:8080/admin',
    'http://0.0.0.0',
    'http://169.254.169.254/latest/meta-data/',
    'http://10.0.0.1/secrets',
    'http://192.168.1.1',
    'http://172.16.0.5',
    'ftp://example.com/file',
    'file:///etc/passwd',
  ];

  for (const url of blockedUrls) {
    const result = validateSafeUrl(url);
    assert.equal(result.isSafe, false, `Expected ${url} to be blocked by SSRF guard`);
  }

  const allowedUrls = [
    'https://www.chevening.org/scholarships/',
    'https://www.daad.de/en/',
    'https://foreign.fulbrightonline.org',
  ];

  for (const url of allowedUrls) {
    const result = validateSafeUrl(url);
    assert.equal(result.isSafe, true, `Expected ${url} to be allowed by SSRF guard`);
  }
});

test('Eligibility Matcher: Calculates accurate match scores', () => {
  const profile = {
    nationality: 'PK',
    currentEducationLevel: 'bachelors',
    targetDegreeLevels: ['masters'],
    fieldOfStudy: 'Public Policy',
    gpa: 3.6,
    gpaScale: 4.0,
    preferredCountries: ['GB'],
  };

  const scholarship = {
    degreeLevels: ['masters'],
    fieldsOfStudy: ['Public Policy', 'Economics'],
    hostCountries: ['GB'],
    eligibility: {
      eligibleNationalities: ['ALL'],
      ineligibleNationalities: ['GB', 'US'],
      minGpa: 3.0,
      gpaScale: 4.0,
    },
  };

  const result = calculateMatchScore(profile, scholarship);
  assert.equal(result.isEligible, true);
  assert.ok(result.matchScore >= 90, `Match score ${result.matchScore} should be >= 90`);
  assert.equal(result.matchBreakdown.nationalityMatch, true);
  assert.equal(result.matchBreakdown.degreeLevelMatch, true);
  assert.equal(result.matchBreakdown.fieldOfStudyMatch, true);
  assert.equal(result.matchBreakdown.gpaMatch, true);
  assert.equal(result.matchBreakdown.countryPreferenceMatch, true);
});

test('Date Utils: Handles flexible date formats and urgency', () => {
  const d1 = parseFlexibleDate('2026-11-05');
  assert.ok(d1 instanceof Date);
  assert.equal(d1.getFullYear(), 2026);

  const d2 = parseFlexibleDate('05/11/2026');
  assert.ok(d2 instanceof Date);
  assert.equal(d2.getFullYear(), 2026);

  const futureDeadline = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
  const days = getDaysUntilDeadline(futureDeadline);
  assert.ok(days >= 4 && days <= 6);
});

test('Currency & Text Utils: Parses amounts and formats properly', () => {
  const parsedGbp = parseCurrencyString('£1,450 monthly stipend');
  assert.equal(parsedGbp.currency, 'GBP');
  assert.equal(parsedGbp.amount, 1450);

  const parsedEur = parseCurrencyString('€934 per month');
  assert.equal(parsedEur.currency, 'EUR');
  assert.equal(parsedEur.amount, 934);

  assert.equal(slugify('Chevening Scholarship 2026/2027!'), 'chevening-scholarship-20262027');
  assert.equal(cleanHtml('<p>Hello <b>World</b> &amp; students!</p>'), 'Hello World & students!');
  assert.equal(getCountryIsoCode('germany'), 'DE');
  assert.equal(getCountryFlagEmoji('DE'), '🇩🇪');
});
