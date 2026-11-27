'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useBranch } from '@/context/BranchContext';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { getImageUrl } from '@/lib/utils';
import { useLanguage } from '@/context/LanguageContext';
import LanguageSelector from '@/components/LanguageSelector';
import NotificationBell from '@/components/NotificationBell';
import { toast } from 'sonner';
import { isRouteAllowed, getRoleHomeRoute } from '@/lib/routeGuard';
import { hasPrivilege } from '@/lib/privileges';
import {
  LogOut, LayoutDashboard, Users, MapPin, Package,
  Banknote, Layers, Boxes, ArrowRightLeft, ChefHat, BarChart3, Truck,
  CalendarDays, DollarSign, Building2, Utensils, Search, Menu, X, History, UserCheck, CreditCard, HandCoins, Settings, Clock, ChevronDown
} from 'lucide-react';

export const DashboardLayoutContext = React.createContext<{ isNested: boolean }>({ isNested: false });

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isNested } = React.useContext(DashboardLayoutContext);
  if (isNested) {
    return <>{children}</>;
  }
  return <DashboardLayoutInner>{children}</DashboardLayoutInner>;
}

function DashboardLayoutInner({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const { branches, selectedBranchId, setSelectedBranchId } = useBranch();
  const { t, language } = useLanguage();
  const router = useRouter();
  const pathname = usePathname();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [headerAvatarError, setHeaderAvatarError] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  // Helper to identify which category a route belongs to
  const getCategoryForPath = (path: string): string => {
    if (path === '/' || path.startsWith('/my-profile')) return 'core';
    if (path.startsWith('/production') || path.startsWith('/stock') || path.startsWith('/product-conversions')) return 'production';
    if (path.startsWith('/daily-sessions') || path.startsWith('/customer-credits') || path.startsWith('/transfers') || path.startsWith('/products') || path.startsWith('/product-categories')) return 'sales';
    if (path.startsWith('/suppliers') || path.startsWith('/expenses') || path.startsWith('/owner-loans') || path.startsWith('/reports')) return 'finance';
    if (path.startsWith('/users') || path.startsWith('/attendance') || path.startsWith('/payroll')) return 'hr';
    if (path.startsWith('/branches') || path.startsWith('/settings')) return 'system';
    return 'core';
  };

  useEffect(() => {
    setIsMounted(true);
    try {
      const saved = localStorage.getItem('bakery_sidebar_collapsed_sections');
      if (saved) {
        setCollapsedSections(JSON.parse(saved));
      }
    } catch {}
  }, []);

  // When pathname changes, ensure the category containing current route is expanded
  useEffect(() => {
    if (pathname) {
      const catId = getCategoryForPath(pathname);
      setCollapsedSections((prev) => {
        if (prev[catId]) {
          const next = { ...prev, [catId]: false };
          try {
            localStorage.setItem('bakery_sidebar_collapsed_sections', JSON.stringify(next));
          } catch {}
          return next;
        }
        return prev;
      });
    }
  }, [pathname]);

  const toggleSection = (id: string) => {
    setCollapsedSections((prev) => {
      const updated = {
        ...prev,
        [id]: !prev[id],
      };
      try {
        localStorage.setItem('bakery_sidebar_collapsed_sections', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  useEffect(() => {
    if (!isMounted || isLoading) return;
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    if (user && !isRouteAllowed(user, pathname)) {
      const home = getRoleHomeRoute(user);
      toast.error(`Access restricted: Your role (${user.role}) cannot access this section.`);
      router.replace(home);
    }
  }, [isMounted, isLoading, isAuthenticated, user, pathname, router]);

  // Close mobile drawer and scroll to top on route change
  useEffect(() => {
    setIsMobileOpen(false);
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [pathname]);

  const isUnauthorized = Boolean(isMounted && !isLoading && isAuthenticated && user && !isRouteAllowed(user, pathname));

  if (!isMounted || isLoading || !isAuthenticated || isUnauthorized) {
    return (
      <div className="min-h-screen bg-[#FAF7EE] flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-12 h-12 bg-[#E87A18] rounded-2xl flex items-center justify-center animate-bounce shadow-lg">
            <Utensils className="w-6 h-6 text-white" />
          </div>
          <p className="text-[#4A2E1B] font-bold text-sm tracking-wide">
            {isUnauthorized ? 'Restricted route. Redirecting to your station...' : 'Loading Bakery ERP Portal...'}
          </p>
        </div>
      </div>
    );
  }

  const role = user?.role;
  const isOwner = role === 'OWNER';
  const isAdmin = role === 'ADMIN';

  interface NavItem {
    icon: any;
    label: string;
    href: string;
  }

  interface NavSection {
    id: string;
    title: string;
    items: NavItem[];
  }

  const navSections: NavSection[] = [
    {
      id: 'core',
      title: t('nav.categoryCore'),
      items: [
        ...(isOwner || hasPrivilege(user, 'access_dashboard') ? [{ icon: LayoutDashboard, label: t('nav.dashboard'), href: '/' }] : []),
        { icon: UserCheck, label: t('nav.profileSalary'), href: '/my-profile' },
      ],
    },
    {
      id: 'production',
      title: t('nav.categoryProduction'),
      items: [
        ...((isOwner || isAdmin || role === 'BAKER' || role === 'CAKE_WORKER' || role === 'SAMBUSA_WORKER' || hasPrivilege(user, 'access_production')) ? [
          { icon: ChefHat, label: t('nav.production'), href: '/production' },
          ...((isOwner || isAdmin || hasPrivilege(user, 'access_production')) ? [{ icon: History, label: t('nav.dailyProductHistory'), href: '/production/history' }] : [])
        ] : []),
        ...((isOwner || isAdmin || role === 'CASHIER' || role === 'CAKE_WORKER' || hasPrivilege(user, 'access_products')) ? [
          { icon: ArrowRightLeft, label: t('nav.conversions'), href: '/product-conversions' }
        ] : []),
        ...((isOwner || isAdmin || role === 'STOCK_KEEPER' || hasPrivilege(user, 'access_stock')) ? [
          { icon: Boxes, label: t('nav.stock'), href: '/stock' },
          { icon: ArrowRightLeft, label: t('nav.stockMovements'), href: '/stock-movements' }
        ] : []),
      ],
    },
    {
      id: 'sales',
      title: t('nav.categorySales'),
      items: [
        ...((isOwner || isAdmin || hasPrivilege(user, 'access_daily_sessions')) ? [
          { icon: CalendarDays, label: t('nav.dailySessions'), href: '/daily-sessions' },
        ] : []),
        ...((isOwner || isAdmin || role === 'CASHIER' || hasPrivilege(user, 'access_customer_credits')) ? [
          { icon: CreditCard, label: t('nav.customerCreditSales'), href: '/customer-credits' }
        ] : []),
        ...((isOwner || isAdmin || role === 'CASHIER' || hasPrivilege(user, 'access_transfers')) ? [
          { icon: ArrowRightLeft, label: t('nav.transfers') || 'Transfers', href: '/transfers' }
        ] : []),
        ...(isOwner || hasPrivilege(user, 'access_products') ? [
          { icon: Package, label: t('nav.products'), href: '/products' }
        ] : []),
        ...(isOwner || hasPrivilege(user, 'access_categories') ? [
          { icon: Layers, label: t('nav.categories'), href: '/product-categories' }
        ] : []),
      ],
    },
    {
      id: 'finance',
      title: t('nav.categoryFinance'),
      items: [
        ...((isOwner || isAdmin || role === 'CASHIER' || hasPrivilege(user, 'access_suppliers')) ? [
          { icon: Truck, label: t('nav.suppliers'), href: '/suppliers' }
        ] : []),
        ...((isOwner || isAdmin || role === 'CASHIER' || hasPrivilege(user, 'access_expenses')) ? [
          { icon: DollarSign, label: t('nav.expenses'), href: '/expenses' }
        ] : []),
        ...(isOwner || hasPrivilege(user, 'access_owner_loans') ? [
          { icon: HandCoins, label: t('nav.ownerLoans'), href: '/owner-loans' }
        ] : []),
        ...((isOwner || isAdmin || hasPrivilege(user, 'access_reports')) ? [
          { icon: BarChart3, label: t('nav.reports'), href: '/reports' }
        ] : []),
      ],
    },
    {
      id: 'hr',
      title: t('nav.categoryHR'),
      items: [
        ...((isOwner || isAdmin || hasPrivilege(user, 'access_users')) ? [{ icon: Users, label: t('nav.users'), href: '/users' }] : []),
        ...((isOwner || isAdmin || hasPrivilege(user, 'access_attendance')) ? [
          { icon: Clock, label: t('nav.attendance') || 'Attendance', href: '/attendance' }
        ] : []),
        ...(isOwner || hasPrivilege(user, 'access_payroll') ? [
          { icon: Banknote, label: t('nav.payroll'), href: '/payroll' }
        ] : isAdmin ? [
          { icon: Banknote, label: `${t('payroll.navLoans')} & ${t('payroll.navPenalties')}`, href: '/payroll/loans' }
        ] : []),
      ],
    },
    {
      id: 'system',
      title: t('nav.categorySystem'),
      items: [
        ...(isOwner || hasPrivilege(user, 'access_branches') ? [{ icon: MapPin, label: t('nav.branches'), href: '/branches' }] : []),
        ...(isOwner ? [{ icon: Settings, label: t('nav.settings'), href: '/settings' }] : []),
      ],
    },
  ].filter((section) => section.items.length > 0);

  const allNavItems = navSections.flatMap((s) => s.items);

  // Find the most specific active route match
  const matchingItems = allNavItems.filter(
    (item) => pathname === item.href || (item.href !== '/' && pathname.startsWith(`${item.href}/`)) || (item.href === '/payroll/loans' && pathname.startsWith('/payroll/'))
  );
  const activeHref = [...matchingItems].sort((a, b) => b.href.length - a.href.length)[0]?.href;
  const currentBranch = branches.find((b) => b.id === selectedBranchId);

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo Section */}
      <div className="pt-6 pb-5 px-6 flex items-center justify-between border-b border-[#5A3A23]/60">
        <div className="flex items-center">
          <div className="w-10 h-10 bg-[#E87A18] rounded-2xl flex items-center justify-center mr-3 shadow-md">
            <Utensils className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="text-xl font-extrabold tracking-tight text-white block leading-tight">Bakery ERP</span>
            <span className="text-[10px] uppercase font-bold text-[#E2C7B4] tracking-widest block">
              {user?.customRole
                ? language === 'am' && user.customRole.nameAm
                  ? user.customRole.nameAm
                  : language === 'om' && user.customRole.nameOm
                  ? user.customRole.nameOm
                  : user.customRole.name
                : user?.role} PORTAL
            </span>
          </div>
        </div>
        <button
          onClick={() => setIsMobileOpen(false)}
          className="lg:hidden text-[#E2C7B4] hover:text-white p-1"
        >
          <X className="w-6 h-6" />
        </button>
      </div>


      {/* Navigation List */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-3 sidebar-scrollbar">
        {navSections.map((section, sIdx) => {
          const isCollapsed = Boolean(collapsedSections[section.id]);
          const containsActive = section.items.some((item) => item.href === activeHref);

          return (
            <div key={section.id || sIdx} className="space-y-1">
              {/* Section Header with Click-to-Collapse */}
              <button
                type="button"
                onClick={() => toggleSection(section.id)}
                className="w-full px-2.5 py-1.5 flex items-center justify-between gap-2 group cursor-pointer hover:bg-[#5A3A23]/40 rounded-xl transition-all duration-150 select-none text-left"
                aria-expanded={!isCollapsed}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform duration-200 shrink-0 ${
                      isCollapsed
                        ? '-rotate-90 text-[#CBB29F]/60 group-hover:text-white'
                        : 'rotate-0 text-[#E87A18]'
                    }`}
                  />
                  <span className={`text-[11px] font-bold uppercase tracking-wider truncate transition-colors ${
                    containsActive ? 'text-white' : 'text-[#E2C7B4]/90 group-hover:text-white'
                  }`}>
                    {section.title}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <div className="h-px w-6 sm:w-10 bg-[#5A3A23] group-hover:bg-[#E87A18]/40 transition-colors hidden xs:block" />
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border transition-colors ${
                    containsActive
                      ? 'bg-[#E87A18]/20 text-[#E87A18] border-[#E87A18]/40'
                      : 'bg-[#3D2314] text-[#CBB29F] border-[#5A3A23] group-hover:border-[#E87A18]/40'
                  }`}>
                    {section.items.length}
                  </span>
                </div>
              </button>

              {/* Collapsible Content */}
              <div
                className={`grid transition-all duration-200 ease-in-out ${
                  isCollapsed ? 'grid-rows-[0fr] opacity-0 pointer-events-none' : 'grid-rows-[1fr] opacity-100'
                }`}
              >
                <div className="overflow-hidden">
                  <ul className="space-y-1 pt-0.5">
                    {section.items.map((item, i) => {
                      const isActive = item.href === activeHref;
                      return (
                        <li key={i}>
                          <Link
                            href={item.href}
                            onClick={() => {
                              setIsMobileOpen(false);
                              if (isActive) {
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                              }
                            }}
                            className={`flex items-center space-x-2.5 px-3.5 py-2.5 rounded-xl font-medium text-xs sm:text-sm transition-all duration-200 ${
                              isActive
                                ? 'bg-[#E87A18] text-white shadow-[0_4px_16px_rgba(232,122,24,0.4)] font-semibold transform scale-[1.01]'
                                : 'text-[#E2C7B4] hover:bg-[#5A3A23] hover:text-white'
                            }`}
                          >
                            <item.icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-[#E2C7B4]'}`} />
                            <span className="truncate">{item.label}</span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            </div>
          );
        })}
      </nav>

      {/* User Info & Logout Button */}
      <div className="p-4 m-3 bg-[#3D2314] rounded-2xl border border-[#5A3A23]">
        <div className="mb-3 px-1">
          <p className="text-sm font-bold text-white truncate">{user?.fullName}</p>
          <p className="text-xs text-[#CBB29F] truncate">{user?.phone}</p>
        </div>
        <Button
          className="w-full justify-center shadow-md"
          onClick={logout}
        >
          <LogOut className="w-4 h-4 mr-1.5" /> {t('nav.logout')}
        </Button>
      </div>
    </div>
  );

  return (
    <DashboardLayoutContext.Provider value={{ isNested: true }}>
      <div className="min-h-screen bg-[#FAF7EE] text-[#2C1B10] flex p-1 xs:p-2 sm:p-3 md:p-6 font-sans w-full max-w-full overflow-x-hidden">
        {/* Mobile & Tablet Drawer Overlay */}
        {isMobileOpen && (
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
            onClick={() => setIsMobileOpen(false)}
          />
        )}

        {/* Mobile & Tablet Sidebar Drawer */}
        <aside
          className={`fixed inset-y-0 left-0 w-72 max-w-[85vw] bg-[#4A2E1B] text-white z-50 transform transition-transform duration-300 ease-in-out lg:hidden shadow-2xl ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'
            }`}
        >
          {sidebarContent}
        </aside>

        {/* Desktop Sidebar */}
        <aside className="w-64 bg-[#4A2E1B] text-white rounded-3xl min-h-[calc(100vh-3rem)] hidden lg:flex flex-col fixed left-6 top-6 bottom-6 z-20 shadow-[0_10px_30px_rgba(74,46,27,0.25)] border border-[#5A3A23]">
          {sidebarContent}
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col w-full max-w-full pl-0 lg:pl-72 min-h-screen min-w-0 overflow-x-hidden">
          {/* Top Header Bar */}
          <header className="h-13 xs:h-14 sm:h-16 bg-[#FFFDF8]/90 backdrop-blur-md border border-[#EDE4D5] rounded-xl xs:rounded-2xl sticky top-1 xs:top-2 md:top-6 z-30 px-2 xs:px-3 sm:px-4 md:px-6 flex items-center justify-between shadow-[0_4px_20px_rgba(74,46,27,0.04)] mb-3.5 xs:mb-4 sm:mb-6 md:mb-8 gap-1.5 xs:gap-2">
            <div className="flex items-center space-x-1.5 xs:space-x-2.5 md:space-x-4 min-w-0">
              <button
                onClick={() => setIsMobileOpen(true)}
                className="lg:hidden p-1.5 xs:p-2 rounded-xl bg-[#F4ECE1] text-[#4A2E1B] hover:bg-[#E0D5C3] transition-colors shrink-0"
                aria-label="Open menu"
              >
                <Menu className="w-4 h-4 xs:w-5 xs:h-5" />
              </button>

              {isOwner && (
                <div className="flex items-center space-x-1 xs:space-x-1.5 min-w-0">
                  <span className="text-xs font-bold text-[#8C7361] uppercase tracking-wider hidden lg:inline">{t('common.branch')}:</span>
                  <div className="relative inline-flex items-center">
                    {/* Visual Pill: Icon + First 4 letters on mobile (< md), Full name on desktop (md+) */}
                    <div className="flex items-center gap-1 bg-[#F4ECE1] hover:bg-[#EDE0CD] border border-[#E0D5C3] text-[#2C1B10] px-1.5 py-1 xs:px-2.5 xs:py-1.5 rounded-lg xs:rounded-xl font-bold text-xs pointer-events-none transition-colors shadow-2xs">
                      <span className="text-xs shrink-0">{currentBranch ? '📍' : '🌐'}</span>
                      <span className="md:hidden font-extrabold tracking-tight">
                        {currentBranch ? currentBranch.name.slice(0, 4) : 'All'}
                      </span>
                      <span className="hidden md:inline font-bold truncate max-w-[170px]">
                        {currentBranch ? currentBranch.name : t('dashboard.allBranches')}
                      </span>
                      <span className="text-[9px] text-[#8C7361] ml-0.5 shrink-0">▾</span>
                    </div>

                    {/* Invisible native select overlaid on top to capture clicks cleanly */}
                    <select
                      value={selectedBranchId || 'ALL'}
                      onChange={(e) => setSelectedBranchId(e.target.value === 'ALL' ? null : e.target.value)}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      aria-label={t('common.branch')}
                    >
                      <option value="ALL">🌐 {t('dashboard.allBranches')}</option>
                      {branches.map((b) => (
                        <option key={b.id} value={b.id}>
                          📍 {b.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center space-x-1 xs:space-x-2 md:space-x-3 shrink-0">
              {/* Notification Bell */}
              <NotificationBell />

              {/* Language Selector Dropdown */}
              <LanguageSelector variant="header" />

              {/* Role Badge - shown on md+ to preserve space on mobile */}
              <span className="hidden md:inline-block px-3 py-1 rounded-full text-[11px] font-extrabold bg-[#E87A18]/10 text-[#E87A18] border border-[#E87A18]/20 uppercase tracking-wider">
                {user?.customRole
                  ? language === 'am' && user.customRole.nameAm
                    ? user.customRole.nameAm
                    : language === 'om' && user.customRole.nameOm
                    ? user.customRole.nameOm
                    : user.customRole.name
                  : user?.role}
              </span>

              {/* Profile Avatar Pill */}
              <Link href="/my-profile" className="flex items-center gap-2 hover:opacity-90 transition-opacity shrink-0">
                {(user?.avatarUrl || (user?.filesUrl && !user.filesUrl.toLowerCase().endsWith('.pdf'))) && !headerAvatarError ? (
                  <img
                    src={getImageUrl(user.avatarUrl || user.filesUrl)!}
                    alt={user.fullName || 'User'}
                    onError={() => setHeaderAvatarError(true)}
                    className="w-7 h-7 xs:w-8 xs:h-8 sm:w-9 sm:h-9 rounded-lg xs:rounded-xl object-cover border border-[#E87A18]/30 shadow-md"
                  />
                ) : (
                  <div className="w-7 h-7 xs:w-8 xs:h-8 sm:w-9 sm:h-9 rounded-lg xs:rounded-xl bg-gradient-to-tr from-[#4A2E1B] to-[#E87A18] text-white flex items-center justify-center font-extrabold text-[11px] xs:text-xs sm:text-sm shadow-md border border-white/20">
                    {user?.fullName?.charAt(0) || 'B'}
                  </div>
                )}
              </Link>
            </div>
          </header>

          {/* Page Content View */}
          <main className="flex-1 px-0.5 xs:px-1 sm:px-2 w-full max-w-full min-w-0">
            <div className="max-w-7xl mx-auto space-y-3.5 xs:space-y-5 w-full max-w-full min-w-0">
              {children}
            </div>
          </main>
        </div>
      </div>
    </DashboardLayoutContext.Provider>
  );
}
