import bcrypt from 'bcryptjs';
import { prisma } from '../../lib/prisma.js';
import type { ServiceResponse, ServiceResult } from '../../types/service-response.js';

const userSelect = {
  id: true,
  fullName: true,
  phone: true,
  role: true,
  branchId: true,
  customRoleId: true,
  permissions: true,
  isActive: true,
  createdAt: true,
  salary: true,
  dailyExpense: true,
  startDate: true,
  lastPaidDate: true,
  shift: true,
  requiresAttendance: true,
  avatarUrl: true,
  filesUrl: true,
  customRole: {
    select: {
      id: true,
      code: true,
      name: true,
      nameAm: true,
      nameOm: true,
      description: true,
      baseRole: true,
      permissions: true,
    },
  },
} as const;

const HUB_ONLY_ROLES = new Set(['BAKER', 'CAKE_WORKER', 'SAMBUSA_WORKER', 'STOCK_KEEPER']);
const HUB_ONLY_PRIVILEGES = new Set(['access_production', 'access_stock']);

async function validateBranchRoleCompatibility(
  branchId: string | null | undefined,
  role: string,
  customRoleId?: string | null
): Promise<string | null> {
  if (!branchId) return null;
  const branch = await prisma.branch.findUnique({
    where: { id: branchId },
    select: { id: true, name: true, isHub: true },
  });
  if (!branch) return 'Assigned branch not found';
  if (branch.isHub) return null;

  if (HUB_ONLY_ROLES.has(role)) {
    return `Role "${role}" is only allowed on Production Hub branches. Retail branch "${branch.name}" only supports retail and management roles (Admin, Cashier, Employee).`;
  }
  if (customRoleId) {
    const cr = await prisma.customRole.findUnique({
      where: { id: customRoleId },
      select: { name: true, baseRole: true },
    });
    if (cr && HUB_ONLY_ROLES.has(cr.baseRole)) {
      return `Custom role "${cr.name}" is based on "${cr.baseRole}" and can only be assigned to Production Hub branches.`;
    }
  }
  return null;
}

function toDecimal(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const n = parseFloat(v);
    return Number.isNaN(n) ? null : n;
  }
  return null;
}

export class UsersService {
  async getUsers(branchId?: string, isPrivileged: boolean = true): ServiceResult {
    const where = branchId ? { branchId } : {};
    const list = await prisma.user.findMany({
      where,
      select: {
        id: true,
        fullName: true,
        phone: true,
        role: true,
        branchId: true,
        customRoleId: true,
        permissions: true,
        isActive: true,
        createdAt: true,
        salary: isPrivileged,
        dailyExpense: isPrivileged,
        startDate: true,
        lastPaidDate: true,
        shift: true,
        requiresAttendance: true,
        avatarUrl: true,
        filesUrl: isPrivileged,
        branch: { select: { name: true, isHub: true } },
        customRole: {
          select: {
            id: true,
            code: true,
            name: true,
            nameAm: true,
            nameOm: true,
            description: true,
            baseRole: true,
            permissions: true,
          },
        },
      },
      orderBy: { fullName: 'asc' },
    });
    return { data: list };
  }

  async getUserById(id: string): ServiceResult {
    const user = await prisma.user.findUnique({
      where: { id },
      select: { ...userSelect, branch: true },
    });
    if (!user) {
      return { error: 'User not found', status: 404 };
    }
    return { data: user };
  }

  async getEmployeeDashboard(userId: string): ServiceResult {
    try {
      const rows: any = await prisma.$queryRaw`
        SELECT 
          (
            SELECT row_to_json(u)
            FROM (
              SELECT 
                usr.id, usr."fullName", usr.phone, usr.role, usr."branchId", usr."isActive", 
                usr."createdAt", usr.salary, usr."startDate", usr."lastPaidDate", usr.shift, 
                usr."avatarUrl", usr."filesUrl", usr."customRoleId", usr.permissions,
                CASE WHEN b.id IS NOT NULL THEN json_build_object('id', b.id, 'name', b.name) ELSE NULL END AS branch,
                CASE WHEN cr.id IS NOT NULL THEN json_build_object('id', cr.id, 'code', cr.code, 'name', cr.name, 'nameAm', cr."nameAm", 'nameOm', cr."nameOm", 'baseRole', cr."baseRole", 'permissions', cr.permissions) ELSE NULL END AS "customRole"
              FROM "User" usr
              LEFT JOIN "Branch" b ON b.id = usr."branchId"
              LEFT JOIN "CustomRole" cr ON cr.id = usr."customRoleId"
              WHERE usr.id = ${userId}
            ) u
          ) AS user,
          (
            SELECT COALESCE(json_agg(pr ORDER BY pr.year DESC, pr.month DESC), '[]'::json)
            FROM "PayrollRecord" pr
            WHERE pr."userId" = ${userId}
          ) AS "payrollRecords",
          (
            SELECT COALESCE(json_agg(l ORDER BY l."createdAt" DESC), '[]'::json)
            FROM (
              SELECT 
                ln.id, ln."branchId", ln.type, ln."entityId", ln."userId", ln."totalAmount", 
                ln."remainingBalance", ln.status, ln.date, ln."createdAt", ln."updatedAt",
                COALESCE(
                  (
                    SELECT json_agg(lp ORDER BY lp."createdAt" DESC)
                    FROM "LoanPayment" lp
                    WHERE lp."loanId" = ln.id
                  ),
                  '[]'::json
                ) AS payments
              FROM "Loan" ln
              WHERE ln."userId" = ${userId}
            ) l
          ) AS loans,
          (
            SELECT COALESCE(json_agg(p ORDER BY p.date DESC), '[]'::json)
            FROM "Penalty" p
            WHERE p."userId" = ${userId}
          ) AS penalties
      `;

      const result = rows?.[0];
      if (!result?.user) {
        return { error: 'User not found', status: 404 };
      }

      return {
        data: {
          user: result.user,
          payrollRecords: result.payrollRecords || [],
          loans: result.loans || [],
          penalties: result.penalties || [],
        },
      };
    } catch {
      // Fallback to concurrent Prisma queries
      const [user, payrollRecords, loans, penalties] = await Promise.all([
        prisma.user.findUnique({
          where: { id: userId },
          select: { ...userSelect, branch: { select: { id: true, name: true } } },
        }),
        prisma.payrollRecord.findMany({
          where: { userId },
          orderBy: [{ year: 'desc' }, { month: 'desc' }],
        }),
        prisma.loan.findMany({
          where: { userId },
          include: { payments: { orderBy: { createdAt: 'desc' } } },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.penalty.findMany({
          where: { userId },
          orderBy: { date: 'desc' },
        }),
      ]);

      if (!user) {
        return { error: 'User not found', status: 404 };
      }

      return {
        data: {
          user,
          payrollRecords,
          loans,
          penalties,
        },
      };
    }
  }

  async createUser(body: any, fileUrl?: string, currentUser?: { id: string; role: string }): ServiceResult {
    const {
      fullName,
      phone,
      password,
      role,
      branchId,
      customRoleId,
      permissions,
      salary,
      dailyExpense,
      startDate,
      lastPaidDate,
      shift,
      requiresAttendance,
      filesUrl: bodyFilesUrl,
      avatarUrl,
    } = body;

    // Privilege Escalation Prevention: Only Owners can create Owner accounts
    if (role === 'OWNER' && currentUser?.role !== 'OWNER') {
      return { error: 'Access denied: Only Owners can create Owner accounts', status: 403 };
    }

    const finalFilesUrl = fileUrl || bodyFilesUrl;
    const phoneTrim = phone?.trim();

    if (!fullName?.trim() || !phoneTrim || !password) {
      return { error: 'fullName, phone, password required', status: 400 };
    }

    // Phone format validation (Ethiopian mobile numbers)
    if (!/^(?:\+251|0)[97]\d{8}$/.test(phoneTrim)) {
      return { error: 'Invalid Ethiopian phone number. Must be 10 digits starting with 09 or 07 (or +251).', status: 400 };
    }

    if (password.length < 4) {
      return { error: 'Password must be at least 4 characters long', status: 400 };
    }

    if (!finalFilesUrl?.trim()) {
      return { error: 'Identification document is mandatory when creating a new user', status: 400 };
    }

    if (startDate && lastPaidDate) {
      if (new Date(lastPaidDate).getTime() < new Date(startDate).getTime()) {
        return { error: 'Last paid date cannot be earlier than employment start date', status: 400 };
      }
    }

    const existing = await prisma.user.findUnique({ where: { phone: phoneTrim } });
    if (existing) {
      return { error: 'Phone already exists', status: 400 };
    }

    let effectiveRole = role;
    let effectiveCustomRoleId = customRoleId || null;

    // Detect custom role passed via role (e.g. "CUSTOM_<id>" or role code/id)
    if (typeof role === 'string' && (role.startsWith('CUSTOM_') || !['OWNER', 'ADMIN', 'BAKER', 'CAKE_WORKER', 'CASHIER', 'SAMBUSA_WORKER', 'STOCK_KEEPER', 'EMPLOYEE'].includes(role))) {
      const cId = role.startsWith('CUSTOM_') ? role.replace('CUSTOM_', '') : role;
      const cr = await prisma.customRole.findFirst({
        where: { OR: [{ id: cId }, { code: cId }] },
      });
      if (cr) {
        effectiveCustomRoleId = cr.id;
        effectiveRole = cr.baseRole;
      }
    }

    let parsedPermissions: string[] = [];
    if (Array.isArray(permissions)) {
      parsedPermissions = permissions;
    } else if (typeof permissions === 'string') {
      try {
        parsedPermissions = JSON.parse(permissions);
      } catch {
        parsedPermissions = [];
      }
    }

    if (effectiveCustomRoleId) {
      const cr = await prisma.customRole.findUnique({
        where: { id: effectiveCustomRoleId },
      });
      if (cr) {
        effectiveRole = cr.baseRole;
        if (parsedPermissions.length === 0 && cr.permissions?.length) {
          parsedPermissions = cr.permissions;
        }
      }
    }

    const branchRoleError = await validateBranchRoleCompatibility(branchId || null, effectiveRole, effectiveCustomRoleId);
    if (branchRoleError) {
      return { error: branchRoleError, status: 400 };
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const salaryNum = toDecimal(salary);
    const dailyExpenseNum = toDecimal(dailyExpense);

    const user = await prisma.user.create({
      data: {
        fullName: fullName.trim(),
        phone: phoneTrim,
        passwordHash,
        role: effectiveRole as any,
        branchId: branchId || null,
        customRoleId: effectiveCustomRoleId || null,
        permissions: parsedPermissions,
        salary: salaryNum ?? undefined,
        dailyExpense: dailyExpenseNum ?? undefined,
        startDate: startDate ? new Date(startDate) : undefined,
        lastPaidDate: lastPaidDate ? new Date(lastPaidDate) : undefined,
        shift: shift === 'DAY' || shift === 'NIGHT' ? shift : undefined,
        requiresAttendance: requiresAttendance === undefined ? true : (requiresAttendance === true || requiresAttendance === 'true'),
        avatarUrl: typeof avatarUrl === 'string' ? avatarUrl.trim() || undefined : undefined,
        filesUrl: finalFilesUrl?.trim() || undefined,
      },
      select: { ...userSelect, branch: { select: { name: true } } },
    });

    return { data: user };
  }

  async updateUser(id: string, body: any, fileUrl?: string, currentUser?: { id: string; role: string }): ServiceResult {
    const targetUser = await prisma.user.findUnique({ where: { id } });
    if (!targetUser) {
      return { error: 'User not found', status: 404 };
    }

    const {
      fullName,
      phone,
      password,
      currentPassword,
      role,
      branchId,
      customRoleId,
      permissions,
      isActive,
      salary,
      dailyExpense,
      startDate,
      lastPaidDate,
      shift,
      requiresAttendance,
      filesUrl: bodyFilesUrl,
      avatarUrl,
    } = body;

    // Privilege Escalation Prevention: Only Owners can edit Owner accounts or assign the Owner role
    if (targetUser.role === 'OWNER' && currentUser?.role !== 'OWNER') {
      return { error: 'Access denied: Only Owners can modify Owner accounts', status: 403 };
    }
    if (role === 'OWNER' && currentUser?.role !== 'OWNER') {
      return { error: 'Access denied: Only Owners can assign the Owner role', status: 403 };
    }

    // Owner account edit verification: require current password to modify Owner accounts
    if (targetUser.role === 'OWNER') {
      if (!currentPassword || typeof currentPassword !== 'string' || !currentPassword.trim()) {
        return { error: 'Current password is required to modify an Owner account', status: 400 };
      }
      const isMatch = await bcrypt.compare(currentPassword, targetUser.passwordHash);
      if (!isMatch) {
        return { error: 'Incorrect current password. Account modification rejected.', status: 403 };
      }
    }

    // Prevent owners from demoting their own role
    if (targetUser.role === 'OWNER' && currentUser?.id === id && role && role !== 'OWNER') {
      return { error: 'Owners cannot change their own role', status: 400 };
    }

    // Self-deactivation and Owner deactivation protection
    if (isActive === false) {
      if (currentUser?.id === id) {
        return { error: 'You cannot deactivate your own account', status: 400 };
      }
      if (targetUser.role === 'OWNER') {
        return { error: 'Owner accounts cannot be deactivated', status: 400 };
      }
    }

    const effectiveBranchId = branchId !== undefined ? (branchId || null) : targetUser.branchId;
    let effectiveRole = typeof role === 'string' ? role : targetUser.role;
    let effectiveCustomRoleId = customRoleId !== undefined ? (customRoleId || null) : targetUser.customRoleId;

    if (typeof role === 'string' && (role.startsWith('CUSTOM_') || !['OWNER', 'ADMIN', 'BAKER', 'CAKE_WORKER', 'CASHIER', 'SAMBUSA_WORKER', 'STOCK_KEEPER', 'EMPLOYEE'].includes(role))) {
      const cId = role.startsWith('CUSTOM_') ? role.replace('CUSTOM_', '') : role;
      const cr = await prisma.customRole.findFirst({
        where: { OR: [{ id: cId }, { code: cId }] },
      });
      if (cr) {
        effectiveCustomRoleId = cr.id;
        effectiveRole = cr.baseRole;
      }
    }

    if (effectiveCustomRoleId) {
      const cr = await prisma.customRole.findUnique({
        where: { id: effectiveCustomRoleId },
      });
      if (cr) {
        effectiveRole = cr.baseRole;
      }
    }

    const branchRoleError = await validateBranchRoleCompatibility(effectiveBranchId, effectiveRole, effectiveCustomRoleId);
    if (branchRoleError) {
      return { error: branchRoleError, status: 400 };
    }

    const finalFilesUrl = fileUrl !== undefined ? fileUrl : bodyFilesUrl;

    if (startDate !== undefined || lastPaidDate !== undefined) {
      const s = startDate !== undefined ? (startDate ? new Date(startDate as string) : null) : targetUser.startDate;
      const p = lastPaidDate !== undefined ? (lastPaidDate ? new Date(lastPaidDate as string) : null) : targetUser.lastPaidDate;
      if (s && p && p.getTime() < s.getTime()) {
        return { error: 'Last paid date cannot be earlier than employment start date', status: 400 };
      }
    }

    const data: Record<string, unknown> = {};

    if (typeof fullName === 'string') data.fullName = fullName.trim();
    if (typeof phone === 'string' && phone.trim()) {
      const phoneTrim = phone.trim();
      if (!/^(?:\+251|0)[97]\d{8}$/.test(phoneTrim)) {
        return { error: 'Invalid Ethiopian phone number. Must be 10 digits starting with 09 or 07 (or +251).', status: 400 };
      }
      data.phone = phoneTrim;
    }
    data.role = effectiveRole;
    data.customRoleId = effectiveCustomRoleId;
    if (permissions !== undefined) {
      if (Array.isArray(permissions)) {
        data.permissions = permissions;
      } else if (typeof permissions === 'string') {
        try {
          data.permissions = JSON.parse(permissions);
        } catch {
          data.permissions = [];
        }
      }
    }
    if (typeof isActive === 'boolean') data.isActive = isActive;
    if (salary !== undefined) data.salary = toDecimal(salary);
    if (dailyExpense !== undefined) data.dailyExpense = toDecimal(dailyExpense);
    if (startDate !== undefined) data.startDate = startDate ? new Date(startDate as string) : null;
    if (lastPaidDate !== undefined) data.lastPaidDate = lastPaidDate ? new Date(lastPaidDate as string) : null;
    if (shift === 'DAY' || shift === 'NIGHT') data.shift = shift;
    else if (shift === null || shift === '') data.shift = null;
    if (requiresAttendance !== undefined) {
      data.requiresAttendance = requiresAttendance === true || requiresAttendance === 'true';
    }
    if (avatarUrl !== undefined) {
      data.avatarUrl = typeof avatarUrl === 'string' ? avatarUrl.trim() || null : null;
    }
    if (finalFilesUrl !== undefined) {
      data.filesUrl = typeof finalFilesUrl === 'string' ? finalFilesUrl.trim() || null : null;
    }

    if (typeof password === 'string' && password) {
      if (password.length < 4) {
        return { error: 'Password must be at least 4 characters long', status: 400 };
      }
      data.passwordHash = await bcrypt.hash(password, 10);
    }

    const user = await prisma.user.update({
      where: { id },
      data: data as any,
      select: { ...userSelect, branch: { select: { name: true } } },
    });

    return { data: user };
  }

  async updateUserPermissions(
    userId: string,
    permissions: string[],
    customRoleId?: string | null,
    currentUser?: { id: string; role: string }
  ): ServiceResult {
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      include: { branch: { select: { name: true, isHub: true } } },
    });
    if (!targetUser) {
      return { error: 'User not found', status: 404 };
    }

    if (targetUser.role === 'OWNER' && currentUser?.role !== 'OWNER') {
      return { error: 'Access denied: Only Owners can modify Owner permissions', status: 403 };
    }

    const sanitizedPermissions = Array.isArray(permissions) ? permissions : [];
    if (targetUser.branch && !targetUser.branch.isHub) {
      const forbidden = sanitizedPermissions.filter((p) => HUB_ONLY_PRIVILEGES.has(p));
      if (forbidden.length > 0) {
        return {
          error: `Retail branch "${targetUser.branch.name}" cannot be granted Hub-only privileges (${forbidden.join(', ')}).`,
          status: 400,
        };
      }
      if (customRoleId) {
        const cr = await prisma.customRole.findUnique({
          where: { id: customRoleId },
          select: { name: true, baseRole: true, permissions: true },
        });
        if (cr && (HUB_ONLY_ROLES.has(cr.baseRole) || cr.permissions.some((p) => HUB_ONLY_PRIVILEGES.has(p)))) {
          return {
            error: `Custom role "${cr.name}" includes Hub-only production/stock capabilities and cannot be assigned to a Retail Spoke user.`,
            status: 400,
          };
        }
      }
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        permissions: sanitizedPermissions,
        ...(customRoleId !== undefined ? { customRoleId: customRoleId || null } : {}),
      },
      select: { ...userSelect, branch: { select: { name: true, isHub: true } } },
    });

    return { data: updated };
  }

  async changePassword(userId: string, currentPass: string, newPass: string): ServiceResult {
    if (!currentPass || !newPass) {
      return { error: 'Current password and new password are required', status: 400 };
    }
    if (newPass.length < 4) {
      return { error: 'New password must be at least 4 characters long', status: 400 };
    }
    if (currentPass === newPass) {
      return { error: 'New password cannot be the same as your current password', status: 400 };
    }
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return { error: 'User not found', status: 404 };

    const valid = await bcrypt.compare(currentPass, user.passwordHash);
    if (!valid) return { error: 'Incorrect current password', status: 400 };

    const newHash = await bcrypt.hash(newPass, 10);
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newHash },
    });
    return { data: { message: 'Password changed successfully' } };
  }

  async updateProfilePicture(userId: string, fileUrl: string): ServiceResult {
    if (!fileUrl) return { error: 'File is required', status: 400 };
    const user = await prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: fileUrl },
      select: { ...userSelect, branch: { select: { name: true } } },
    });
    return { data: user };
  }

  async deleteUser(id: string, adminUserId?: string, password?: string): ServiceResult {
    if (!password || !password.trim()) {
      return { error: 'Password is required to confirm user deletion', status: 400 };
    }

    if (adminUserId && adminUserId === id) {
      return { error: 'You cannot delete your own account', status: 400 };
    }

    if (adminUserId) {
      const admin = await prisma.user.findUnique({
        where: { id: adminUserId },
        select: { passwordHash: true },
      });
      if (!admin) {
        return { error: 'Admin user not found', status: 404 };
      }
      const isMatch = await bcrypt.compare(password, admin.passwordHash);
      if (!isMatch) {
        return { error: 'Incorrect password. User deletion cancelled.', status: 403 };
      }
    }

    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            sales: true,
            expenses: true,
            productionBatches: true,
            stockMovements: true,
            productConversions: true,
            stockPurchasePayments: true,
          },
        },
      },
    });
    if (!user) return { error: 'User not found', status: 404 };

    // Prevent deleting OWNER accounts
    if (user.role === 'OWNER') {
      return { error: 'Owner accounts cannot be deleted from the system', status: 400 };
    }

    const usageCount =
      user._count.sales +
      user._count.expenses +
      user._count.productionBatches +
      user._count.stockMovements +
      user._count.productConversions +
      user._count.stockPurchasePayments;

    if (usageCount > 0) {
      await prisma.user.update({
        where: { id },
        data: { isActive: false },
      });
      return {
        data: {
          message: 'User has recorded business transactions and has been deactivated to preserve historical audit records.',
          deactivated: true,
        },
      };
    }

    await prisma.user.delete({ where: { id } });
    return { data: { message: 'User deleted successfully', deactivated: false } };
  }
}
