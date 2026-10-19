import test from 'node:test';
import assert from 'node:assert/strict';
import { connectDatabase, disconnectDatabase } from '../src/config/database.js';
import { ScholarshipModel } from '../src/models/Scholarship.js';
import { SourceRegistryModel } from '../src/models/SourceRegistry.js';
import { UserModel } from '../src/models/User.js';
import { calculateMatchScore } from '../src/services/eligibility-matcher.service.js';

test('Integration Test: Live MongoDB queries & scholarship match flow', async () => {
  await connectDatabase();

  // 1. Verify seeded scholarships exist
  const count = await ScholarshipModel.countDocuments({ isActive: true });
  assert.ok(count >= 5, `Expected at least 5 seeded scholarships, found ${count}`);

  // 2. Fetch Chevening scholarship
  const chevening = await ScholarshipModel.findOne({ slug: 'chevening-scholarship-2026' });
  assert.ok(chevening, 'Chevening scholarship must exist in database');
  assert.equal(chevening.fundingBreakdown.tuitionCovered, true);
  assert.equal(chevening.fundingBreakdown.livingStipend.provided, true);
  assert.equal(chevening.fundingBreakdown.livingStipend.currency, 'GBP');

  // 3. Verify official source linking
  const source = await SourceRegistryModel.findById(chevening.sourceAttribution.sourceId);
  assert.ok(source, 'Source record must exist and match attribution');
  assert.equal(source.organization, 'UK Foreign, Commonwealth & Development Office (FCDO)');

  // 4. Test student matching against real scholarship record
  const studentProfile = {
    fullName: 'Fatima Zahra',
    nationality: 'PK',
    residenceCountry: 'PK',
    currentEducationLevel: 'bachelors',
    targetDegreeLevels: ['masters'],
    fieldOfStudy: 'Public Policy',
    gpa: 3.8,
    gpaScale: 4.0,
    preferredCountries: ['GB'],
  };

  const match = calculateMatchScore(studentProfile, chevening);
  assert.equal(match.isEligible, true);
  assert.ok(match.matchScore >= 90, `Match score ${match.matchScore} should be >= 90`);

  await disconnectDatabase();
});
