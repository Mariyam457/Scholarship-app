import { ScholarshipModel } from '../models/Scholarship.js';
import { UserModel } from '../models/User.js';
import { ApiError } from '../utils/api-error.js';
import { slugify } from '../utils/text.utils.js';
import { calculateMatchScore } from '../services/eligibility-matcher.service.js';
import { logAuditEvent } from '../services/audit.service.js';

export async function listScholarships(req, res, next) {
  try {
    const {
      search,
      hostCountries,
      degreeLevels,
      fundingTypes,
      fieldsOfStudy,
      nationality,
      minGpa,
      deadlineBefore,
      deadlineAfter,
      verificationStatus,
      isRolling,
      page = 1,
      limit = 20,
      sortBy = 'deadline',
      sortOrder = 'asc',
    } = req.query;

    const query = { isActive: true };

    // Full text search
    if (search && search.trim()) {
      query.$text = { $search: search.trim() };
    }

    // Host countries filter
    const rawCountries = hostCountries || req.query.hostCountry;
    if (rawCountries) {
      const arr = Array.isArray(rawCountries) ? rawCountries : [rawCountries];
      query.hostCountries = { $in: arr.map((c) => String(c).toUpperCase()) };
    }

    // Degree levels filter
    const rawDegreeLevels = degreeLevels || req.query.degreeLevel;
    if (rawDegreeLevels) {
      const arr = Array.isArray(rawDegreeLevels) ? rawDegreeLevels : [rawDegreeLevels];
      query.degreeLevels = { $in: arr };
    }

    // Funding types filter
    const rawFundingTypes = fundingTypes || req.query.fundingType;
    if (rawFundingTypes) {
      const arr = Array.isArray(rawFundingTypes) ? rawFundingTypes : [rawFundingTypes];
      query.fundingType = { $in: arr };
    }

    // Fields of study filter
    if (fieldsOfStudy && fieldsOfStudy.length > 0) {
      query.fieldsOfStudy = { $in: fieldsOfStudy.map((f) => new RegExp(f, 'i')) };
    }

    // Multi-criteria clauses (combining nationality and GPA filters cleanly)
    const orClauses = [];

    // Nationality filter
    if (nationality) {
      const nat = nationality.toUpperCase();
      orClauses.push({
        $or: [
          { 'eligibility.eligibleNationalities': 'ALL' },
          { 'eligibility.eligibleNationalities': nat },
        ],
      });
    }

    // GPA filter (only scholarships whose minGpa is <= student's minGpa or not specified)
    if (typeof minGpa === 'number') {
      orClauses.push({
        $or: [
          { 'eligibility.minGpa': { $exists: false } },
          { 'eligibility.minGpa': { $lte: minGpa } },
        ],
      });
    }

    if (orClauses.length === 1) {
      query.$or = orClauses[0].$or;
    } else if (orClauses.length > 1) {
      query.$and = orClauses;
    }

    // Deadlines filter
    if (deadlineAfter || deadlineBefore) {
      query['deadlines.applicationDeadline'] = {};
      if (deadlineAfter) {
        query['deadlines.applicationDeadline'].$gte = new Date(deadlineAfter);
      }
      if (deadlineBefore) {
        query['deadlines.applicationDeadline'].$lte = new Date(deadlineBefore);
      }
    }

    if (verificationStatus) {
      query.verificationStatus = verificationStatus;
    }

    if (typeof isRolling === 'boolean') {
      query['deadlines.isRolling'] = isRolling;
    }

    // Sorting
    let sortOptions = {};
    const direction = sortOrder === 'desc' ? -1 : 1;

    if (sortBy === 'deadline') {
      sortOptions['deadlines.applicationDeadline'] = direction;
    } else if (sortBy === 'confidenceScore') {
      sortOptions['sourceAttribution.confidenceScore'] = -1;
    } else if (sortBy === 'createdAt') {
      sortOptions.createdAt = direction;
    } else if (sortBy === 'title') {
      sortOptions.title = direction;
    } else {
      sortOptions['deadlines.applicationDeadline'] = 1;
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [total, scholarships] = await Promise.all([
      ScholarshipModel.countDocuments(query),
      ScholarshipModel.find(query)
        .sort(sortOptions)
        .skip(skip)
        .limit(Number(limit))
        .populate('sourceAttribution.sourceId', 'name organization officialUrl automationState health'),
    ]);

    const totalPages = Math.ceil(total / Number(limit));

    res.json({
      success: true,
      data: {
        scholarships,
      },
      meta: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages,
        hasNextPage: Number(page) < totalPages,
        hasPrevPage: Number(page) > 1,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function getScholarshipById(req, res, next) {
  try {
    const { id } = req.params;
    const scholarship = await ScholarshipModel.findById(id).populate(
      'sourceAttribution.sourceId',
      'name organization officialUrl automationState health'
    );

    if (!scholarship) {
      return next(ApiError.notFound('Scholarship not found'));
    }

    // Increment view count asynchronously
    ScholarshipModel.findByIdAndUpdate(id, { $inc: { viewCount: 1 } }).exec();

    res.json({
      success: true,
      data: { scholarship },
    });
  } catch (error) {
    next(error);
  }
}

export async function getScholarshipBySlug(req, res, next) {
  try {
    const { slug } = req.params;
    const scholarship = await ScholarshipModel.findOne({ slug }).populate(
      'sourceAttribution.sourceId',
      'name organization officialUrl automationState health'
    );

    if (!scholarship) {
      return next(ApiError.notFound('Scholarship not found'));
    }

    ScholarshipModel.findByIdAndUpdate(scholarship._id, { $inc: { viewCount: 1 } }).exec();

    res.json({
      success: true,
      data: { scholarship },
    });
  } catch (error) {
    next(error);
  }
}

export async function matchForUser(req, res, next) {
  try {
    const user = await UserModel.findById(req.user.id);
    if (!user) {
      return next(ApiError.notFound('User not found'));
    }

    // Fetch all active scholarships with upcoming deadlines
    const scholarships = await ScholarshipModel.find({
      isActive: true,
      'deadlines.applicationDeadline': { $gte: new Date() },
    }).populate('sourceAttribution.sourceId', 'name organization officialUrl');

    const matchedResults = scholarships.map((sch) => {
      const matchResult = calculateMatchScore(user.profile, sch);
      return {
        scholarship: sch,
        ...matchResult,
      };
    });

    // Sort by match score descending
    matchedResults.sort((a, b) => b.matchScore - a.matchScore);

    res.json({
      success: true,
      data: {
        totalEvaluated: scholarships.length,
        matches: matchedResults.slice(0, 50), // Return top 50 matches
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function createScholarship(req, res, next) {
  try {
    const payload = req.body;
    let baseSlug = slugify(payload.title);
    let slug = baseSlug;
    let counter = 1;
    while (await ScholarshipModel.exists({ slug })) {
      slug = `${baseSlug}-${counter++}`;
    }

    const scholarship = await ScholarshipModel.create({
      ...payload,
      slug,
    });

    await logAuditEvent({
      actorId: req.user.id,
      actorEmail: req.user.email,
      actorRole: req.user.role,
      action: 'SCHOLARSHIP_CREATE',
      entityType: 'Scholarship',
      entityId: scholarship._id.toString(),
      changes: payload,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.status(201).json({
      success: true,
      message: 'Scholarship created successfully',
      data: { scholarship },
    });
  } catch (error) {
    next(error);
  }
}

export async function updateScholarship(req, res, next) {
  try {
    const { id } = req.params;
    const updates = req.body;

    const scholarship = await ScholarshipModel.findByIdAndUpdate(id, updates, { new: true });
    if (!scholarship) {
      return next(ApiError.notFound('Scholarship not found'));
    }

    await logAuditEvent({
      actorId: req.user.id,
      actorEmail: req.user.email,
      actorRole: req.user.role,
      action: 'SCHOLARSHIP_UPDATE',
      entityType: 'Scholarship',
      entityId: scholarship._id.toString(),
      changes: updates,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({
      success: true,
      message: 'Scholarship updated successfully',
      data: { scholarship },
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteScholarship(req, res, next) {
  try {
    const { id } = req.params;
    const scholarship = await ScholarshipModel.findByIdAndUpdate(
      id,
      { isActive: false },
      { new: true }
    );

    if (!scholarship) {
      return next(ApiError.notFound('Scholarship not found'));
    }

    await logAuditEvent({
      actorId: req.user.id,
      actorEmail: req.user.email,
      actorRole: req.user.role,
      action: 'SCHOLARSHIP_DEACTIVATE',
      entityType: 'Scholarship',
      entityId: id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({
      success: true,
      message: 'Scholarship deactivated successfully',
    });
  } catch (error) {
    next(error);
  }
}
