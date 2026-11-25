/**
 * Granular Role & Privilege Authorization Matrix for Bakery ERP
 *
 * Allows Owners to fine-tune system access per staff member,
 * enabling or disabling specific ERP modules with smart role presets.
 */

export interface PrivilegeDefinition {
  key: string;
  labelEn: string;
  labelAm: string;
  labelOm: string;
  descriptionEn: string;
  descriptionAm: string;
  descriptionOm: string;
  category: 'Foundation' | 'Operations' | 'Finance & Catalog';
  defaultRoles: string[];
}

export const SYSTEM_PRIVILEGES: PrivilegeDefinition[] = [
  {
    key: 'access_dashboard',
    labelEn: 'Executive & KPI Dashboard',
    labelAm: 'የአጠቃላይ እይታ እና ሪፖርቶች',
    labelOm: 'Ilaalcha Waliigalaa',
    descriptionEn: 'View sales KPIs, branch revenue cards, and daily financial positions',
    descriptionAm: 'የዕለት የሽያጭ፣ የወጪ እና የቅርንጫፍ አጠቃላይ አፈጻጸም መመልከቻ',
    descriptionOm: "Ilaalcha waliigala gurgurtaa fi bu'aa dammee",
    category: 'Foundation',
    defaultRoles: ['OWNER'],
  },
  {
    key: 'access_users',
    labelEn: 'Staff & Team Roles',
    labelAm: 'ሠራተኞች እና ኃላፊነቶች',
    labelOm: 'Hojjattoota fi Gaheewwan',
    descriptionEn: 'View employee roster, register staff members, and assign custom privileges',
    descriptionAm: 'አዳዲስ ሠራተኞችን መመዝገብ፣ መረጃ ማደስና የሲስተም ፈቃዶችን መቆጣጠር',
    descriptionOm: 'Hojjattoota galmeessuu fi heyyama isaanii to\'achuu',
    category: 'Foundation',
    defaultRoles: ['OWNER', 'ADMIN'],
  },
  {
    key: 'access_branches',
    labelEn: 'Branches & Retail Outlets',
    labelAm: 'ቅርንጫፎች እና ሱቆች',
    labelOm: 'Dammeewwan fi Suuqota',
    descriptionEn: 'Configure hub & spoke branch network and manage store details',
    descriptionAm: 'የማዕከልና የችርቻሮ ቅርንጫፎችን መክፈትና ማስተዳደር',
    descriptionOm: 'Dammeewwan haaraa banuu fi bulchuu',
    category: 'Foundation',
    defaultRoles: ['OWNER'],
  },
  {
    key: 'access_stock',
    labelEn: 'Raw Flour & Stock Depot',
    labelAm: 'የዱቄትና ጥሬ ዕቃ ክምችት',
    labelOm: 'Kuusaa Daakuu fi Meeshaalee',
    descriptionEn: 'Track 50kg flour bags, ingredient intake, and stock levels',
    descriptionAm: 'የዱቄት ጆንያዎች ክምችት፣ እርሾና ጨው የፍጆታ መቆጣጠሪያ',
    descriptionOm: 'Kuusaa daakuu fi meeshaalee bu\'uuraa to\'achuu',
    category: 'Operations',
    defaultRoles: ['OWNER', 'ADMIN', 'STOCK_KEEPER', 'STOREKEEPER'],
  },
  {
    key: 'access_production',
    labelEn: 'Baking Batches & Physics Yield',
    labelAm: 'የዳቦ ጋገራ እና ምርት',
    labelOm: 'Tolchuu Dabboo fi Oomisha',
    descriptionEn: 'Log flour bags, oven batch yields vs 1,362 benchmark, and scrap loaves',
    descriptionAm: 'የዕለት የዳቦ ጋገራ ባች፣ 1,362 የዱቄት ምርታማነትና ብክነት መመዝገቢያ',
    descriptionOm: 'Oomisha dabboo fi qisaasama galmeessuu',
    category: 'Operations',
    defaultRoles: ['OWNER', 'ADMIN', 'BAKER', 'CAKE_WORKER', 'SAMBUSA_WORKER'],
  },
  {
    key: 'access_transfers',
    labelEn: 'Inter-Branch Crate Transfers',
    labelAm: 'የቅርንጫፎች ዕቃ ማስተላለፊያ',
    labelOm: 'Dabarsa Oomishaalee',
    descriptionEn: 'Dispatch crates from Hub and receive/approve deliveries at spokes',
    descriptionAm: 'ከዋናው ማዕከል ወደ ቅርንጫፎች የዳቦ ሳጥኖችን መላክና መቀበል',
    descriptionOm: 'Saanduuqa dabboo dammeewwaniif erguu fi simachuu',
    category: 'Operations',
    defaultRoles: ['OWNER', 'ADMIN', 'STOCK_KEEPER', 'STOREKEEPER', 'DRIVER', 'CASHIER'],
  },
  {
    key: 'access_categories',
    labelEn: 'Product Categories Architecture',
    labelAm: 'የምርት ምድቦች እና ንዑስ ምድቦች',
    labelOm: 'Garee Oomishaa fi Garee Xiqqaa',
    descriptionEn: 'Master catalog taxonomy, root categories, and workstation role mappings',
    descriptionAm: 'የምርት ዋና ምድቦችና ንዑስ ምድቦችን ማስተካከል',
    descriptionOm: 'Garee oomishaa bu\'uuraa qindeessuu',
    category: 'Finance & Catalog',
    defaultRoles: ['OWNER'],
  },
  {
    key: 'access_products',
    labelEn: 'Product Catalog & Prices',
    labelAm: 'የምርት ዝርዝር እና ዋጋ',
    labelOm: 'Tarree Oomishaa fi Gatii',
    descriptionEn: 'View product catalog, unit selling prices, and shelf availability',
    descriptionAm: 'የምርቶች ዝርዝር፣ መሸጫ ዋጋ እና በመደርደሪያ ላይ ያለ ክምችት',
    descriptionOm: 'Tarree oomishaalee, gatii gurgurtaa fi kuusaa',
    category: 'Finance & Catalog',
    defaultRoles: ['OWNER', 'ADMIN', 'CASHIER', 'STOCK_KEEPER', 'STOREKEEPER'],
  },
  {
    key: 'access_daily_sessions',
    labelEn: 'Daily Cash Drawer Sessions',
    labelAm: 'የዕለት ካዝና እና ክፍለ-ጊዜ',
    labelOm: 'Kufiinsa Kaazinaa Guyyaa',
    descriptionEn: 'Manage daily cash sessions, opening floats, and cash handover reconciliation',
    descriptionAm: 'የዕለት የገንዘብ ክፍለ-ጊዜዎችን መክፈት፣ መዝጋትና የሂሳብ ርክክብ',
    descriptionOm: 'Kufiinsa herrega kaazinaa guyyaa fi wal-harkaa fuudhiinsa',
    category: 'Finance & Catalog',
    defaultRoles: ['OWNER', 'ADMIN'],
  },
  {
    key: 'access_customer_credits',
    labelEn: 'Customer Credits & Recovery',
    labelAm: 'የደንበኞች የዱቤ ሒሳብና ክፍያ',
    labelOm: 'Liqii Maamilaa fi Kaffaltii',
    descriptionEn: 'Issue customer credit orders with limits and record cash/digital repayments',
    descriptionAm: 'የደንበኞች ዱቤ መመዝገቢያ እና የገንዘብ ተከፋይ ሒሳብ ማጠቃለያ',
    descriptionOm: 'Liqii maamiltootaa fi kaffaltii deebii galmeessuu',
    category: 'Finance & Catalog',
    defaultRoles: ['OWNER', 'ADMIN', 'CASHIER'],
  },
  {
    key: 'access_suppliers',
    labelEn: 'Suppliers & Raw Material Purchases',
    labelAm: 'አቅራቢዎች እና የጥሬ ዕቃ ግዢ',
    labelOm: 'Dhiyeessitoota fi Bittaa Meeshaalee',
    descriptionEn: 'Manage ingredient vendors, track purchase receipts, and credit balances',
    descriptionAm: 'የዱቄትና ጥሬ ዕቃ አቅራቢዎች ዝርዝር፣ የክፍያ እና የዕዳ መዝገብ',
    descriptionOm: 'Dhiyeessitoota daakuu fi meeshaalee dheedaa to\'achuu',
    category: 'Operations',
    defaultRoles: ['OWNER', 'ADMIN', 'CASHIER'],
  },
  {
    key: 'access_expenses',
    labelEn: 'Branch Operational Expenses',
    labelAm: 'የቅርንጫፍ የዕለት ወጪዎች',
    labelOm: 'Baasiiwwan Dammee Guyyaa',
    descriptionEn: 'Record petty cash expenses, utility bills, tea/coffee, and branch costs',
    descriptionAm: 'የመብራት፣ የትራንስፖርት፣ የሻይ/ቡና እና ሌሎች የዕለት ወጪዎች መመዝገቢያ',
    descriptionOm: 'Baasiiwwan xixiqqaa guyyaa guyyaan baafaman galmeessuu',
    category: 'Finance & Catalog',
    defaultRoles: ['OWNER', 'ADMIN', 'CASHIER'],
  },
  {
    key: 'access_owner_loans',
    labelEn: 'Owner Capital & Loan Ledger',
    labelAm: 'የባለቤት ካፒታልና ብድር መዝገብ',
    labelOm: 'Kaappitaala fi Liqii Abbaa Qabeenyaa',
    descriptionEn: 'Track owner capital injections and personal drawings separate from EBITDA',
    descriptionAm: 'የባለቤቱ የግል ብድርና ተጨማሪ ካፒታል መቆጣጠሪያ',
    descriptionOm: 'Kaappitaala dabalataa fi liqii abbaa qabeenyaa to\'achuu',
    category: 'Finance & Catalog',
    defaultRoles: ['OWNER'],
  },
  {
    key: 'access_payroll',
    labelEn: 'Operating Payroll & Penalties',
    labelAm: 'የሠራተኞች ደመወዝ፣ ብድርና ቅጣት',
    labelOm: 'Mindaa Hojjattootaa, Liqii fi Adabbii',
    descriptionEn: 'Calculate monthly net pay, staff advances, and attendance deductions',
    descriptionAm: 'የወር ደመወዝ ስሌት፣ የሠራተኞች ቅድመ-ክፍያ እና የቅጣት ቅነሳ',
    descriptionOm: 'Herrega mindaa baatii, liqii dursaa fi adabbii hojjattootaa',
    category: 'Foundation',
    defaultRoles: ['OWNER', 'ADMIN'],
  },
  {
    key: 'access_attendance',
    labelEn: 'Staff Attendance & Face Verification',
    labelAm: 'የሠራተኞች መገኘት እና የፊት ስካን',
    labelOm: 'To\'annoo Argama Hojjattootaa (Suuraan)',
    descriptionEn: 'Live camera attendance check-in, photo verification, and tardiness penalty review',
    descriptionAm: 'የቀጥታ ካሜራ የፊት ስካን መገኘት እና የመዘግየት ቅጣት መቆጣጠሪያ',
    descriptionOm: 'To\'annoo argama hojjattootaa suuraan fi hordoffii turaatii',
    category: 'Foundation',
    defaultRoles: ['OWNER', 'ADMIN'],
  },
  {
    key: 'access_reports',
    labelEn: 'Financial Reports & Net Worth',
    labelAm: 'አጠቃላይ የፋይናንስ ሪፖርቶች እና ሀብት',
    labelOm: 'Gabaasa Faayinaansii fi Qabeenyaa',
    descriptionEn: 'Multi-branch consolidated P&L, stock asset valuation, and net income audit',
    descriptionAm: 'የቅርንጫፎች አጠቃላይ ትርፍና ኪሳራ፣ የክምችት ሀብት እና የባለቤት አጠቃላይ ሀብት',
    descriptionOm: 'Gabaasa waliigalaa bu\'aa fi baasii, kuusaa fi qabeenya qulqulluu',
    category: 'Finance & Catalog',
    defaultRoles: ['OWNER', 'ADMIN'],
  },
];

/**
 * Returns default privileges for a given base role.
 */
export function getDefaultPrivilegesForRole(role?: string | null): string[] {
  if (!role) return [];
  const upperRole = role.toUpperCase();
  if (upperRole === 'OWNER') {
    return SYSTEM_PRIVILEGES.map((p) => p.key);
  }
  return SYSTEM_PRIVILEGES
    .filter((priv) => priv.defaultRoles.includes(upperRole))
    .map((priv) => priv.key);
}

/**
 * Checks if a user has a specific system privilege.
 * Owner always has unrestricted root access.
 * If user has custom permissions array, explicit permissions take effect.
 * Otherwise, falls back to role default permissions.
 */
export function hasPrivilege(
  user: { role?: string | null; permissions?: string[] } | null | undefined,
  privilegeKey: string
): boolean {
  if (!user?.role) return false;
  if (user.role.toUpperCase() === 'OWNER') return true;

  // If user has explicit customized permissions array
  if (user.permissions && Array.isArray(user.permissions) && user.permissions.length > 0) {
    return user.permissions.includes(privilegeKey);
  }

  // Fallback to role smart defaults
  const defaults = getDefaultPrivilegesForRole(user.role);
  return defaults.includes(privilegeKey);
}
