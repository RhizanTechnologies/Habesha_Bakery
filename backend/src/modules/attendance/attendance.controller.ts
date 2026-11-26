import { Router, Request, Response } from 'express';
import { prisma } from '../../lib/prisma.js';
import { authMiddleware, requireRole, type AuthRequest } from '../../middleware/auth.js';
import { Role } from '@prisma/client';
import { saveBase64Media } from '../../lib/storage.js';
import { notificationsService } from '../notifications/notifications.service.js';

export const attendanceRouter = Router();

function parseTimeToMinutes(hhmm: string | null | undefined, fallbackMinutes: number): number {
  if (!hhmm || typeof hhmm !== 'string') return fallbackMinutes;
  const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(hhmm.trim());
  if (!match) return fallbackMinutes;
  return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
}

async function getCompanyAttendanceRules() {
  const company = await prisma.company.findFirst({
    select: {
      attendanceDayCheckInStart: true,
      attendanceDayCheckInEnd: true,
      attendanceNightCheckInStart: true,
      attendanceNightCheckInEnd: true,
      attendanceGraceMinutes: true,
      attendancePenaltyTier1Minutes: true,
      attendancePenaltyTier1Amount: true,
      attendancePenaltyTier2Minutes: true,
      attendancePenaltyTier2Amount: true,
    },
  });
  return {
    dayCheckInStart: company?.attendanceDayCheckInStart || '06:00',
    dayCheckInEnd: company?.attendanceDayCheckInEnd || '06:30',
    nightCheckInStart: company?.attendanceNightCheckInStart || '21:00',
    nightCheckInEnd: company?.attendanceNightCheckInEnd || '21:30',
    graceMinutes: company?.attendanceGraceMinutes ?? 0,
    tier1Minutes: company?.attendancePenaltyTier1Minutes ?? 30,
    tier1Amount: company ? Number(company.attendancePenaltyTier1Amount) : 50,
    tier2Minutes: company?.attendancePenaltyTier2Minutes ?? 60,
    tier2Amount: company ? Number(company.attendancePenaltyTier2Amount) : 100,
  };
}

// Helper to get local Ethiopian Time (UTC+3)
function getEatDateTime(date: Date = new Date()) {
  const eatOffsetMs = 3 * 60 * 60 * 1000;
  const eatDate = new Date(date.getTime() + eatOffsetMs);
  const year = eatDate.getUTCFullYear();
  const month = String(eatDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(eatDate.getUTCDate()).padStart(2, '0');
  const hours = eatDate.getUTCHours();
  const minutes = eatDate.getUTCMinutes();
  const dateStr = `${year}-${month}-${day}`;
  return { dateStr, hours, minutes, eatDate };
}

// Format YYYY-MM-DD for yesterday
function getPreviousDateStr(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

/**
 * Public Kiosk endpoint: Staff member punch-in or punch-out
 * Supports:
 * - 4-digit PIN verification
 * - Web camera facial verification snapshot (anti-tamper)
 * - Overnight shift crossover anchoring (21:00 - 06:00 shifts anchored to business date)
 * - Automated tardiness penalty creation when >30 min late
 */
attendanceRouter.post('/punch', async (req: Request, res: Response) => {
  try {
    const { pin, userId, branchId, type = 'PUNCH_IN', snapshot, voiceNote, notes } = req.body;

    // Lookup user
    let user;
    if (userId) {
      user = await prisma.user.findUnique({
        where: { id: userId },
        include: { branch: true },
      });
      if (!user) {
        return res.status(404).json({ error: 'Staff member not found.' });
      }

      if (user.requiresAttendance === false || user.role === Role.OWNER) {
        return res.status(403).json({ error: 'This staff member is not subject to attendance check-in.' });
      }

      // If a PIN is supplied, validate it. If PIN is empty/omitted, allow 1-Tap biometric facial punch!
      if (pin !== undefined && pin !== null && String(pin).trim() !== '') {
        const trimmedPin = String(pin).trim();
        if (!/^\d{4}$/.test(trimmedPin)) {
          return res.status(400).json({ error: 'PIN must be exactly 4 numeric digits.' });
        }
        const expectedPin = user.attendancePin || '1234';
        if (expectedPin !== trimmedPin) {
          return res.status(401).json({ error: 'Incorrect 4-digit PIN. Please try again.' });
        }
      }
    } else {
      // Direct PIN punch without selecting name
      if (!pin || typeof pin !== 'string') {
        return res.status(400).json({ error: 'Please select your name or enter your 4-digit PIN.' });
      }

      const trimmedPin = pin.trim();
      if (!/^\d{4}$/.test(trimmedPin)) {
        return res.status(400).json({ error: 'PIN must be exactly 4 numeric digits.' });
      }

      // Find by PIN in the branch (or globally if branch not provided)
      const query: any = {
        isActive: true,
        requiresAttendance: true,
        attendancePin: trimmedPin,
        role: { not: Role.OWNER },
      };
      if (branchId) {
        query.branchId = branchId;
      }
      const candidates = await prisma.user.findMany({
        where: query,
        include: { branch: true },
      });

      if (candidates.length === 0) {
        return res.status(401).json({ error: 'No active staff member matched this PIN.' });
      }
      if (candidates.length > 1) {
        return res.status(400).json({
          error: 'Multiple employees share this PIN. Please select your name on the kiosk screen first.',
        });
      }
      user = candidates[0];
    }

    if (!user.isActive) {
      return res.status(403).json({ error: 'Account is deactivated. Contact management.' });
    }

    const effectiveBranchId = branchId || user.branchId;
    if (!effectiveBranchId) {
      return res.status(400).json({ error: 'Branch ID is required for punch-in.' });
    }

    const now = new Date();
    const { dateStr, hours, minutes } = getEatDateTime(now);
    const userShift = user.shift || 'DAY';

    // Overnight shift crossover calculation:
    // If NIGHT shift and punching between 00:00 and 06:00, anchor to the PREVIOUS day's business date
    let businessDate = dateStr;
    if (userShift === 'NIGHT' && hours < 6) {
      businessDate = getPreviousDateStr(dateStr);
    }

    // Strict duplicate punch validation & shift workflow integrity
    if (type === 'PUNCH_IN') {
      const existingIn = await prisma.attendanceRecord.findFirst({
        where: {
          userId: user.id,
          businessDate,
          type: 'PUNCH_IN',
        },
        orderBy: { punchTime: 'desc' },
      });

      if (existingIn) {
        const timeStr = new Date(existingIn.punchTime).toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'Africa/Addis_Ababa',
        });
        return res.status(409).json({
          error: `${user.fullName} has already clocked in for today (${businessDate}) at ${timeStr}. Duplicate entry punches are not permitted.`,
          alreadyPunched: true,
          existingRecord: existingIn,
        });
      }
    } else if (type === 'PUNCH_OUT') {
      // Must clock in before clocking out
      const existingIn = await prisma.attendanceRecord.findFirst({
        where: {
          userId: user.id,
          businessDate,
          type: 'PUNCH_IN',
        },
      });

      if (!existingIn) {
        return res.status(400).json({
          error: `${user.fullName} cannot clock out because no entry punch (PUNCH_IN) was recorded for today (${businessDate}). Please clock in first.`,
        });
      }

      // Cannot clock out twice for the same shift/day
      const existingOut = await prisma.attendanceRecord.findFirst({
        where: {
          userId: user.id,
          businessDate,
          type: 'PUNCH_OUT',
        },
        orderBy: { punchTime: 'desc' },
      });

      if (existingOut) {
        const timeStr = new Date(existingOut.punchTime).toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'Africa/Addis_Ababa',
        });
        return res.status(409).json({
          error: `${user.fullName} has already clocked out for today (${businessDate}) at ${timeStr}. Duplicate exit punches are not permitted.`,
          alreadyPunched: true,
          existingRecord: existingOut,
        });
      }
    }

    // Tardiness calculation (for PUNCH_IN only)
    let isLate = false;
    let lateMinutes = 0;
    let createdPenalty = null;

    if (type === 'PUNCH_IN') {
      const rules = await getCompanyAttendanceRules();
      if (userShift === 'DAY') {
        const endMinutes = parseTimeToMinutes(rules.dayCheckInEnd, 6 * 60 + 30);
        const actualMinutes = hours * 60 + minutes;
        if (actualMinutes > endMinutes) {
          isLate = true;
          lateMinutes = actualMinutes - endMinutes;
        }
      } else if (userShift === 'NIGHT') {
        const startMinutes = parseTimeToMinutes(rules.nightCheckInStart, 21 * 60);
        let endMinutes = parseTimeToMinutes(rules.nightCheckInEnd, 21 * 60 + 30);
        if (endMinutes < startMinutes) {
          endMinutes += 24 * 60;
        }
        let actualMinutes = hours * 60 + minutes;
        if (hours < 6) {
          actualMinutes += 24 * 60;
        }
        if (actualMinutes > endMinutes) {
          isLate = true;
          lateMinutes = actualMinutes - endMinutes;
        }
      }

      // Automatically create pending tardiness penalty using Owner's configured penalty range
      if (isLate && lateMinutes > 0) {
        const penaltyFee = lateMinutes <= rules.tier1Minutes ? rules.tier1Amount : rules.tier2Amount;
        if (penaltyFee > 0) {
          createdPenalty = await prisma.penalty.create({
            data: {
              userId: user.id,
              amount: penaltyFee,
              reason: `Late Check-in Penalty: ${lateMinutes} mins past check-in window (${userShift} shift on ${businessDate})`,
              status: 'PENDING_APPROVAL',
              isDeducted: false,
              date: now,
            },
          });
        }
      }
    }

    // Persist media blobs to filesystem and store clean static URLs to protect Postgres storage
    const savedSnapshotUrl = saveBase64Media(snapshot, 'attendance');
    const savedVoiceNoteUrl = saveBase64Media(voiceNote, 'audio');

    // Create Attendance Record
    const record = await prisma.attendanceRecord.create({
      data: {
        userId: user.id,
        branchId: effectiveBranchId,
        businessDate,
        shift: userShift,
        type: type === 'PUNCH_OUT' ? 'PUNCH_OUT' : 'PUNCH_IN',
        punchTime: now,
        snapshotUrl: savedSnapshotUrl,
        voiceNoteUrl: savedVoiceNoteUrl,
        isLate,
        lateMinutes,
        penaltyId: createdPenalty ? createdPenalty.id : null,
        notes: notes || null,
      },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            role: true,
            phone: true,
            avatarUrl: true,
          },
        },
        branch: {
          select: {
            id: true,
            name: true,
          },
        },
        penalty: true,
      },
    });

    return res.status(201).json({
      success: true,
      message: `${user.fullName} successfully ${type === 'PUNCH_IN' ? 'clocked in' : 'clocked out'}.`,
      record,
      tardiness: {
        isLate,
        lateMinutes,
        penaltyAmount: createdPenalty ? Number(createdPenalty.amount) : 0,
        penaltyId: createdPenalty?.id,
      },
    });
  } catch (err: any) {
    console.error('Attendance Punch Error:', err);
    return res.status(500).json({ error: err.message || 'Failed to record attendance punch.' });
  }
});

/**
 * Public Kiosk endpoint: Active branches list for kiosk device dropdown
 */
attendanceRouter.get('/branches', async (req: Request, res: Response) => {
  try {
    const branches = await prisma.branch.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
      },
      orderBy: { name: 'asc' },
    });

    return res.json(branches);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to fetch kiosk branches.' });
  }
});

/**
 * Public Kiosk endpoint: Staff list for branch kiosk touch selection
 */
attendanceRouter.get('/staff-list', async (req: Request, res: Response) => {
  try {
    const branchId = req.query.branchId as string | undefined;
    const where: any = {
      isActive: true,
      requiresAttendance: true,
      role: { not: Role.OWNER },
    };
    if (branchId) {
      where.branchId = branchId;
    }

    const staff = await prisma.user.findMany({
      where,
      select: {
        id: true,
        fullName: true,
        role: true,
        shift: true,
        avatarUrl: true,
        branchId: true,
        attendancePin: true,
        requiresAttendance: true,
        branch: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { fullName: 'asc' },
    });

    // Attach today's live punch status for each staff member
    const now = new Date();
    const { dateStr } = getEatDateTime(now);
    const todayPunches = await prisma.attendanceRecord.findMany({
      where: {
        businessDate: dateStr,
      },
      select: {
        userId: true,
        type: true,
        punchTime: true,
      },
    });

    const staffWithStatus = staff.map((s) => {
      const userPunches = todayPunches.filter((p) => p.userId === s.id);
      const punchInRecord = userPunches.find((p) => p.type === 'PUNCH_IN');
      const punchOutRecord = userPunches.find((p) => p.type === 'PUNCH_OUT');

      return {
        ...s,
        todayStatus: {
          hasPunchedIn: !!punchInRecord,
          hasPunchedOut: !!punchOutRecord,
          punchInTime: punchInRecord?.punchTime || null,
          punchOutTime: punchOutRecord?.punchTime || null,
        },
      };
    });

    return res.json(staffWithStatus);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to fetch staff list.' });
  }
});

/**
 * Public Kiosk & Employee Rules endpoint:
 * Exposes Owner-configured check-in time ranges, penalty tiers, and current EAT server time
 */
attendanceRouter.get('/rules', async (_req: Request, res: Response) => {
  try {
    const rules = await getCompanyAttendanceRules();
    const { dateStr, hours, minutes } = getEatDateTime(new Date());
    return res.json({
      ...rules,
      serverTimeEat: { dateStr, hours, minutes },
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to fetch attendance rules.' });
  }
});

// Authenticated endpoints below
attendanceRouter.use(authMiddleware);

/**
 * GET /api/attendance
 * Management audit view of check-in records with snapshots and tardiness
 */
attendanceRouter.get('/', requireRole('OWNER', 'ADMIN', 'BRANCH_MANAGER'), async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const isGlobal = user.role === Role.OWNER;
    let effectiveBranchId: string | undefined;

    if (isGlobal) {
      // OWNER has unrestricted enterprise visibility across all branches
      effectiveBranchId = req.query.branchId as string | undefined;
    } else {
      // ADMIN and BRANCH_MANAGER are STRICTLY restricted to their assigned branch only
      if (!user.branchId) {
        return res.status(403).json({ error: 'Access denied: You have no assigned branch.' });
      }
      effectiveBranchId = user.branchId;
    }

    const date = req.query.date as string | undefined;
    const userId = req.query.userId as string | undefined;
    const type = req.query.type as string | undefined;
    const limit = Math.min(Number(req.query.limit) || 100, 500);

    const where: any = {};
    if (effectiveBranchId) where.branchId = effectiveBranchId;
    if (date) where.businessDate = date;
    if (userId) where.userId = userId;
    if (type) where.type = type;

    const records = await prisma.attendanceRecord.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            role: true,
            phone: true,
            shift: true,
            avatarUrl: true,
          },
        },
        branch: {
          select: {
            id: true,
            name: true,
          },
        },
        penalty: true,
      },
      orderBy: { punchTime: 'desc' },
      take: limit,
    });

    // Summary calculations
    const totalPunches = records.length;
    const latePunches = records.filter((r) => r.isLate).length;
    const onTimePunches = totalPunches - latePunches;

    return res.json({
      records,
      summary: {
        totalPunches,
        onTimePunches,
        latePunches,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to fetch attendance records.' });
  }
});

/**
 * GET /api/attendance/penalty-config
 * Returns the Owner-configured check-in time range & penalty range
 */
attendanceRouter.get('/penalty-config', requireRole('OWNER', 'ADMIN', 'BRANCH_MANAGER'), async (req: AuthRequest, res: Response) => {
  try {
    const rules = await getCompanyAttendanceRules();
    return res.json({
      dayCheckInStart: rules.dayCheckInStart,
      dayCheckInEnd: rules.dayCheckInEnd,
      nightCheckInStart: rules.nightCheckInStart,
      nightCheckInEnd: rules.nightCheckInEnd,
      attendanceGraceMinutes: rules.graceMinutes,
      attendancePenaltyTier1Minutes: rules.tier1Minutes,
      attendancePenaltyTier1Amount: rules.tier1Amount,
      attendancePenaltyTier2Minutes: rules.tier2Minutes,
      attendancePenaltyTier2Amount: rules.tier2Amount,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to fetch penalty configuration.' });
  }
});

/**
 * POST /api/attendance/penalty-config
 * Allows OWNER to configure check-in time ranges and penalty fee ranges
 */
attendanceRouter.post('/penalty-config', requireRole('OWNER'), async (req: AuthRequest, res: Response) => {
  try {
    const {
      dayCheckInStart,
      dayCheckInEnd,
      nightCheckInStart,
      nightCheckInEnd,
      graceMinutes,
      tier1Minutes,
      tier1Amount,
      tier2Minutes,
      tier2Amount,
    } = req.body;
    const company = await prisma.company.findFirst();
    if (!company) {
      return res.status(404).json({ error: 'Company not found.' });
    }
    const timeRegex = /^([01]?\d|2[0-3]):[0-5]\d$/;
    for (const [label, val] of [
      ['dayCheckInStart', dayCheckInStart],
      ['dayCheckInEnd', dayCheckInEnd],
      ['nightCheckInStart', nightCheckInStart],
      ['nightCheckInEnd', nightCheckInEnd],
    ]) {
      if (val !== undefined && !timeRegex.test(String(val).trim())) {
        return res.status(400).json({ error: `Invalid time format for ${label}. Expected HH:MM (24-hour).` });
      }
    }

    const updated = await prisma.company.update({
      where: { id: company.id },
      data: {
        ...(dayCheckInStart !== undefined && { attendanceDayCheckInStart: String(dayCheckInStart).trim() }),
        ...(dayCheckInEnd !== undefined && { attendanceDayCheckInEnd: String(dayCheckInEnd).trim() }),
        ...(nightCheckInStart !== undefined && { attendanceNightCheckInStart: String(nightCheckInStart).trim() }),
        ...(nightCheckInEnd !== undefined && { attendanceNightCheckInEnd: String(nightCheckInEnd).trim() }),
        attendanceGraceMinutes: graceMinutes !== undefined ? Number(graceMinutes) : undefined,
        attendancePenaltyTier1Minutes: tier1Minutes !== undefined ? Number(tier1Minutes) : undefined,
        attendancePenaltyTier1Amount: tier1Amount !== undefined ? Number(tier1Amount) : undefined,
        attendancePenaltyTier2Minutes: tier2Minutes !== undefined ? Number(tier2Minutes) : undefined,
        attendancePenaltyTier2Amount: tier2Amount !== undefined ? Number(tier2Amount) : undefined,
      },
    });
    return res.json({ success: true, message: 'Attendance check-in times & penalty ranges updated successfully.', company: updated });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to update penalty configuration.' });
  }
});

/**
 * POST /api/attendance/penalties/:id/approve
 * OWNER or ADMIN: Approves an attendance penalty so it is registered for payroll deduction
 */
attendanceRouter.post('/penalties/:id/approve', requireRole('OWNER', 'ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const penalty = await prisma.penalty.findUnique({ where: { id: req.params.id } });
    if (!penalty) {
      return res.status(404).json({ error: 'Penalty record not found.' });
    }
    const updated = await prisma.penalty.update({
      where: { id: req.params.id },
      data: { status: 'APPROVED' },
    });
    await notificationsService.notifyUsers({
      userIds: [penalty.userId],
      type: 'ATTENDANCE_PENALTY_APPROVED',
      titleKey: 'Late Check-In Penalty Registered',
      bodyKey: `A late check-in penalty of ${Number(updated.amount).toFixed(0)} ETB has been approved and registered to your penalties.`,
      link: '/my-profile',
    }).catch(() => {});
    return res.json({ success: true, message: 'Penalty approved and registered for payroll deduction.', penalty: updated });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to approve penalty.' });
  }
});

/**
 * POST /api/attendance/penalties/:id/waive
 * OWNER or ADMIN: Waives / forgives an attendance penalty (e.g. after hearing voice explanation)
 */
attendanceRouter.post('/penalties/:id/waive', requireRole('OWNER', 'ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const { reason } = req.body;
    const penalty = await prisma.penalty.findUnique({ where: { id: req.params.id } });
    if (!penalty) {
      return res.status(404).json({ error: 'Penalty record not found.' });
    }
    const updated = await prisma.penalty.update({
      where: { id: req.params.id },
      data: {
        status: 'REJECTED',
        reason: `${penalty.reason} [WAIVED: ${reason || 'Explanation Accepted'}]`,
      },
    });
    await notificationsService.notifyUsers({
      userIds: [penalty.userId],
      type: 'ATTENDANCE_PENALTY_WAIVED',
      titleKey: 'Late Check-In Penalty Waived',
      bodyKey: `Your pending late check-in penalty of ${Number(penalty.amount).toFixed(0)} ETB was waived by management.`,
      link: '/my-profile',
    }).catch(() => {});
    return res.json({ success: true, message: 'Penalty waived and forgiven.', penalty: updated });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to waive penalty.' });
  }
});

/**
 * POST /api/attendance/penalties/batch-approve
 * OWNER or ADMIN: Batch approves all pending attendance penalties
 * Accepts optional { ids, branchId, businessDate }
 */
attendanceRouter.post('/penalties/batch-approve', requireRole('OWNER', 'ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const { ids, branchId, businessDate } = req.body;
    const whereClause: any = {
      status: 'PENDING_APPROVAL',
      attendanceRecords: { some: {} },
    };

    if (ids && Array.isArray(ids) && ids.length > 0) {
      whereClause.id = { in: ids };
    } else {
      if (branchId) {
        whereClause.attendanceRecords = { some: { branchId } };
      }
      if (businessDate) {
        whereClause.attendanceRecords = {
          some: {
            ...(branchId ? { branchId } : {}),
            businessDate,
          },
        };
      }
    }

    const updated = await prisma.penalty.updateMany({
      where: whereClause,
      data: { status: 'APPROVED' },
    });

    return res.json({
      success: true,
      message: `Batch approved ${updated.count} attendance penalties.`,
      count: updated.count,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to batch approve penalties.' });
  }
});

/**
 * POST /api/attendance/set-pin
 * Set or reset employee 4-digit PIN
 */
attendanceRouter.post('/set-pin', requireRole('OWNER', 'ADMIN', 'BRANCH_MANAGER'), async (req: AuthRequest, res: Response) => {
  try {
    const { userId, pin } = req.body;
    if (!userId || !pin) {
      return res.status(400).json({ error: 'userId and 4-digit pin are required.' });
    }

    const trimmedPin = String(pin).trim();
    if (!/^\d{4}$/.test(trimmedPin)) {
      return res.status(400).json({ error: 'PIN must be exactly 4 digits.' });
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { attendancePin: trimmedPin },
      select: {
        id: true,
        fullName: true,
        phone: true,
        attendancePin: true,
      },
    });

    return res.json({
      success: true,
      message: `PIN for ${updated.fullName} successfully updated.`,
      user: updated,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to update attendance PIN.' });
  }
});

/**
 * POST /api/attendance/my-pin
 * Allows any authenticated staff member to update their own 4-digit Attendance Kiosk PIN
 */
attendanceRouter.post('/my-pin', async (req: AuthRequest, res: Response) => {
  try {
    const { pin } = req.body;
    if (!pin) {
      return res.status(400).json({ error: '4-digit PIN is required.' });
    }

    const trimmedPin = String(pin).trim();
    if (!/^\d{4}$/.test(trimmedPin)) {
      return res.status(400).json({ error: 'PIN must be exactly 4 digits.' });
    }

    const updated = await prisma.user.update({
      where: { id: req.user!.id },
      data: { attendancePin: trimmedPin },
      select: {
        id: true,
        fullName: true,
        attendancePin: true,
      },
    });

    return res.json({
      success: true,
      message: 'Your attendance kiosk PIN was successfully updated.',
      user: updated,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to update attendance PIN.' });
  }
});

