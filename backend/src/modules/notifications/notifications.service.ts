import webpush from 'web-push';
import { prisma } from '../../lib/prisma.js';
import { Role, NotificationPreference } from '@prisma/client';

export function getCategoryKeyForType(type: string): keyof NotificationPreference | null {
  switch (type) {
    case 'STOCK_ADDED':
    case 'STOCK_INWARD_ADDED':
      return 'stockIn';
    case 'STOCK_OUTWARD':
      return 'stockOut';
    case 'STOCK_ADJUSTED':
      return 'stockAdjust';
    case 'LOW_STOCK':
    case 'OUT_OF_STOCK':
      return 'lowStock';
    case 'DELIVERY_INWARD':
    case 'STOCK_CONFIRMED':
    case 'STOCK_REJECTED':
    case 'STOCK_RESUBMITTED':
      return 'supplierDeliveries';
    case 'ATTENDANCE_LATE':
    case 'ATTENDANCE_ABSENCE':
      return 'attendanceLate';
    case 'ATTENDANCE_PUNCH':
      return 'attendancePunches';
    case 'CUSTOMER_CREDIT_SALE':
    case 'CUSTOMER_CREDIT_LIMIT':
    case 'CUSTOMER_DEBT_PAYMENT':
      return 'customerCredit';
    case 'LOAN_REQUESTED':
    case 'LOAN_ISSUED':
    case 'LOAN_RECORDED':
    case 'LOAN_APPROVED':
    case 'LOAN_REJECTED':
    case 'SALARY_ADVANCE':
    case 'STOCK_PURCHASE_LOAN':
      return 'staffLoans';
    case 'TRANSFER_DISPATCHED':
    case 'TRANSFER_RECEIVED':
    case 'TRANSFER_DAMAGED':
      return 'transfers';
    case 'DAILY_CLOSE_SUBMITTED':
    case 'DAILY_CLOSE_APPROVED':
      return 'dailyClose';
    case 'CASH_DISCREPANCY':
    case 'EXPENSE_HIGH':
      return 'cashDiscrepancy';
    case 'PRODUCTION_BATCH_LOGGED':
    case 'PRODUCTION_SCRAP':
      return 'productionBatches';
    case 'NOTIFICATION_TEST':
      return null;
    default:
      return null;
  }
}

const DEFAULT_VAPID_PUBLIC_KEY = 'BNuLLLYPRoS_3gl__0KwuYjlmkAsAptU5fyEnGxZ4WDn4k94dBGsXDA2pFjpEid6SUztE4iVljbioypCbkzvdU8';
const DEFAULT_VAPID_PRIVATE_KEY = 'MIWnnw0dBVhEKsz7yyfCnEOqDjDy9c6C03roW1tlf_8';

const vapidPublicKey = process.env.VAPID_PUBLIC_KEY || DEFAULT_VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || DEFAULT_VAPID_PRIVATE_KEY;
const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:admin@bakeryerp.com';

if (vapidPublicKey && vapidPrivateKey) {
  try {
    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
  } catch (err) {
    console.warn('[WebPush] setVapidDetails init error:', err);
  }
}

export interface SendNotificationPayload {
  userIds: string[];
  branchId?: string | null;
  type: string;
  titleKey: string;
  bodyKey: string;
  variables?: Record<string, any>;
  link?: string;
}

function resolvePushContent(type: string, titleKey: string, bodyKey: string, variables: any = {}): { title: string; body: string } {
  let title = 'Habesha Bakery ERP';
  let body = 'You have a new update in Habesha Bakery ERP.';

  switch (type) {
    case 'LOW_STOCK':
      title = 'Low Stock Alert';
      body = `Raw material "${variables.itemName || 'Item'}" is low (${variables.quantity ?? 0} ${variables.unit || ''} remaining, min: ${variables.minLevel ?? 0}).`;
      break;
    case 'OUT_OF_STOCK':
      title = 'Out of Stock Critical Alert';
      body = `Raw material "${variables.itemName || 'Item'}" is completely out of stock!`;
      break;
    case 'STOCK_OUTWARD':
      title = 'Material Issued / Taken';
      body = `${variables.takenBy || 'Staff'} took ${variables.quantity ?? 0} ${variables.unit || ''} of "${variables.itemName || 'Item'}" (${variables.reason || 'usage'}). Remaining: ${variables.remaining ?? 0} ${variables.unit || ''}.`;
      break;
    case 'STOCK_INWARD_ADDED':
      title = 'Inward Stock Added';
      body = `${variables.addedBy || 'Management'} added ${variables.quantity ?? 0} ${variables.unit || ''} of "${variables.itemName || 'Item'}". Please inspect and confirm receipt.`;
      break;
    case 'STOCK_CONFIRMED':
      title = 'Inward Stock Confirmed';
      body = `${variables.confirmedBy || 'Stock Keeper'} verified receipt of ${variables.quantity ?? 0} ${variables.unit || ''} "${variables.itemName || 'Item'}".`;
      break;
    case 'STOCK_REJECTED':
      title = 'Inward Stock Rejected';
      body = `${variables.rejectedBy || 'Stock Keeper'} rejected ${variables.quantity ?? 0} ${variables.unit || ''} of "${variables.itemName || 'Item'}". Reason: ${variables.reason || 'No reason provided'}.`;
      break;
    case 'STOCK_RESUBMITTED':
      title = 'Inward Stock Resubmitted';
      body = `${variables.resubmittedBy || 'Management'} updated and resubmitted ${variables.quantity ?? 0} ${variables.unit || ''} of "${variables.itemName || 'Item'}". Please inspect and verify receipt.`;
      break;
    case 'STOCK_PURCHASE_LOAN':
      title = 'Stock Purchased on Credit';
      body = `Credit purchase of "${variables.itemName || 'Item'}" logged from ${variables.supplierName || 'supplier'} for ${variables.amount || 0} ETB.`;
      break;
    case 'DAILY_CLOSE_SUBMITTED':
      title = 'Daily Close Submitted';
      body = `${variables.cashierName || 'Branch Admin'} submitted daily closing report for ${variables.branchName || 'branch'}.`;
      break;
    case 'DAILY_CLOSE_APPROVED':
      title = 'Daily Close Approved';
      body = `Daily session report for ${variables.branchName || 'branch'} has been approved.`;
      break;
    case 'LOAN_ISSUED':
    case 'LOAN_RECORDED':
      title = 'Staff Loan Recorded';
      body = `A staff loan of ${variables.amount || 0} ETB has been recorded for you.`;
      break;
    case 'LOAN_REQUESTED':
      title = 'New Employee Loan Request';
      body = `${variables.employeeName || 'Employee'} requested a loan of ${variables.amount || 0} ETB.`;
      break;
    case 'LOAN_APPROVED':
      title = 'Loan Approved';
      body = `Your loan request of ${variables.amount || 0} ETB has been approved.`;
      break;
    case 'LOAN_REJECTED':
      title = 'Loan Rejected';
      body = `Your loan request of ${variables.amount || 0} ETB has been rejected.`;
      break;
    case 'NOTIFICATION_TEST':
      title = 'Habesha Bakery Notification Test';
      body = `Web push notifications are working properly on your phone!`;
      break;
    default:
      if (titleKey) {
        title = titleKey.replace('notifications.', '').replace(/([A-Z])/g, ' $1').trim();
      }
      break;
  }

  return { title, body };
}

export class NotificationsService {
  /**
   * Save or update a Web Push subscription for a user
   */
  async saveSubscription(
    userId: string,
    sub: { endpoint: string; keys: { p256dh: string; auth: string } },
    userAgent?: string
  ) {
    try {
      if (!sub || !sub.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
        return { error: 'Invalid push subscription object', status: 400 };
      }

      const existing = await prisma.pushSubscription.findUnique({
        where: { endpoint: sub.endpoint },
      });

      if (existing) {
        await prisma.pushSubscription.update({
          where: { endpoint: sub.endpoint },
          data: {
            userId,
            p256dh: sub.keys.p256dh,
            auth: sub.keys.auth,
            userAgent: userAgent || null,
          },
        });
      } else {
        await prisma.pushSubscription.create({
          data: {
            userId,
            endpoint: sub.endpoint,
            p256dh: sub.keys.p256dh,
            auth: sub.keys.auth,
            userAgent: userAgent || null,
          },
        });
      }

      return { data: { success: true } };
    } catch (err: any) {
      console.error('[NotificationsService] saveSubscription error:', err);
      return { error: err.message || 'Failed to save push subscription', status: 500 };
    }
  }

  /**
   * Unsubscribe / remove push subscription endpoint
   */
  async removeSubscription(endpoint: string) {
    try {
      await prisma.pushSubscription.deleteMany({
        where: { endpoint },
      });
      return { data: { success: true } };
    } catch (err: any) {
      console.error('[NotificationsService] removeSubscription error:', err);
      return { error: err.message || 'Failed to remove push subscription', status: 500 };
    }
  }

  /**
   * Get paginated notifications for a user, including unread count
   */
  async getNotifications(
    userId: string,
    options: { unreadOnly?: boolean; page?: number; limit?: number } = {}
  ) {
    try {
      const page = Math.max(1, options.page || 1);
      const limit = Math.min(100, Math.max(1, options.limit || 20));
      const skip = (page - 1) * limit;

      const where: any = { userId };
      if (options.unreadOnly) {
        where.isRead = false;
      }

      const [items, total, unreadCount] = await Promise.all([
        prisma.notification.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        prisma.notification.count({ where }),
        prisma.notification.count({
          where: { userId, isRead: false },
        }),
      ]);

      const parsedItems = items.map((item) => ({
        ...item,
        variables: item.variables ? JSON.parse(item.variables) : {},
      }));

      return {
        data: {
          items: parsedItems,
          total,
          unreadCount,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (err: any) {
      console.error('[NotificationsService] getNotifications error:', err);
      return { error: err.message || 'Failed to fetch notifications', status: 500 };
    }
  }

  /**
   * Mark a single notification as read
   */
  async markAsRead(userId: string, id: string) {
    try {
      const notification = await prisma.notification.findFirst({
        where: { id, userId },
      });
      if (!notification) {
        return { error: 'Notification not found', status: 404 };
      }

      const updated = await prisma.notification.update({
        where: { id },
        data: { isRead: true },
      });

      return { data: updated };
    } catch (err: any) {
      console.error('[NotificationsService] markAsRead error:', err);
      return { error: err.message || 'Failed to mark notification as read', status: 500 };
    }
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: string) {
    try {
      await prisma.notification.updateMany({
        where: { userId, isRead: false },
        data: { isRead: true },
      });

      return { data: { success: true } };
    } catch (err: any) {
      console.error('[NotificationsService] markAllAsRead error:', err);
      return { error: err.message || 'Failed to mark all as read', status: 500 };
    }
  }

  /**
   * Retrieve notification preferences for a user, auto-creating defaults if not found
   */
  async getPreferences(userId: string) {
    try {
      const pref = await prisma.notificationPreference.upsert({
        where: { userId },
        create: { userId },
        update: {},
      });
      return { data: pref };
    } catch (err: any) {
      console.error('[NotificationsService] getPreferences error:', err);
      return { error: err.message || 'Failed to fetch preferences', status: 500 };
    }
  }

  /**
   * Update notification preferences for a user
   */
  async updatePreferences(userId: string, data: Partial<NotificationPreference>) {
    try {
      const { id, userId: _u, createdAt, updatedAt, ...updateData } = data as any;
      const pref = await prisma.notificationPreference.upsert({
        where: { userId },
        create: {
          userId,
          ...updateData,
        },
        update: updateData,
      });
      return { data: pref };
    } catch (err: any) {
      console.error('[NotificationsService] updatePreferences error:', err);
      return { error: err.message || 'Failed to update preferences', status: 500 };
    }
  }

  /**
   * Get Admin Delegation status
   */
  async getAdminDelegation() {
    try {
      const setting = await prisma.systemSetting.findUnique({
        where: { key: 'ADMIN_RECEIVES_NOTIFICATIONS' },
      });
      const isEnabled = setting ? setting.value === 'true' : false;
      return { data: { adminReceivesAlerts: isEnabled } };
    } catch (err: any) {
      console.error('[NotificationsService] getAdminDelegation error:', err);
      return { error: err.message || 'Failed to fetch admin delegation', status: 500 };
    }
  }

  /**
   * Update Admin Delegation status (Owner only)
   */
  async setAdminDelegation(enabled: boolean) {
    try {
      const setting = await prisma.systemSetting.upsert({
        where: { key: 'ADMIN_RECEIVES_NOTIFICATIONS' },
        create: {
          key: 'ADMIN_RECEIVES_NOTIFICATIONS',
          value: enabled ? 'true' : 'false',
        },
        update: {
          value: enabled ? 'true' : 'false',
        },
      });
      return { data: { adminReceivesAlerts: setting.value === 'true' } };
    } catch (err: any) {
      console.error('[NotificationsService] setAdminDelegation error:', err);
      return { error: err.message || 'Failed to set admin delegation', status: 500 };
    }
  }

  /**
   * Core dispatch method: persists notification to DB and sends Web Push to mobile / desktop browsers
   */
  async notifyUsers(payload: SendNotificationPayload) {
    const { userIds, branchId, type, titleKey, bodyKey, variables, link } = payload;
    if (!userIds || userIds.length === 0) return;

    const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean)));
    if (uniqueUserIds.length === 0) return;

    try {
      // 1. Fetch user records and preferences for candidate recipients
      const users = await prisma.user.findMany({
        where: { id: { in: uniqueUserIds } },
        select: {
          id: true,
          role: true,
          notificationPreference: true,
        },
      });

      // 2. Fetch Owner's global Admin Delegation setting
      let adminReceivesAlerts = false;
      const adminSetting = await prisma.systemSetting.findUnique({
        where: { key: 'ADMIN_RECEIVES_NOTIFICATIONS' },
      });
      if (adminSetting) {
        adminReceivesAlerts = adminSetting.value === 'true';
      }

      const categoryKey = getCategoryKeyForType(type);

      // 3. Filter candidates based on role permissions and category toggles
      const eligibleUserIds = users
        .filter((u) => {
          // Test notification always delivered to the requester
          if (type === 'NOTIFICATION_TEST') return true;

          // If recipient is ADMIN, check if Owner has delegated notification privilege
          if (u.role === Role.ADMIN && !adminReceivesAlerts) {
            return false;
          }

          // If user has saved preferences and this category is toggled OFF, suppress notification
          if (u.notificationPreference && categoryKey) {
            const isCategoryEnabled = (u.notificationPreference as any)[categoryKey];
            if (isCategoryEnabled === false) {
              return false;
            }
          }

          return true;
        })
        .map((u) => u.id);

      if (eligibleUserIds.length === 0) {
        return;
      }

      const variablesJson = variables ? JSON.stringify(variables) : null;

      // 4. Bulk insert in DB for eligible users
      await prisma.notification.createMany({
        data: eligibleUserIds.map((uId) => ({
          userId: uId,
          branchId: branchId || null,
          type,
          titleKey,
          bodyKey,
          variables: variablesJson,
          link: link || '/',
          isRead: false,
        })),
      });

      // 5. Fetch push subscriptions for eligible users
      if (vapidPublicKey && vapidPrivateKey) {
        const subscriptions = await prisma.pushSubscription.findMany({
          where: { userId: { in: eligibleUserIds } },
        });

        if (subscriptions.length > 0) {
          const { title: resolvedTitle, body: resolvedBody } = resolvePushContent(type, titleKey, bodyKey, variables);

          const pushPayload = JSON.stringify({
            type,
            titleKey,
            bodyKey,
            title: resolvedTitle,
            body: resolvedBody,
            variables: variables || {},
            link: link || '/',
            icon: '/icons/icon-192.png',
            badge: '/icons/badge-96.png',
            timestamp: Date.now(),
          });

          // Dispatch web pushes concurrently
          const sendPromises = subscriptions.map(async (sub) => {
            try {
              await webpush.sendNotification(
                {
                  endpoint: sub.endpoint,
                  keys: {
                    p256dh: sub.p256dh,
                    auth: sub.auth,
                  },
                },
                pushPayload,
                {
                  TTL: 24 * 60 * 60, // 1 day
                  urgency: 'high',
                }
              );
            } catch (pushErr: any) {
              // 404 or 410 indicates subscription has expired or unsubscribed
              if (pushErr.statusCode === 404 || pushErr.statusCode === 410) {
                await prisma.pushSubscription.delete({ where: { endpoint: sub.endpoint } }).catch(() => {});
              } else {
                console.warn('[WebPush] Error sending push to endpoint:', pushErr?.message || pushErr);
              }
            }
          });

          await Promise.allSettled(sendPromises);
        }
      }
    } catch (err: any) {
      console.error('[NotificationsService] notifyUsers error:', err);
    }
  }

  /**
   * Helper: Send notification to a specific single user
   */
  async notifyUser(
    userId: string,
    type: string,
    titleKey: string,
    bodyKey: string,
    variables?: Record<string, any>,
    link?: string,
    branchId?: string | null
  ) {
    return this.notifyUsers({
      userIds: [userId],
      branchId,
      type,
      titleKey,
      bodyKey,
      variables,
      link,
    });
  }

  /**
   * Helper: Send notification to all Owners and branch Admins
   */
  async notifyAdminsAndOwners(
    branchId: string | null | undefined,
    type: string,
    titleKey: string,
    bodyKey: string,
    variables?: Record<string, any>,
    link?: string,
    excludeUserId?: string
  ) {
    try {
      const users = await prisma.user.findMany({
        where: {
          isActive: true,
          ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
          OR: [
            { role: Role.OWNER },
            {
              role: Role.ADMIN,
              ...(branchId ? { branchId } : {}),
            },
          ],
        },
        select: { id: true },
      });

      const userIds = users.map((u) => u.id);
      await this.notifyUsers({
        userIds,
        branchId,
        type,
        titleKey,
        bodyKey,
        variables,
        link,
      });
    } catch (err) {
      console.error('[NotificationsService] notifyAdminsAndOwners error:', err);
    }
  }

  /**
   * Helper: Notify users by roles in a branch
   */
  async notifyBranchRoles(
    branchId: string | null | undefined,
    roles: Role[],
    type: string,
    titleKey: string,
    bodyKey: string,
    variables?: Record<string, any>,
    link?: string
  ) {
    try {
      const includeOwner = roles.includes(Role.OWNER);
      const otherRoles = roles.filter((r) => r !== Role.OWNER);

      const conditions: any[] = [];
      if (includeOwner) {
        conditions.push({ role: Role.OWNER });
      }
      if (otherRoles.length > 0) {
        conditions.push({
          role: { in: otherRoles },
          ...(branchId ? { branchId } : {}),
        });
      }

      if (conditions.length === 0) {
        return;
      }

      const users = await prisma.user.findMany({
        where: {
          isActive: true,
          OR: conditions,
        },
        select: { id: true },
      });

      const userIds = users.map((u) => u.id);
      await this.notifyUsers({
        userIds,
        branchId,
        type,
        titleKey,
        bodyKey,
        variables,
        link,
      });
    } catch (err) {
      console.error('[NotificationsService] notifyBranchRoles error:', err);
    }
  }
}

export const notificationsService = new NotificationsService();
