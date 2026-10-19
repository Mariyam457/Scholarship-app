import { ChangeCategory, Severity } from '../constants/enums.js';

export function detectScholarshipDiffs(existingScholarship, crawledSnapshot) {
  const changes = [];
  let highestSeverity = Severity.INFO;
  let confidenceScore = 90;

  const extracted = crawledSnapshot.extractedData || {};

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

  // 2. Title Comparison
  if (extracted.title && existingScholarship.title) {
    const cleanOld = existingScholarship.title.trim().toLowerCase();
    const cleanNew = extracted.title.trim().toLowerCase();
    if (cleanOld !== cleanNew && cleanNew.length > 5) {
      changes.push({
        field: 'title',
        oldValue: existingScholarship.title,
        newValue: extracted.title,
        category: ChangeCategory.CONTENT_UPDATE,
        severity: Severity.MEDIUM,
        description: `Official title updated: "${extracted.title}"`,
      });
      if (highestSeverity !== Severity.CRITICAL) {
        highestSeverity = Severity.MEDIUM;
      }
    }
  }

  // 3. Funding Amount Comparison
  if (extracted.parsedFunding?.amount && existingScholarship.fundingBreakdown?.livingStipend?.amount) {
    const oldAmount = existingScholarship.fundingBreakdown.livingStipend.amount;
    const newAmount = extracted.parsedFunding.amount;
    if (oldAmount !== newAmount) {
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
