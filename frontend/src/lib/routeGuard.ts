/**
 * Centralized Role-Based Route Authorization & Guard
 *
 * Enforces strict automatic redirection across all roles and routes
 * preventing unauthorized navigation via direct URL entry.
 */

import { hasPrivilege } from './privileges';

export type UserRole =
  | 'OWNER'
  | 'ADMIN'
  | 'CASHIER'
  | 'BAKER'
  | 'CAKE_WORKER'
  | 'SAMBUSA_WORKER'
  | 'STOCK_KEEPER'
  | 'EMPLOYEE';

/**
 * Returns the default designated home route for a given user role.
 */
export function getRoleHomeRoute(userOrRole?: { role?: string | null; permissions?: string[] } | string | null): string {
  const role = typeof userOrRole === 'string' ? userOrRole : userOrRole?.role;
  switch (role) {
    case 'OWNER':
      return '/';
    case 'ADMIN':
      return '/production/history';
    case 'CASHIER':
      return '/customer-credits';
    case 'BAKER':
      return '/production';
    case 'CAKE_WORKER':
      return '/production';
    case 'SAMBUSA_WORKER':
      return '/production';
    case 'STOCK_KEEPER':
      return '/stock';
    case 'EMPLOYEE':
      return '/my-profile';
    default:
      return '/login';
  }
}

/**
 * Normalizes a path to ensure clean matching without query parameters or trailing slashes.
 */
function normalizePath(pathname: string): string {
  const pathWithoutQuery = pathname.split('?')[0].split('#')[0];
  if (pathWithoutQuery.length > 1 && pathWithoutQuery.endsWith('/')) {
    return pathWithoutQuery.slice(0, -1);
  }
  return pathWithoutQuery;
}

/**
 * Checks whether a given route is accessible by a specific user or role.
 * Incorporates granular capability privileges when assigned.
 */
export function isRouteAllowed(
  userOrRole: { role?: string | null; permissions?: string[] } | string | undefined | null,
  pathname: string
): boolean {
  if (!userOrRole) return false;
  const role = typeof userOrRole === 'string' ? userOrRole : userOrRole.role;
  if (!role) return false;
  const path = normalizePath(pathname);

  // OWNER has unrestricted access to the entire ERP system
  if (role === 'OWNER') {
    return true;
  }

  // Public / auth routes are accessible to all
  if (path === '/login' || path.startsWith('/login/') || path === '/attendance/kiosk' || path.startsWith('/attendance/kiosk/')) {
    return true;
  }

  // Every authenticated user can access their own profile, payslips & notification settings
  if (
    path === '/my-profile' ||
    path.startsWith('/my-profile/') ||
    path === '/settings/notifications' ||
    path.startsWith('/settings/notifications/')
  ) {
    return true;
  }

  // If explicit granular user context is provided, route authorization follows capability permissions:
  if (typeof userOrRole === 'object') {
    if (path === '/' && hasPrivilege(userOrRole, 'access_dashboard')) return true;
    if ((path === '/users' || path.startsWith('/users/')) && hasPrivilege(userOrRole, 'access_users')) return true;
    if ((path === '/branches' || path.startsWith('/branches/')) && hasPrivilege(userOrRole, 'access_branches')) return true;
    if ((path === '/stock' || path.startsWith('/stock/') || path === '/stock-movements' || path.startsWith('/stock-movements/') || path === '/mobile/storekeeper' || path.startsWith('/mobile/storekeeper/')) && hasPrivilege(userOrRole, 'access_stock')) return true;
    if ((path === '/production' || path.startsWith('/production/')) && hasPrivilege(userOrRole, 'access_production')) return true;
    if ((path === '/transfers' || path.startsWith('/transfers/')) && hasPrivilege(userOrRole, 'access_transfers')) return true;
    if ((path === '/product-categories' || path.startsWith('/product-categories/')) && hasPrivilege(userOrRole, 'access_categories')) return true;
    if ((path === '/products' || path.startsWith('/products/')) && hasPrivilege(userOrRole, 'access_products')) return true;
    if ((path === '/daily-sessions' || path.startsWith('/daily-sessions/')) && hasPrivilege(userOrRole, 'access_daily_sessions')) return true;
    if ((path === '/customer-credits' || path.startsWith('/customer-credits/') || path === '/customers' || path.startsWith('/customers/')) && hasPrivilege(userOrRole, 'access_customer_credits')) return true;
    if ((path === '/suppliers' || path.startsWith('/suppliers/')) && hasPrivilege(userOrRole, 'access_suppliers')) return true;
    if ((path === '/expenses' || path.startsWith('/expenses/')) && hasPrivilege(userOrRole, 'access_expenses')) return true;
    if ((path === '/owner-loans' || path.startsWith('/owner-loans/')) && hasPrivilege(userOrRole, 'access_owner_loans')) return true;
    if ((path === '/payroll' || path.startsWith('/payroll/')) && hasPrivilege(userOrRole, 'access_payroll')) return true;
    if ((path === '/attendance' || path.startsWith('/attendance/')) && hasPrivilege(userOrRole, 'access_attendance')) return true;
    if ((path === '/reports' || path.startsWith('/reports/')) && hasPrivilege(userOrRole, 'access_reports')) return true;

    // If user has customized explicit permissions array, restrict strictly to granted privileges
    if (userOrRole.permissions && userOrRole.permissions.length > 0) {
      return false;
    }
  }

  // Inter-Branch Transfers fallback
  if (path === '/transfers' || path.startsWith('/transfers/')) {
    return role === 'ADMIN' || (role as string) === 'STOREKEEPER' || role === 'STOCK_KEEPER' || role === 'CASHIER' || (role as string) === 'DRIVER';
  }

  // 1. ADMIN
  if (role === 'ADMIN') {
    // Admin is restricted from executive dashboard, branch setup, categories, product catalog, owner loans, reports, full monthly payroll, and role-materials mapping
    if (path === '/') return false;
    if (path === '/branches' || path.startsWith('/branches/')) return false;
    if (path === '/product-categories' || path.startsWith('/product-categories/')) return false;
    if (path === '/products' || path.startsWith('/products/')) return false;
    if (path === '/owner-loans' || path.startsWith('/owner-loans/')) return false;
    if (path === '/reports' || path.startsWith('/reports/')) return false;
    if (path === '/stock/role-materials') return false;
    if (path === '/payroll' || (path.startsWith('/payroll/') && !path.startsWith('/payroll/loans') && !path.startsWith('/payroll/penalties'))) {
      return false;
    }

    // Allowed Admin routes:
    return (
      path === '/attendance' ||
      path.startsWith('/attendance/') ||
      path === '/production' ||
      path.startsWith('/production/') ||
      path === '/daily-sessions' ||
      path.startsWith('/daily-sessions/') ||
      path === '/users' ||
      path.startsWith('/users/') ||
      path === '/customer-credits' ||
      path.startsWith('/customer-credits/') ||
      path === '/customers' ||
      path.startsWith('/customers/') ||
      path === '/product-conversions' ||
      path.startsWith('/product-conversions/') ||
      path === '/stock' ||
      path.startsWith('/stock/') ||
      path === '/stock-movements' ||
      path.startsWith('/stock-movements/') ||
      path === '/suppliers' ||
      path.startsWith('/suppliers/') ||
      path === '/expenses' ||
      path.startsWith('/expenses/') ||
      path.startsWith('/payroll/loans') ||
      path.startsWith('/payroll/penalties') ||
      path.startsWith('/mobile')
    );
  }

  // 2. CASHIER
  if (role === 'CASHIER') {
    // Note: /daily-sessions is strictly ADMIN and OWNER
    return (
      path === '/customer-credits' ||
      path.startsWith('/customer-credits/') ||
      path === '/customers' ||
      path.startsWith('/customers/') ||
      path === '/product-conversions' ||
      path.startsWith('/product-conversions/') ||
      path === '/suppliers' ||
      path.startsWith('/suppliers/') ||
      path === '/expenses' ||
      path.startsWith('/expenses/') ||
      path === '/mobile/cashier' ||
      path === '/mobile'
    );
  }

  // 3. BAKER
  if (role === 'BAKER') {
    // Baker can access production pages (except history) and mobile baker station
    if (path === '/production/history' || path.startsWith('/production/history/')) return false;
    return (
      path === '/production' ||
      path.startsWith('/production/') ||
      path === '/mobile/baker' ||
      path === '/mobile'
    );
  }

  // 4. CAKE WORKER
  if (role === 'CAKE_WORKER') {
    if (path === '/production/history' || path.startsWith('/production/history/')) return false;
    return (
      path === '/production' ||
      path.startsWith('/production/') ||
      path === '/product-conversions' ||
      path.startsWith('/product-conversions/') ||
      path === '/mobile/baker' ||
      path === '/mobile'
    );
  }

  // 5. SAMBUSA WORKER
  if (role === 'SAMBUSA_WORKER') {
    if (path === '/production/history' || path.startsWith('/production/history/')) return false;
    return (
      path === '/production' ||
      path.startsWith('/production/') ||
      path === '/mobile/sambusa' ||
      path === '/mobile'
    );
  }

  // 6. STOCK KEEPER
  if (role === 'STOCK_KEEPER') {
    return (
      path === '/stock' ||
      path.startsWith('/stock/') ||
      path === '/stock-movements' ||
      path.startsWith('/stock-movements/') ||
      path === '/mobile/storekeeper' ||
      path.startsWith('/mobile/storekeeper/') ||
      path === '/mobile'
    );
  }

  // 7. GENERAL EMPLOYEE
  if (role === 'EMPLOYEE') {
    // Employee can strictly only view /my-profile
    return false;
  }

  return false;
}
