import { Router, Response } from 'express';
import { prisma } from '../../lib/prisma.js';
import { authMiddleware, requireRole, type AuthRequest } from '../../middleware/auth.js';
import { SYSTEM_PRIVILEGES, getDefaultPrivilegesForRole } from '../../lib/privileges.js';

export const rolesRouter = Router();

rolesRouter.use(authMiddleware);

export const SYSTEM_ROLE_ARCHETYPES = [
  {
    code: 'OWNER',
    name: 'Business Owner',
    nameAm: 'የንግድ ድርጅቱ ባለቤት',
    nameOm: 'Abbaa Qabeenyaa',
    description: 'Full unconstrained system authority and enterprise governance',
    isSystem: true,
    baseRole: 'OWNER',
    defaultPermissions: getDefaultPrivilegesForRole('OWNER'),
  },
  {
    code: 'ADMIN',
    name: 'General Manager / Admin',
    nameAm: 'ሥራ አስኪያጅ / አስተዳዳሪ',
    nameOm: 'Bulchaa / Hojii Geggeessaa',
    description: 'Branch oversight, employee management, and operational reporting',
    isSystem: true,
    baseRole: 'ADMIN',
    defaultPermissions: getDefaultPrivilegesForRole('ADMIN'),
  },
  {
    code: 'CASHIER',
    name: 'Cashier / Retail Salesperson',
    nameAm: 'ገንዘብ ተቀባይ / የሽያጭ ሠራተኛ',
    nameOm: 'Qabduu Maallaqaa / Gurgurtaa',
    description: 'Front-desk point of sale, customer credits, and petty expenses',
    isSystem: true,
    baseRole: 'CASHIER',
    defaultPermissions: getDefaultPrivilegesForRole('CASHIER'),
  },
  {
    code: 'BAKER',
    name: 'Master Baker / Oven Chief',
    nameAm: 'ዋና ጋጋሪ / የዳቦ ባለሙያ',
    nameOm: 'Ogeessa Dabboo Tolchuu',
    description: 'Log baking batches, flour usage, and monitor loaf yields',
    isSystem: true,
    baseRole: 'BAKER',
    defaultPermissions: getDefaultPrivilegesForRole('BAKER'),
  },
  {
    code: 'STOCK_KEEPER',
    name: 'Depot Storekeeper',
    nameAm: 'የዕቃ ግምጃ ቤት ኃላፊ',
    nameOm: 'Eegduu Kuusaa Meeshaa',
    description: 'Manage 50kg flour stock, suppliers, and inter-branch crate transfers',
    isSystem: true,
    baseRole: 'STOCK_KEEPER',
    defaultPermissions: getDefaultPrivilegesForRole('STOCK_KEEPER'),
  },
  {
    code: 'CAKE_WORKER',
    name: 'Pastry & Cake Worker',
    nameAm: 'የኬክና ጣፋጭ ባለሙያ',
    nameOm: 'Ogeessa Keekii',
    description: 'Baking and production logs for specialty cakes and pastries',
    isSystem: true,
    baseRole: 'CAKE_WORKER',
    defaultPermissions: getDefaultPrivilegesForRole('CAKE_WORKER'),
  },
  {
    code: 'SAMBUSA_WORKER',
    name: 'Sambusa Specialist',
    nameAm: 'የሳምቡሳ ባለሙያ',
    nameOm: 'Ogeessa Sambuusaa',
    description: 'Production logging for fried pastries and sambusa',
    isSystem: true,
    baseRole: 'SAMBUSA_WORKER',
    defaultPermissions: getDefaultPrivilegesForRole('SAMBUSA_WORKER'),
  },
  {
    code: 'EMPLOYEE',
    name: 'General Staff Member',
    nameAm: 'ጠቅላላ ሠራተኛ',
    nameOm: 'Hojjataa Waliigalaa',
    description: 'Staff member subject to attendance tracking and payroll',
    isSystem: true,
    baseRole: 'EMPLOYEE',
    defaultPermissions: getDefaultPrivilegesForRole('EMPLOYEE'),
  },
];

/**
 * GET /api/roles
 * Lists built-in archetypes and custom roles defined by the company owner.
 */
rolesRouter.get('/', requireRole('OWNER', 'ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const customRoles = await prisma.customRole.findMany({
      include: {
        users: { select: { id: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    res.json({
      systemRoles: SYSTEM_ROLE_ARCHETYPES,
      customRoles: customRoles.map((r) => ({
        ...r,
        userCount: r.users.length,
      })),
      privileges: SYSTEM_PRIVILEGES,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch roles' });
  }
});

/**
 * GET /api/roles/privileges
 * Exposes the full catalog of granular system capabilities.
 */
rolesRouter.get('/privileges', requireRole('OWNER', 'ADMIN'), (_req: AuthRequest, res: Response) => {
  res.json(SYSTEM_PRIVILEGES);
});

/**
 * POST /api/roles
 * Allows the Owner to create a custom accessibility role.
 */
rolesRouter.post('/', requireRole('OWNER'), async (req: AuthRequest, res: Response) => {
  try {
    const { name, nameAm, nameOm, description, code, baseRole, permissions } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({ error: 'Role name is required' });
    }

    // Generate code if missing
    let roleCode = (code || name)
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9_]/g, '_');
    if (!roleCode.startsWith('CUSTOM_')) {
      roleCode = `CUSTOM_${roleCode}`;
    }

    // Find default company
    const company = await prisma.company.findFirst();
    if (!company) {
      return res.status(400).json({ error: 'Company record not found' });
    }

    const existing = await prisma.customRole.findFirst({
      where: { companyId: company.id, code: roleCode },
    });
    if (existing) {
      return res.status(400).json({ error: `A role with code "${roleCode}" already exists` });
    }

    const newRole = await prisma.customRole.create({
      data: {
        code: roleCode,
        name: name.trim(),
        nameAm: nameAm?.trim() || null,
        nameOm: nameOm?.trim() || null,
        description: description?.trim() || null,
        baseRole: baseRole || 'EMPLOYEE',
        permissions: Array.isArray(permissions) ? permissions : [],
        isSystem: false,
        companyId: company.id,
      },
      include: {
        users: { select: { id: true } },
      },
    });

    res.status(201).json({
      ...newRole,
      userCount: newRole.users.length,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to create custom role' });
  }
});

/**
 * PUT /api/roles/:id
 * Allows the Owner to update an existing custom role's attributes and privileges.
 */
rolesRouter.put('/:id', requireRole('OWNER'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, nameAm, nameOm, description, baseRole, permissions } = req.body;

    const existing = await prisma.customRole.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Custom role not found' });
    }

    if (existing.isSystem) {
      return res.status(400).json({ error: 'System defined roles cannot be modified' });
    }

    const updated = await prisma.customRole.update({
      where: { id },
      data: {
        ...(name && { name: name.trim() }),
        nameAm: nameAm !== undefined ? (nameAm?.trim() || null) : existing.nameAm,
        nameOm: nameOm !== undefined ? (nameOm?.trim() || null) : existing.nameOm,
        description: description !== undefined ? (description?.trim() || null) : existing.description,
        ...(baseRole && { baseRole }),
        ...(Array.isArray(permissions) && { permissions }),
      },
      include: {
        users: { select: { id: true } },
      },
    });

    res.json({
      ...updated,
      userCount: updated.users.length,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to update custom role' });
  }
});

/**
 * DELETE /api/roles/:id
 * Allows the Owner to delete a custom role, safely detaching assigned users.
 */
rolesRouter.delete('/:id', requireRole('OWNER'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const existing = await prisma.customRole.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Custom role not found' });
    }

    if (existing.isSystem) {
      return res.status(400).json({ error: 'System defined roles cannot be deleted' });
    }

    // Detach any users from this custom role before deletion
    await prisma.user.updateMany({
      where: { customRoleId: id },
      data: { customRoleId: null },
    });

    await prisma.customRole.delete({ where: { id } });

    res.json({ message: 'Custom role deleted successfully', id });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to delete custom role' });
  }
});
