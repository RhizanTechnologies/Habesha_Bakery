import { Router, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { authMiddleware, requireRole, type AuthRequest } from '../middleware/auth.js';

export const settingsRouter = Router();

const DEFAULT_SETTINGS: Record<string, string> = {
  calendarType: 'ETHIOPIAN', // 'ETHIOPIAN' | 'GREGORIAN'
};

/**
 * GET /api/settings
 * Publicly accessible so the frontend and login screen can adapt calendar type without auth failure.
 */
settingsRouter.get('/', async (_req: any, res: Response) => {
  try {
    const allSettings = await prisma.systemSetting.findMany();
    const settingsMap: Record<string, string> = { ...DEFAULT_SETTINGS };

    for (const setting of allSettings) {
      settingsMap[setting.key] = setting.value;
    }

    return res.json({
      data: {
        calendarType: settingsMap.calendarType || 'ETHIOPIAN',
        ...settingsMap,
      },
    });
  } catch (error) {
    console.error('Error fetching settings:', error);
    return res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

/**
 * PATCH /api/settings
 * Restricted to OWNER role only.
 */
settingsRouter.patch('/', authMiddleware, requireRole('OWNER'), async (req: AuthRequest, res: Response) => {
  try {
    const { calendarType } = req.body;

    if (calendarType !== undefined) {
      if (calendarType !== 'ETHIOPIAN' && calendarType !== 'GREGORIAN') {
        return res.status(400).json({ error: 'Invalid calendarType. Must be ETHIOPIAN or GREGORIAN.' });
      }

      await prisma.systemSetting.upsert({
        where: { key: 'calendarType' },
        create: { key: 'calendarType', value: calendarType },
        update: { value: calendarType },
      });
    }

    // Return the updated settings map
    const allSettings = await prisma.systemSetting.findMany();
    const settingsMap: Record<string, string> = { ...DEFAULT_SETTINGS };
    for (const setting of allSettings) {
      settingsMap[setting.key] = setting.value;
    }

    return res.json({
      data: {
        message: 'Settings updated successfully',
        settings: settingsMap,
      },
    });
  } catch (error) {
    console.error('Error updating settings:', error);
    return res.status(500).json({ error: 'Failed to update settings' });
  }
});
