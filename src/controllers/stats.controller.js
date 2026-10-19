import { ScholarshipModel } from '../models/Scholarship.js';
import { SourceRegistryModel } from '../models/SourceRegistry.js';
import { ReviewQueueModel } from '../models/ReviewQueue.js';
import { UserModel } from '../models/User.js';
import { FundingType, VerificationStatus, ReviewStatus } from '../constants/enums.js';

export async function getPlatformStats(req, res, next) {
  try {
    const [
      totalScholarships,
      fullyFundedCount,
      hostCountriesList,
      totalSources,
      activeSources,
      pendingReviewsCount,
      totalUsers,
      recentlyVerified,
    ] = await Promise.all([
      ScholarshipModel.countDocuments({ isActive: true }),
      ScholarshipModel.countDocuments({ isActive: true, fundingType: FundingType.FULL_FUNDING }),
      ScholarshipModel.distinct('hostCountries', { isActive: true }),
      SourceRegistryModel.countDocuments(),
      SourceRegistryModel.countDocuments({ automationState: 'active' }),
      ReviewQueueModel.countDocuments({ status: ReviewStatus.PENDING }),
      UserModel.countDocuments(),
      ScholarshipModel.find({ isActive: true })
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
        totalUsers,
        recentlyVerified,
      },
    });
  } catch (error) {
    next(error);
  }
}
