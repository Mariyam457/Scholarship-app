import { UserModel } from '../models/User.js';
import { ApiError } from '../utils/api-error.js';
import { hashPassword, verifyPassword, generateTokens, hashRefreshToken } from '../services/auth.service.js';
import { logAuditEvent } from '../services/audit.service.js';
import { sendPasswordResetEmail } from '../services/email.service.js';
import { UserRole } from '../constants/enums.js';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export async function register(req, res, next) {
  try {
    const { email, password, fullName, nationality, residenceCountry } = req.body;

    const existingUser = await UserModel.findOne({ email });
    if (existingUser) {
      return next(ApiError.conflict('An account with this email address already exists'));
    }

    const passwordHash = await hashPassword(password);

    const user = await UserModel.create({
      email,
      passwordHash,
      role: UserRole.STUDENT,
      profile: {
        fullName,
        nationality,
        residenceCountry,
        preferredCountries: [],
        preferredFundingTypes: [],
        targetDegreeLevels: [],
        languageProficiencies: [],
        onboardingCompleted: false,
      },
    });

    const tokens = generateTokens({
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
    });

    user.refreshTokenHash = hashRefreshToken(tokens.refreshToken);
    user.lastLoginAt = new Date();
    await user.save();

    await logAuditEvent({
      actorId: user._id,
      actorEmail: user.email,
      actorRole: user.role,
      action: 'USER_REGISTER',
      entityType: 'User',
      entityId: user._id.toString(),
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.status(201).json({
      success: true,
      message: 'Account registered successfully',
      data: {
        user: {
          id: user._id,
          email: user.email,
          role: user.role,
          profile: user.profile,
          savedScholarships: user.savedScholarships,
        },
        tokens,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    const user = await UserModel.findOne({ email });
    if (!user) {
      return next(ApiError.unauthorized('Invalid email or password'));
    }

    if (!user.isActive) {
      return next(ApiError.forbidden('Your account has been deactivated'));
    }

    const isMatch = await verifyPassword(password, user.passwordHash);
    if (!isMatch) {
      return next(ApiError.unauthorized('Invalid email or password'));
    }

    const tokens = generateTokens({
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
    });

    user.refreshTokenHash = hashRefreshToken(tokens.refreshToken);
    user.lastLoginAt = new Date();
    await user.save();

    await logAuditEvent({
      actorId: user._id,
      actorEmail: user.email,
      actorRole: user.role,
      action: 'USER_LOGIN',
      entityType: 'User',
      entityId: user._id.toString(),
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user._id,
          email: user.email,
          role: user.role,
          profile: user.profile,
          savedScholarships: user.savedScholarships,
        },
        tokens,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function refreshToken(req, res, next) {
  try {
    const { refreshToken: token } = req.body;

    let decoded;
    try {
      decoded = jwt.verify(token, env.JWT_SECRET);
    } catch {
      return next(ApiError.unauthorized('Invalid or expired refresh token'));
    }

    const user = await UserModel.findById(decoded.userId);
    if (!user || !user.isActive) {
      return next(ApiError.unauthorized('Account inactive or not found'));
    }

    const hashed = hashRefreshToken(token);
    if (user.refreshTokenHash !== hashed) {
      return next(ApiError.unauthorized('Refresh token revoked or reused'));
    }

    const newTokens = generateTokens({
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
    });

    user.refreshTokenHash = hashRefreshToken(newTokens.refreshToken);
    await user.save();

    res.json({
      success: true,
      data: {
        tokens: newTokens,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function getProfile(req, res, next) {
  try {
    const user = await UserModel.findById(req.user.id)
      .select('-passwordHash -refreshTokenHash')
      .populate('savedScholarships', 'title provider hostCountries deadlines fundingType verificationStatus');

    if (!user) {
      return next(ApiError.notFound('User not found'));
    }

    res.json({
      success: true,
      data: { user },
    });
  } catch (error) {
    next(error);
  }
}

export async function updateProfile(req, res, next) {
  try {
    const updates = req.body;
    const user = await UserModel.findById(req.user.id);
    if (!user) {
      return next(ApiError.notFound('User not found'));
    }

    // Merge profile updates
    for (const [key, val] of Object.entries(updates)) {
      if (val !== undefined) {
        user.profile[key] = val;
      }
    }

    await user.save();

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: { profile: user.profile },
    });
  } catch (error) {
    next(error);
  }
}

export async function toggleSaveScholarship(req, res, next) {
  try {
    const { scholarshipId } = req.params;
    const user = await UserModel.findById(req.user.id);
    if (!user) {
      return next(ApiError.notFound('User not found'));
    }

    const index = user.savedScholarships.indexOf(scholarshipId);
    let isSaved = false;

    if (index > -1) {
      user.savedScholarships.splice(index, 1);
      isSaved = false;
    } else {
      user.savedScholarships.push(scholarshipId);
      isSaved = true;
    }

    await user.save();

    res.json({
      success: true,
      message: isSaved ? 'Scholarship saved to your bookmarks' : 'Scholarship removed from bookmarks',
      data: {
        isSaved,
        savedScholarships: user.savedScholarships,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function forgotPassword(req, res, next) {
  try {
    const { email } = req.body;
    const user = await UserModel.findOne({ email });

    // For privacy/security, even if user doesn't exist, return a generic message,
    // but if user exists, generate OTP and dispatch email
    if (!user) {
      return res.json({
        success: true,
        message: 'If an account exists with this email, a 6-digit password reset code has been sent.',
      });
    }

    // Generate 6-digit numeric OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.resetPasswordOtp = otp;
    user.resetPasswordExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 mins
    await user.save();

    const mailResult = await sendPasswordResetEmail({
      to: user.email,
      otp,
      userName: user.profile?.fullName || 'Scholar',
    });

    await logAuditEvent({
      actorId: user._id,
      actorEmail: user.email,
      actorRole: user.role,
      action: 'PASSWORD_RESET_REQUESTED',
      entityType: 'User',
      entityId: user._id.toString(),
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({
      success: true,
      message: mailResult?.delivered
        ? 'A 6-digit verification code has been sent to your email address.'
        : 'Development Mode: Verification code generated and logged in terminal.',
      devOtp: !mailResult?.delivered ? otp : undefined,
    });
  } catch (error) {
    next(error);
  }
}

export async function resetPassword(req, res, next) {
  try {
    const { email, otp, newPassword } = req.body;
    const user = await UserModel.findOne({ email });

    if (
      !user ||
      !user.resetPasswordOtp ||
      user.resetPasswordOtp !== otp.trim() ||
      !user.resetPasswordExpires ||
      user.resetPasswordExpires < new Date()
    ) {
      return next(ApiError.badRequest('Invalid or expired password reset verification code.'));
    }

    // Hash and update password
    user.passwordHash = await hashPassword(newPassword);
    user.resetPasswordOtp = undefined;
    user.resetPasswordExpires = undefined;
    user.refreshTokenHash = undefined; // Force re-login on all devices
    await user.save();

    await logAuditEvent({
      actorId: user._id,
      actorEmail: user.email,
      actorRole: user.role,
      action: 'PASSWORD_RESET_COMPLETED',
      entityType: 'User',
      entityId: user._id.toString(),
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({
      success: true,
      message: 'Your password has been reset successfully. You can now log in with your new password.',
    });
  } catch (error) {
    next(error);
  }
}

