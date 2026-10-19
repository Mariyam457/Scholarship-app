import { AuditLogModel } from '../models/AuditLog.js';
import { logger } from '../config/logger.js';

export async function logAuditEvent({
  actorId = null,
  actorEmail = 'system',
  actorRole = 'system',
  action,
  entityType,
  entityId = null,
  changes = null,
  metadata = null,
  ipAddress = null,
  userAgent = null,
}) {
  try {
    await AuditLogModel.create({
      actorId,
      actorEmail,
      actorRole,
      action,
      entityType,
      entityId,
      changes,
      metadata,
      ipAddress,
      userAgent,
    });
  } catch (error) {
    logger.error('Failed to write audit log:', error);
  }
}
