import { ChangeCategory, Severity } from '../constants/enums.js';

const NOISY_BOT_OR_ERROR_TITLES =
  /^(just a moment|access denied|attention required|403 forbidden|404|page not found|error|security check|please wait|robot check|cloudflare)/i;

export function detectScholarshipDiffs(existingScholarship, crawledSnapshot, linkResult = null) {
  const changes = [];
  let highestSeverity = Severity.INFO;
  let confidenceScore = 90;

  const extracted = crawledSnapshot?.extractedData || {};

  // 0. Broken / Inaccurate Link Detection
  const effectiveLink = linkResult || crawledSnapshot?.linkCheck;
  if (effectiveLink?.isBroken) {
    changes.push({
      field: 'sourceAttribution.applicationUrl',
      oldValue: effectiveLink.checkedUrl || existingScholarship.sourceAttribution?.applicationUrl,
      newValue: 'NEEDS_UPDATED_URL',
      category: ChangeCategory.LINK_BROKEN,
      severity: Severity.CRITICAL,
      description: `Inaccurate/Broken Link Detected (${effectiveLink.brokenReason || 'Unreachable'}). Scholarship automatically hidden from student app until link is corrected.`,
    });
    highestSeverity = Severity.CRITICAL;
    confidenceScore = 98;
  }

  // 1. Deadline Comparison
  if (extracted.parsedDeadline && existingScholarship.deadlines?.applicationDeadline) {
    const existingDate = new Date(existingScholarship.deadlines.applicationDeadline);
    const newDate = new Date(extracted.parsedDeadline);

    // If day differs by more than 1 day
    const dayDiff = Math.abs(newDate.getTime() - existingDate.getTime()) / (1000 * 60 * 60 * 24);
    if (dayDiff >= 1) {
      changes.push({
        field: 'deadlines.applicationDeadline',
        oldValue: existingDate.toISOString().split('T')[0],
        newValue: newDate.toISOString().split('T')[0],
        category: ChangeCategory.DEADLINE_CHANGE,
        severity: Severity.CRITICAL,
        description: `Official deadline changed from ${existingDate.toDateString()} to ${newDate.toDateString()}`,
      });
      highestSeverity = Severity.CRITICAL;
      confidenceScore = 95;
    }
  }

  // 2. Intake Closed Detection (page announces closed while DB deadline is still future and not rolling)
  if (
    extracted.intakeStatus?.status === 'closed' &&
    existingScholarship.deadlines?.applicationDeadline &&
    !existingScholarship.deadlines?.isRolling
  ) {
    const existingDate = new Date(existingScholarship.deadlines.applicationDeadline);
    if (existingDate.getTime() > Date.now()) {
      changes.push({
        field: 'verificationStatus',
        oldValue: existingScholarship.verificationStatus || 'verified',
        newValue: 'needs_review',
        category: ChangeCategory.SCHOLARSHIP_CLOSED,
        severity: Severity.HIGH,
        description: `Official portal indicates intake is closed ("${extracted.intakeStatus.indicatorText}"), though listed deadline is ${existingDate.toISOString().split('T')[0]}`,
      });
      if (highestSeverity !== Severity.CRITICAL) {
        highestSeverity = Severity.HIGH;
      }
      confidenceScore = Math.max(confidenceScore, 92);
    }
  }

  // 3. Title Comparison (ignore WAF/bot/error page titles)
  if (extracted.title && existingScholarship.title && !effectiveLink?.isBroken) {
    const cleanOld = existingScholarship.title.trim().toLowerCase();
    const cleanNew = extracted.title.trim().toLowerCase();
    const isNoisy = NOISY_BOT_OR_ERROR_TITLES.test(cleanNew);
    if (!isNoisy && cleanOld !== cleanNew && cleanNew.length > 8 && cleanNew.length < 180) {
      // Only flag title change if it doesn't already contain the existing title or vice versa as minor suffix noise
      const minorMatch = cleanNew.includes(cleanOld) || cleanOld.includes(cleanNew);
      if (!minorMatch) {
        changes.push({
          field: 'title',
          oldValue: existingScholarship.title,
          newValue: extracted.title.trim(),
          category: ChangeCategory.CONTENT_UPDATE,
          severity: Severity.MEDIUM,
          description: `Official title updated: "${extracted.title.trim()}"`,
        });
        if (highestSeverity !== Severity.CRITICAL && highestSeverity !== Severity.HIGH) {
          highestSeverity = Severity.MEDIUM;
        }
      }
    }
  }

  // 4. Funding Amount Comparison
  if (extracted.parsedFunding?.amount && existingScholarship.fundingBreakdown?.livingStipend?.amount) {
    const oldAmount = existingScholarship.fundingBreakdown.livingStipend.amount;
    const newAmount = extracted.parsedFunding.amount;
    if (oldAmount !== newAmount && newAmount >= 50) {
      changes.push({
        field: 'fundingBreakdown.livingStipend.amount',
        oldValue: oldAmount,
        newValue: newAmount,
        category: ChangeCategory.FUNDING_CHANGE,
        severity: Severity.HIGH,
        description: `Funding amount changed from ${oldAmount} to ${newAmount}`,
      });
      if (highestSeverity !== Severity.CRITICAL) {
        highestSeverity = Severity.HIGH;
      }
    }
  }

  return {
    hasChanges: changes.length > 0,
    changes,
    severity: highestSeverity,
    confidenceScore,
  };
}
