import { Router, Response } from 'express';
import { prisma } from '../../lib/prisma.js';
import { authMiddleware, requireRole, type AuthRequest } from '../../middleware/auth.js';
import { z } from 'zod';

export const transfersRouter = Router();
transfersRouter.use(authMiddleware);

// GET /api/transfers - List transfer manifests & transit metrics
transfersRouter.get('/', requireRole('OWNER', 'ADMIN', 'BRANCH_MANAGER', 'DRIVER', 'CASHIER', 'STOREKEEPER'), async (req: AuthRequest, res: Response) => {
  try {
    const { branchId, status } = req.query;

    const where: any = {};
    if (status && typeof status === 'string' && status !== 'ALL') {
      where.status = status;
    }

    // If user is non-owner/admin, restrict to their branch
    if (req.user?.branchId && req.user.role !== 'OWNER' && req.user.role !== 'ADMIN') {
      where.OR = [
        { originBranchId: req.user.branchId },
        { destBranchId: req.user.branchId },
      ];
    } else if (branchId && typeof branchId === 'string' && branchId !== 'ALL') {
      where.OR = [
        { originBranchId: branchId },
        { destBranchId: branchId },
      ];
    }

    const manifests = await prisma.transferManifest.findMany({
      where,
      take: 100,
      orderBy: { createdAt: 'desc' },
      include: {
        originBranch: { select: { id: true, name: true, code: true } },
        destBranch: { select: { id: true, name: true, code: true } },
        product: { select: { id: true, name: true } },
        dispatchedByUser: { select: { fullName: true } },
        receivedByUser: { select: { fullName: true } },
      },
    });

    // KPI Metrics calculation for today
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const allTodayManifests = await prisma.transferManifest.findMany({
      where: { createdAt: { gte: today } },
    });

    const cratesDispatchedToday = allTodayManifests.reduce((acc, curr) => acc + curr.cratesCount, 0);
    const cratesReceivedToday = allTodayManifests
      .filter((m) => m.status === 'RECEIVED')
      .reduce((acc, curr) => acc + curr.cratesCount, 0);
    const cratesInTransitToday = allTodayManifests
      .filter((m) => m.status === 'DISPATCHED')
      .reduce((acc, curr) => acc + curr.cratesCount, 0);
    const loavesDistributedToday = allTodayManifests.reduce((acc, curr) => acc + curr.loavesCount, 0);

    res.json({
      transfers: manifests.map((m) => ({
        id: m.id,
        manifestNumber: m.manifestNumber,
        originBranchId: m.originBranchId,
        originBranchName: m.originBranch?.name || 'Hub',
        destBranchId: m.destBranchId,
        destBranchName: m.destBranch?.name || 'Spoke',
        destBranchCode: m.destBranch?.code || null,
        productId: m.productId,
        productName: m.product?.name || 'Product',
        cratesCount: m.cratesCount,
        loavesCount: m.loavesCount,
        driverName: m.driverName,
        driverPhone: m.driverPhone,
        vehiclePlate: m.vehiclePlate,
        status: m.status,
        dispatchTime: m.dispatchTime,
        receivedTime: m.receivedTime,
        dispatchedBy: m.dispatchedByUser?.fullName || 'Hub Logistics',
        receivedBy: m.receivedByUser?.fullName || null,
        goodLoavesReceived: m.goodLoavesReceived,
        damagedLoavesCount: m.damagedLoavesCount,
        emptyCratesReturned: m.emptyCratesReturned,
        discrepancyNotes: m.discrepancyNotes,
        createdAt: m.createdAt,
      })),
      metrics: {
        cratesDispatchedToday,
        cratesReceivedToday,
        cratesInTransitToday,
        loavesDistributedToday,
        totalManifestsCount: manifests.length,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch transfer manifests' });
  }
});

// GET /api/transfers/products - Products with available stock at origin branch
transfersRouter.get('/products', async (req: AuthRequest, res: Response) => {
  try {
    const originBranchId = (req.query.branchId as string) || req.user?.branchId;
    let hubId = originBranchId;
    if (!hubId || hubId === 'ALL') {
      const hub = await prisma.branch.findFirst({ where: { isHub: true } });
      hubId = hub?.id;
    }

    const products = await prisma.product.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        basePrice: true,
        productStocks: hubId ? { where: { branchId: hubId } } : true,
      },
      orderBy: { name: 'asc' },
    });

    const mapped = products.map((p) => {
      const stock = p.productStocks?.[0]?.availableStock ?? 0;
      return {
        id: p.id,
        name: p.name,
        basePrice: p.basePrice,
        availableStock: stock,
      };
    });

    res.json(mapped);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to load transfer products' });
  }
});

// POST /api/transfers/dispatch - Dispatch crate transfers from Hub to Spoke
transfersRouter.post('/dispatch', requireRole('OWNER', 'ADMIN', 'BRANCH_MANAGER', 'DRIVER', 'STOREKEEPER'), async (req: AuthRequest, res: Response) => {
  try {
    const itemSchema = z.object({
      productId: z.string({ required_error: 'Product is required' }),
      unitsCount: z.number().int().positive('Units count must be at least 1'),
      cratesCount: z.number().int().nonnegative().optional(),
    });

    const schema = z.object({
      destBranchId: z.string({ required_error: 'Destination branch is required' }),
      originBranchId: z.string().optional(),
      items: z.array(itemSchema).optional(),
      productId: z.string().optional(),
      cratesCount: z.number().int().positive().optional(),
      unitsCount: z.number().int().positive().optional(),
      driverName: z.string().optional().default('Direct Transfer'),
      driverPhone: z.string().optional(),
      vehiclePlate: z.string().optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0]?.message });
    }

    const { destBranchId, driverName, driverPhone, vehiclePlate } = parsed.data;

    // Resolve Origin Branch (defaults to Hub)
    let originBranchId = parsed.data.originBranchId || req.user?.branchId;
    if (!originBranchId || originBranchId === 'ALL') {
      const hub = await prisma.branch.findFirst({ where: { isHub: true } });
      originBranchId = hub?.id;
    }
    if (!originBranchId) {
      return res.status(400).json({ error: 'Origin production branch (Hub) could not be resolved' });
    }

    if (originBranchId === destBranchId) {
      return res.status(400).json({ error: 'Origin and destination branch cannot be the same.' });
    }

    // Normalize items
    let transferItems: Array<{ productId: string; unitsCount: number; cratesCount: number }> = [];

    if (parsed.data.items && parsed.data.items.length > 0) {
      transferItems = parsed.data.items.map((it) => ({
        productId: it.productId,
        unitsCount: it.unitsCount,
        cratesCount: it.cratesCount ?? (it.unitsCount >= 40 ? Math.floor(it.unitsCount / 40) : 1),
      }));
    } else if (parsed.data.productId) {
      const units = parsed.data.unitsCount ?? ((parsed.data.cratesCount || 1) * 40);
      const crates = parsed.data.cratesCount ?? Math.floor(units / 40);
      transferItems = [{
        productId: parsed.data.productId,
        unitsCount: units,
        cratesCount: crates > 0 ? crates : 1,
      }];
    } else {
      return res.status(400).json({ error: 'At least one product must be selected for transfer.' });
    }

    // 1. Strict Stock Validation at Origin Branch for ALL items before any changes
    for (const item of transferItems) {
      const product = await prisma.product.findUnique({
        where: { id: item.productId },
        select: { id: true, name: true },
      });
      if (!product) {
        return res.status(400).json({ error: `Product ID "${item.productId}" not found.` });
      }

      const originStock = await prisma.branchProductStock.findUnique({
        where: {
          branchId_productId: {
            branchId: originBranchId,
            productId: item.productId,
          },
        },
      });

      const available = originStock?.availableStock ?? 0;
      if (available <= 0) {
        return res.status(400).json({
          error: `Product "${product.name}" is currently OUT OF STOCK at origin branch (0 available). Transfer not allowed.`,
        });
      }
      if (available < item.unitsCount) {
        return res.status(400).json({
          error: `Cannot transfer ${item.unitsCount} units of "${product.name}". Only ${available} available in stock at origin branch.`,
        });
      }
    }

    // 2. Atomic Transaction: Deduct stock for all items + create transfer manifests
    const createdManifests = await prisma.$transaction(async (tx) => {
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const countToday = await tx.transferManifest.count({
        where: {
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
      });

      const manifests = [];
      let index = 1;

      for (const item of transferItems) {
        const manifestNumber = `TRF-${dateStr}-${String(countToday + index).padStart(3, '0')}`;
        index++;

        // Deduct from Origin stock
        await tx.branchProductStock.update({
          where: {
            branchId_productId: {
              branchId: originBranchId!,
              productId: item.productId,
            },
          },
          data: {
            availableStock: { decrement: item.unitsCount },
          },
        });

        // Create manifest
        const manifest = await tx.transferManifest.create({
          data: {
            manifestNumber,
            originBranchId: originBranchId!,
            destBranchId,
            productId: item.productId,
            cratesCount: item.cratesCount,
            loavesCount: item.unitsCount,
            driverName: driverName || 'Direct Transfer',
            driverPhone: driverPhone || null,
            vehiclePlate: vehiclePlate || null,
            status: 'DISPATCHED',
            dispatchedByUserId: req.user?.id,
          },
          include: {
            originBranch: { select: { id: true, name: true, code: true } },
            destBranch: { select: { id: true, name: true, code: true } },
            product: { select: { id: true, name: true } },
          },
        });

        manifests.push(manifest);
      }

      return manifests;
    }, { maxWait: 15000, timeout: 45000 });

    return res.status(201).json({
      success: true,
      count: createdManifests.length,
      manifests: createdManifests,
      ...createdManifests[0],
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to dispatch transfer manifest' });
  }
});

// POST /api/transfers/:id/receive - Destination Spoke confirms delivery
transfersRouter.post('/:id/receive', requireRole('OWNER', 'ADMIN', 'BRANCH_MANAGER', 'CASHIER'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const schema = z.object({
      goodLoavesReceived: z.number().int().nonnegative().optional(),
      damagedLoavesCount: z.number().int().nonnegative().optional().default(0),
      emptyCratesReturned: z.number().int().nonnegative().optional().default(0),
      discrepancyNotes: z.string().optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0]?.message });
    }

    const manifest = await prisma.transferManifest.findUnique({
      where: { id },
    });
    if (!manifest) {
      return res.status(404).json({ error: 'Transfer manifest not found' });
    }

    if (manifest.status === 'RECEIVED') {
      return res.status(400).json({ error: 'This shipment has already been received and credited to branch inventory' });
    }

    const goodLoaves = parsed.data.goodLoavesReceived ?? (manifest.loavesCount - parsed.data.damagedLoavesCount);

    // Atomic transaction: Update manifest status + Increment Spoke BranchProductStock
    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.transferManifest.update({
        where: { id },
        data: {
          status: 'RECEIVED',
          receivedTime: new Date(),
          receivedByUserId: req.user?.id,
          goodLoavesReceived: goodLoaves,
          damagedLoavesCount: parsed.data.damagedLoavesCount || 0,
          emptyCratesReturned: parsed.data.emptyCratesReturned || 0,
          discrepancyNotes: parsed.data.discrepancyNotes,
        },
      });

      // Credit Spoke BranchProductStock with received loaves
      await tx.branchProductStock.upsert({
        where: {
          branchId_productId: {
            branchId: manifest.destBranchId,
            productId: manifest.productId,
          },
        },
        update: {
          availableStock: { increment: goodLoaves },
        },
        create: {
          branchId: manifest.destBranchId,
          productId: manifest.productId,
          availableStock: goodLoaves,
        },
      });

      return result;
    }, { maxWait: 15000, timeout: 30000 });

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to receive shipment' });
  }
});
