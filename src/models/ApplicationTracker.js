import mongoose from 'mongoose';
import { ApplicationStatus } from '../constants/enums.js';

const ApplicationTrackerSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    scholarshipId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Scholarship',
      required: true,
      index: true,
    },
    scholarshipTitle: { type: String, required: true },
    provider: { type: String, required: true },
    deadline: { type: Date, required: true },
    status: {
      type: String,
      enum: Object.values(ApplicationStatus),
      default: ApplicationStatus.SAVED,
      index: true,
    },
    notes: { type: String, default: '' },
    checklist: [
      {
        task: { type: String, required: true },
        completed: { type: Boolean, default: false },
        dueDate: { type: Date },
      },
    ],
    appliedDate: { type: Date },
    decisionDate: { type: Date },
  },
  {
    timestamps: true,
  }
);

ApplicationTrackerSchema.index({ userId: 1, scholarshipId: 1 }, { unique: true });

export const ApplicationTrackerModel = mongoose.model('ApplicationTracker', ApplicationTrackerSchema);
