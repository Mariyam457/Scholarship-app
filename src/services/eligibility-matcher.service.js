/**
 * Eligibility Matching Engine
 * Computes a compatibility percentage score (0-100) and eligibility breakdown
 * between a student profile and a scholarship.
 */

export function calculateMatchScore(studentProfile, scholarship) {
  if (!studentProfile || !scholarship) {
    return {
      matchScore: 0,
      isEligible: false,
      matchBreakdown: {
        nationalityMatch: false,
        degreeLevelMatch: false,
        fieldOfStudyMatch: false,
        gpaMatch: false,
        countryPreferenceMatch: false,
      },
      reasons: ['Profile or scholarship data missing'],
    };
  }

  const eligibility = scholarship.eligibility || {};
  const reasons = [];
  let score = 0;

  // 1. Nationality Check (Weight: 40%)
  const userNat = (studentProfile.nationality || '').toUpperCase();
  const eligibleNats = (eligibility.eligibleNationalities || ['ALL']).map((n) => n.toUpperCase());
  const ineligibleNats = (eligibility.ineligibleNationalities || []).map((n) => n.toUpperCase());

  let nationalityMatch = false;
  if (ineligibleNats.includes(userNat)) {
    reasons.push(`Citizens of ${userNat} are specifically listed as ineligible.`);
  } else if (eligibleNats.includes('ALL') || eligibleNats.includes(userNat)) {
    nationalityMatch = true;
    score += 40;
  } else {
    reasons.push(`Scholarship is restricted to: ${eligibleNats.join(', ')}.`);
  }

  // 2. Degree Level Check (Weight: 25%)
  const userTargetDegrees = (studentProfile.targetDegreeLevels || []).map((d) => d.toLowerCase());
  const scholarshipDegrees = (scholarship.degreeLevels || []).map((d) => d.toLowerCase());

  let degreeLevelMatch = false;
  if (userTargetDegrees.length === 0) {
    // If student didn't specify target, fallback to current level
    const current = (studentProfile.currentEducationLevel || '').toLowerCase();
    if (scholarshipDegrees.includes(current)) {
      degreeLevelMatch = true;
      score += 25;
    }
  } else {
    const hasOverlap = userTargetDegrees.some((deg) => scholarshipDegrees.includes(deg));
    if (hasOverlap) {
      degreeLevelMatch = true;
      score += 25;
    } else {
      reasons.push(`Offered degree levels (${scholarshipDegrees.join(', ')}) do not match your target (${userTargetDegrees.join(', ')}).`);
    }
  }

  // 3. Field of Study Check (Weight: 15%)
  const userField = (studentProfile.fieldOfStudy || '').toLowerCase();
  const scholarshipFields = (scholarship.fieldsOfStudy || []).map((f) => f.toLowerCase());

  let fieldOfStudyMatch = false;
  if (!userField || scholarshipFields.length === 0 || scholarshipFields.includes('all') || scholarshipFields.includes('all fields')) {
    fieldOfStudyMatch = true;
    score += 15;
  } else {
    const matchesField = scholarshipFields.some((f) => f.includes(userField) || userField.includes(f));
    if (matchesField) {
      fieldOfStudyMatch = true;
      score += 15;
    } else {
      reasons.push(`Field "${studentProfile.fieldOfStudy}" not directly listed among eligible fields.`);
    }
  }

  // 4. GPA Check (Weight: 10%)
  let gpaMatch = true;
  if (eligibility.minGpa && typeof studentProfile.gpa === 'number') {
    // Normalize to 4.0 scale if scale is provided
    const userScale = studentProfile.gpaScale || 4.0;
    const normalizedUserGpa = (studentProfile.gpa / userScale) * 4.0;
    const reqScale = eligibility.gpaScale || 4.0;
    const normalizedReqGpa = (eligibility.minGpa / reqScale) * 4.0;

    if (normalizedUserGpa >= normalizedReqGpa) {
      score += 10;
    } else {
      gpaMatch = false;
      reasons.push(`Minimum GPA required is ${eligibility.minGpa}/${reqScale} (Your GPA: ${studentProfile.gpa}/${userScale}).`);
    }
  } else {
    // No minimum GPA specified or student didn't provide GPA
    score += 10;
  }

  // 5. Host Country Preference Check (Weight: 10%)
  const userPreferredCountries = (studentProfile.preferredCountries || []).map((c) => c.toUpperCase());
  const scholarshipHostCountries = (scholarship.hostCountries || []).map((c) => c.toUpperCase());

  let countryPreferenceMatch = false;
  if (userPreferredCountries.length === 0) {
    countryPreferenceMatch = true;
    score += 10;
  } else {
    const matchesCountry = scholarshipHostCountries.some((c) => userPreferredCountries.includes(c));
    if (matchesCountry) {
      countryPreferenceMatch = true;
      score += 10;
    }
  }

  // Final eligibility decision: must match nationality and degree level
  const isEligible = nationalityMatch && (degreeLevelMatch || userTargetDegrees.length === 0);

  return {
    matchScore: Math.min(100, Math.round(score)),
    isEligible,
    matchBreakdown: {
      nationalityMatch,
      degreeLevelMatch,
      fieldOfStudyMatch,
      gpaMatch,
      countryPreferenceMatch,
    },
    reasons: reasons.length > 0 ? reasons : ['All primary eligibility requirements met!'],
  };
}
