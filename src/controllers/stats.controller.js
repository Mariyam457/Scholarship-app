import { ScholarshipModel } from '../models/Scholarship.js';
import { SourceRegistryModel } from '../models/SourceRegistry.js';
import { ReviewQueueModel } from '../models/ReviewQueue.js';
import { UserModel } from '../models/User.js';
import { FundingType, VerificationStatus, ReviewStatus } from '../constants/enums.js';

export async function getPlatformStats(req, res, next) {
  try {
    const visibleFilter = { isActive: true, 'linkHealth.isBroken': { $ne: true } };

    const [
      totalScholarships,
      fullyFundedCount,
      hostCountriesList,
      totalSources,
      activeSources,
      pendingReviewsCount,
      brokenLinksCount,
      totalUsers,
      recentlyVerified,
    ] = await Promise.all([
      ScholarshipModel.countDocuments(visibleFilter),
      ScholarshipModel.countDocuments({ ...visibleFilter, fundingType: FundingType.FULL_FUNDING }),
      ScholarshipModel.distinct('hostCountries', visibleFilter),
      SourceRegistryModel.countDocuments(),
      SourceRegistryModel.countDocuments({ automationState: 'active' }),
      ReviewQueueModel.countDocuments({ status: ReviewStatus.PENDING }),
      ScholarshipModel.countDocuments({ isActive: true, 'linkHealth.isBroken': true }),
      UserModel.countDocuments(),
      ScholarshipModel.find(visibleFilter)
        .sort({ 'sourceAttribution.lastVerifiedAt': -1 })
        .limit(5)
        .select('title provider hostCountries deadlines verificationStatus sourceAttribution slug'),
    ]);

    res.json({
      success: true,
      data: {
        totalScholarships,
        fullyFundedCount,
        totalHostCountries: hostCountriesList.length,
        hostCountriesList,
        totalSources,
        activeSources,
        pendingReviewsCount,
        brokenLinksCount,
        totalUsers,
        recentlyVerified,
      },
    });
  } catch (error) {
    next(error);
  }
}
