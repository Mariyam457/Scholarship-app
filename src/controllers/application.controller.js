import { ApplicationTrackerModel } from '../models/ApplicationTracker.js';
import { ScholarshipModel } from '../models/Scholarship.js';
import { ApiError } from '../utils/api-error.js';
import { ApplicationStatus } from '../constants/enums.js';

const DEFAULT_MILESTONES = [
  'Review Official Eligibility & Requirements',
  'Prepare Statement of Purpose / Motivation Essay',
  'Request 2 Academic Reference Letters',
  'Obtain Certified Transcript Translations',
  'Complete English Language Proficiency (IELTS/TOEFL)',
  'Submit Application on Official Portal',
];

export async function getUserApplications(req, res, next) {
  try {
    const applications = await ApplicationTrackerModel.find({ userId: req.user.id })
      .sort({ deadline: 1 })
      .populate('scholarshipId', 'title provider hostCountries fundingType sourceAttribution verificationStatus slug');

    res.json({
      success: true,
      data: { applications },
    });
  } catch (error) {
    next(error);
  }
}

export async function trackScholarship(req, res, next) {
  try {
    const { scholarshipId, status = ApplicationStatus.SAVED, notes = '', checklist = [] } = req.body;

    const scholarship = await ScholarshipModel.findById(scholarshipId);
    if (!scholarship) {
      return next(ApiError.notFound('Scholarship not found'));
    }

    const existing = await ApplicationTrackerModel.findOne({
      userId: req.user.id,
      scholarshipId,
    });

    if (existing) {
      return next(ApiError.conflict('You are already tracking this scholarship in your applications'));
    }

    // Default checklist if not provided
    const tasks = checklist.length > 0
      ? checklist
      : DEFAULT_MILESTONES.map((task) => ({ task, completed: false }));

    const application = await ApplicationTrackerModel.create({
      userId: req.user.id,
      scholarshipId: scholarship._id,
      scholarshipTitle: scholarship.title,
      provider: scholarship.provider,
      deadline: scholarship.deadlines.applicationDeadline,
      status,
      notes,
      checklist: tasks,
    });

    res.status(201).json({
      success: true,
      message: 'Scholarship added to application tracker',
      data: { application },
    });
  } catch (error) {
    next(error);
  }
}

export async function updateApplication(req, res, next) {
  try {
    const { id } = req.params;
    const updates = req.body;

    const application = await ApplicationTrackerModel.findOneAndUpdate(
      { _id: id, userId: req.user.id },
      updates,
      { new: true }
    );

    if (!application) {
      return next(ApiError.notFound('Tracked application not found'));
    }

    res.json({
      success: true,
      message: 'Application progress updated',
      data: { application },
    });
  } catch (error) {
    next(error);
  }
}

export async function removeApplication(req, res, next) {
  try {
    const { id } = req.params;
    const application = await ApplicationTrackerModel.findOneAndDelete({
      _id: id,
      userId: req.user.id,
    });

    if (!application) {
      return next(ApiError.notFound('Tracked application not found'));
    }

    res.json({
      success: true,
      message: 'Application removed from tracker',
    });
  } catch (error) {
    next(error);
  }
}
