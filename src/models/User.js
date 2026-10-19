import mongoose from 'mongoose';
import { UserRole, DegreeLevel, FundingType } from '../constants/enums.js';

const UserSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: Object.values(UserRole),
      default: UserRole.STUDENT,
      index: true,
    },
    profile: {
      fullName: { type: String, required: true, trim: true },
      avatarUrl: { type: String, default: '' },
      nationality: { type: String, required: true, trim: true, uppercase: true },
      residenceCountry: { type: String, required: true, trim: true, uppercase: true },
      currentEducationLevel: {
        type: String,
        enum: Object.values(DegreeLevel),
        default: DegreeLevel.BACHELORS,
      },
      targetDegreeLevels: [
        {
          type: String,
          enum: Object.values(DegreeLevel),
        },
      ],
      fieldOfStudy: { type: String, default: '' },
      gpa: { type: Number },
      gpaScale: { type: Number, default: 4.0 },
      preferredCountries: [{ type: String, uppercase: true }],
      preferredFundingTypes: [
        {
          type: String,
          enum: Object.values(FundingType),
        },
      ],
      languageProficiencies: [
        {
          language: { type: String, required: true },
          testName: { type: String },
          score: { type: String },
        },
      ],
      onboardingCompleted: { type: Boolean, default: false },
    },
    isActive: { type: Boolean, default: true },
    isEmailVerified: { type: Boolean, default: false },
    savedScholarships: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Scholarship' }],
    refreshTokenHash: { type: String },
    lastLoginAt: { type: Date },
  },
  {
    timestamps: true,
  }
);

export const UserModel = mongoose.model('User', UserSchema);
