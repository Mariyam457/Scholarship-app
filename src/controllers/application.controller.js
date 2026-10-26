import mongoose from 'mongoose';
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

    let scholarship = null;
    if (mongoose.isValidObjectId(scholarshipId)) {
      scholarship = await ScholarshipModel.findById(scholarshipId);
    }
    if (!scholarship) {
      scholarship = await ScholarshipModel.findOne({ slug: scholarshipId });
    }
    if (!scholarship) {
      return next(ApiError.notFound('Scholarship not found'));
    }

    const existing = await ApplicationTrackerModel.findOne({
      userId: req.user.id,
      scholarshipId: scholarship._id,
    });

    if (existing) {
      return res.status(200).json({
        success: true,
        message: 'Scholarship is already in your application tracker',
        data: { application: existing, alreadyTracked: true },
      });
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
      deadline: scholarship.deadlines?.applicationDeadline || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
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

    let targetScholarshipId = null;
    if (mongoose.isValidObjectId(id)) {
      targetScholarshipId = id;
    } else {
      const scholarship = await ScholarshipModel.findOne({ slug: id });
      if (scholarship) {
        targetScholarshipId = scholarship._id;
      }
    }

    const orConditions = [
      ...(mongoose.isValidObjectId(id) ? [{ _id: id }] : []),
      ...(targetScholarshipId ? [{ scholarshipId: targetScholarshipId }] : []),
    ];

    const application = orConditions.length > 0
      ? await ApplicationTrackerModel.findOneAndDelete({
          userId: req.user.id,
          $or: orConditions,
        })
      : null;

    res.json({
      success: true,
      message: 'Application removed from tracker',
      data: { deleted: Boolean(application) },
    });
  } catch (error) {
    next(error);
  }
}
