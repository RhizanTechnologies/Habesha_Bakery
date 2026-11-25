/**
 * Display Translation Utilities for Lowest-Level Data Localization
 * Provides comprehensive native English, Amharic, and Afaan Oromo translations for
 * database-seeded values, product names, units, categories, damage reasons,
 * expense tags, branch names, and staff roles.
 */

export type NativeLanguage = 'en' | 'am' | 'om';

// 1. Product Names Display Dictionary
const productTranslations: Record<string, { en: string; am: string; om: string }> = {
  'Bread': {
    en: 'Bread',
    am: 'መደበኛ ዳቦ',
    om: 'Dabboo Baramaa',
  },
  'Special Loaf Bread': {
    en: 'Special Loaf Bread',
    am: 'ልዩ የፎርም ዳቦ',
    om: 'Dabboo Loofii Addaa',
  },
  'Lentil Sambusa': {
    en: 'Lentil Sambusa',
    am: 'የምስር ሳምቡሳ',
    om: 'Sambuusaa Misiraa',
  },
  'Strawberry Cream Cake': {
    en: 'Strawberry Cream Cake',
    am: 'ስትሮውቤሪ ክሬም ኬክ',
    om: 'Keekii Istirooberii Kiriimii',
  },
  'Fresh Milk': {
    en: 'Fresh Milk',
    am: 'ትኩስ ወተት',
    om: 'Aannan Haaraa',
  },
  'White Teff Injera': {
    en: 'White Teff Injera',
    am: 'የነጭ ጤፍ እንጀራ',
    om: 'Injeeraa Xaafii Adii',
  },
  'Standard Loaf (500g)': {
    en: 'Standard Loaf (500g)',
    am: 'መደበኛ ዳቦ (500ግ)',
    om: 'Dabboo Baramaa (500g)',
  },
  'Burger Buns (Pack of 4)': {
    en: 'Burger Buns (Pack of 4)',
    am: 'የበርገር ዳቦ (ባለ 4 ፍሬ)',
    om: 'Dabboo Boorgerii (Qubee 4)',
  },
  'French Baguette': {
    en: 'French Baguette',
    am: 'የፈረንሳይ ባጌት',
    om: 'Dabboo Baageetii',
  },
  'Special Defo Dabo (Large)': {
    en: 'Special Defo Dabo (Large)',
    am: 'ልዩ ድፎ ዳቦ (ትልቅ)',
    om: 'Dabboo Difoo Addaa (Guddaa)',
  },
  'Butter Croissant': {
    en: 'Butter Croissant',
    am: 'የቅቤ ክሮሳንት',
    om: 'Kiroosaantii Dhadhaa',
  },
  'Day-Old Bread (Yalefe Dabo)': {
    en: 'Day-Old Bread (Discounted)',
    am: 'ያለፈ ዳቦ (አዳሪ)',
    om: 'Dabboo Kaleessaa (Adarii)',
  },
  'Enjera (Mitad Standard)': {
    en: 'Enjera (Mitad Standard)',
    am: 'እንጀራ (የምጣድ መደበኛ)',
    om: 'Injeeraa (Baramaa)',
  },
  'Special Beef Sambusa': {
    en: 'Special Beef Sambusa',
    am: 'ልዩ የበሬ ሥጋ ሳምቡሳ',
    om: 'Sambuusaa Foonii Addaa',
  },
  'Lentil Fasting Sambusa': {
    en: 'Lentil Fasting Sambusa',
    am: 'የምስር የጾም ሳምቡሳ',
    om: 'Sambuusaa Misiraa Soomaa',
  },
  'Chocolate Layer Cake': {
    en: 'Chocolate Layer Cake',
    am: 'የቸኮሌት ድርብ ኬክ',
    om: 'Keekii Chookoleetii Dabalataa',
  },
  'Bole Standard Flour (50kg)': {
    en: 'Standard Flour (50kg)',
    am: 'መደበኛ ዱቄት (50ኪ.ግ)',
    om: 'Daakuu Baramaa (50kg)',
  },
  'Instant Dry Yeast (500g)': {
    en: 'Instant Dry Yeast (500g)',
    am: 'ደረቅ እርሾ (500ግ)',
    om: 'Iirshoo Gogaa (500g)',
  },
  'Cooking Oil (20L)': {
    en: 'Cooking Oil (20L)',
    am: 'የምግብ ዘይት (20ሊ)',
    om: 'Zayita Nyaataa (20L)',
  },
  'Iodized Table Salt (1kg)': {
    en: 'Iodized Table Salt (1kg)',
    am: 'አዮዲዝድ ጨው (1ኪ.ግ)',
    om: 'Soogidda Ayoodiinii (1kg)',
  },
  'Duplicate Loaf': {
    en: 'Additional Loaf',
    am: 'ተጨማሪ ዳቦ',
    om: 'Dabboo Dabalataa',
  },
};

export function translateProductName(name: string | undefined | null, lang: NativeLanguage): string {
  if (!name) return '';
  const match = productTranslations[name.trim()];
  if (match) return match[lang];

  if (lang === 'en') return name;

  // Partial match checks for non-English
  if (name.includes('Burger')) return lang === 'am' ? 'የበርገር ዳቦ' : 'Dabboo Boorgerii';
  if (name.includes('Baguette')) return lang === 'am' ? 'የፈረንሳይ ባጌት' : 'Dabboo Baageetii';
  if (name.includes('Croissant')) return lang === 'am' ? 'ክሮሳንት' : 'Kiroosaantii';
  if (name.includes('Defo')) return lang === 'am' ? 'ድፎ ዳቦ' : 'Dabboo Difoo';
  if (name.includes('Day-Old') || name.includes('Yalefe')) return lang === 'am' ? 'ያለፈ ዳቦ (አዳሪ)' : 'Dabboo Kaleessaa (Adarii)';
  if (name.includes('Loaf')) return lang === 'am' ? 'መደበኛ ዳቦ' : 'Dabboo Baramaa';
  if (name.includes('Enjera')) return lang === 'am' ? 'እንጀራ' : 'Injeeraa';

  return name;
}

// 2. Product Categories Display Dictionary
const categoryTranslations: Record<string, { en: string; am: string; om: string }> = {
  'Bread (Machine)': {
    en: 'Bread (Machine)',
    am: 'የማሽን ዳቦ',
    om: 'Dabboo Maashinii',
  },
  'Pastry & Snacks': {
    en: 'Pastry & Snacks',
    am: 'ፓስትሪና መክሰስ',
    om: 'Paastirii fi Nyaata Salphaa',
  },
  'Cakes & Desserts': {
    en: 'Cakes & Desserts',
    am: 'ኬኮችና ጣፋጮች',
    om: 'Keekii fi Mi\'aawaa',
  },
  'Dairy': {
    en: 'Dairy',
    am: 'የወተት ተዋጽኦ',
    om: 'Aannanii fi Bu\'aa Aannanii',
  },
  'Injera': {
    en: 'Injera',
    am: 'እንጀራ',
    om: 'Injeeraa',
  },
  'Fresh Baked Bread': {
    en: 'Fresh Baked Bread',
    am: 'ትኩስ የተጋገረ ዳቦ',
    om: 'Dabboo Haaraa Bilchaate',
  },
  'Specialty Pastries': {
    en: 'Specialty Pastries',
    am: 'ልዩ ኬኮችና ፖስትሪዎች',
    om: 'Pastiirii fi Keekii Addaa',
  },
  'Traditional & Cultural': {
    en: 'Traditional & Cultural',
    am: 'ባህላዊና ልማዳዊ ዳቦዎች',
    om: 'Dabboowwan Aadaa',
  },
  'Packaged Buns': {
    en: 'Packaged Buns',
    am: 'የታሸጉ ዳቦዎች',
    om: 'Dabboowwan Saamsaman',
  },
  'All Categories': {
    en: 'All Categories',
    am: 'ሁሉም ክፍሎች',
    om: 'Kutaalee Hunda',
  },
};

export function translateCategoryName(category: string | undefined | null, lang: NativeLanguage): string {
  if (!category) {
    if (lang === 'am') return 'ትኩስ ዳቦ';
    if (lang === 'om') return 'Dabboo Haaraa';
    return 'Fresh Baked Bread';
  }
  const match = categoryTranslations[category.trim()];
  if (match) return match[lang];
  return category;
}

// 3. Stock Units Display Dictionary
const unitTranslations: Record<string, { en: string; am: string; om: string }> = {
  PIECE: { en: 'pcs', am: 'ፍሬ', om: 'qubee' },
  piece: { en: 'pcs', am: 'ፍሬ', om: 'qubee' },
  pcs: { en: 'pcs', am: 'ፍሬ', om: 'qubee' },
  PCS: { en: 'pcs', am: 'ፍሬ', om: 'qubee' },
  PACK: { en: 'pack', am: 'ፓኬት', om: 'paakeetii' },
  pack: { en: 'pack', am: 'ፓኬት', om: 'paakeetii' },
  KG: { en: 'kg', am: 'ኪ.ግ', om: 'kg' },
  kg: { en: 'kg', am: 'ኪ.ግ', om: 'kg' },
  LOAF: { en: 'loaf', am: 'ዳቦ', om: 'dabboo' },
  loaf: { en: 'loaf', am: 'ዳቦ', om: 'dabboo' },
  CRATE: { en: 'crates', am: 'ሳጥን', om: 'saanduuqa' },
  crates: { en: 'crates', am: 'ሳጥን', om: 'saanduuqa' },
  BAG: { en: 'bags', am: 'ኩንታል', om: 'kuntaala' },
  bag: { en: 'bags', am: 'ኩንታል', om: 'kuntaala' },
  BAG_50KG: { en: 'bags', am: 'ኩንታል', om: 'kuntaala' },
  LITER: { en: 'liters', am: 'ሊትር', om: 'litra' },
  liter: { en: 'liters', am: 'ሊትር', om: 'litra' },
};

export function translateUnit(unit: string | undefined | null, lang: NativeLanguage): string {
  if (!unit) {
    if (lang === 'am') return 'ፍሬ';
    if (lang === 'om') return 'qubee';
    return 'pcs';
  }
  const match = unitTranslations[unit.trim()];
  if (match) return match[lang];
  return unit;
}

// 4. Branch Names Display Dictionary
const branchTranslations: Record<string, { en: string; am: string; om: string }> = {
  'Bole Central Bakery': {
    en: 'Bole Central Bakery',
    am: 'ቦሌ ዋና መጋገሪያ',
    om: 'Wiirtuu Dabboo Boolee',
  },
  'Bole Central Hub': {
    en: 'Bole Central Hub',
    am: 'ቦሌ ዋና ማዕከል',
    om: 'Wiirtuu Guddaa Boolee',
  },
  'Bole Hub': {
    en: 'Bole Hub',
    am: 'ቦሌ ዋና ማዕከል',
    om: 'Wiirtuu Guddaa Boolee',
  },
  'Megenagna Spoke': {
    en: 'Megenagna Spoke',
    am: 'መገናኛ ቅርንጫፍ',
    om: 'Dammee Maganaanyaa',
  },
  'Megenagna Branch': {
    en: 'Megenagna Branch',
    am: 'መገናኛ ቅርንጫፍ',
    om: 'Dammee Maganaanyaa',
  },
  'Kazanchis Spoke': {
    en: 'Kazanchis Spoke',
    am: 'ካዛንቺስ ቅርንጫፍ',
    om: 'Dammee Kaazaančiis',
  },
  'Kazanchis Branch': {
    en: 'Kazanchis Branch',
    am: 'ካዛንቺስ ቅርንጫፍ',
    om: 'Dammee Kaazaančiis',
  },
  'Piassa Spoke': {
    en: 'Piassa Spoke',
    am: 'ፒያሳ ቅርንጫፍ',
    om: 'Dammee Piyaasaa',
  },
  'Piassa Branch': {
    en: 'Piassa Branch',
    am: 'ፒያሳ ቅርንጫፍ',
    om: 'Dammee Piyaasaa',
  },
  'CMC Spoke': {
    en: 'CMC Spoke',
    am: 'ሲኤምሲ ቅርንጫፍ',
    om: 'Dammee Siieemsii',
  },
  'CMC Branch': {
    en: 'CMC Branch',
    am: 'ሲኤምሲ ቅርንጫፍ',
    om: 'Dammee Siieemsii',
  },
  'Saris Spoke': {
    en: 'Saris Spoke',
    am: 'ሳሪስ ቅርንጫፍ',
    om: 'Dammee Saariis',
  },
  'Saris Branch': {
    en: 'Saris Branch',
    am: 'ሳሪስ ቅርንጫፍ',
    om: 'Dammee Saariis',
  },
  'Gerji Spoke': {
    en: 'Gerji Spoke',
    am: 'ገርጂ ቅርንጫፍ',
    om: 'Dammee Garjii',
  },
  'Sarbet Spoke': {
    en: 'Sarbet Spoke',
    am: 'ሳርቤት ቅርንጫፍ',
    om: 'Dammee Saarbeet',
  },
};

export function translateBranchName(name: string | undefined | null, lang: NativeLanguage): string {
  if (!name) {
    if (lang === 'am') return 'ቅርንጫፍ';
    if (lang === 'om') return 'Dammee';
    return 'Branch';
  }
  const match = branchTranslations[name.trim()];
  if (match) return match[lang];

  if (lang === 'en') return name;

  // Dynamic Spoke/Hub suffixes
  if (name.includes('Spoke')) {
    const base = name.replace('Spoke', '').trim();
    return lang === 'am' ? `${base} ቅርንጫፍ` : `Dammee ${base}`;
  }
  if (name.includes('Hub')) {
    const base = name.replace('Hub', '').trim();
    return lang === 'am' ? `${base} ማዕከል` : `Wiirtuu ${base}`;
  }

  return name;
}

// 5. User Roles Display Dictionary
const roleTranslations: Record<string, { en: string; am: string; om: string }> = {
  OWNER: { en: 'Enterprise Owner', am: 'ባለቤት', om: 'Abbaa Qabeenyaa' },
  SUPER_ADMIN: { en: 'Super Admin', am: 'ዋና አስተዳዳሪ', om: 'Hogganaa Ol\'aanaa' },
  ADMIN: { en: 'Administrator', am: 'አስተዳዳሪ', om: 'Bulchaa' },
  BRANCH_MANAGER: { en: 'Branch Manager', am: 'ሥራ አስኪያጅ', om: 'Hogganaa Dammee' },
  CASHIER: { en: 'Cashier', am: 'ካሸር (ገንዘብ ያዥ)', om: 'Kaashiyara' },
  HEAD_BAKER: { en: 'Head Baker', am: 'ዋና ጋጋሪ', om: 'Ogeessa Dabboo Ol\'aanaa' },
  BAKER: { en: 'Baker', am: 'ጋጋሪ', om: 'Ogeessa Dabboo' },
  PRODUCTION_SUPERVISOR: { en: 'Production Supervisor', am: 'የምርት ኃላፊ', om: 'To\'ataa Oomishaa' },
  STOREKEEPER: { en: 'Storekeeper', am: 'የዕቃ ቤት ኃላፊ', om: 'Hoggansa Kuusaa' },
  INVENTORY_CONTROLLER: { en: 'Inventory Controller', am: 'የንብረት ቁጥጥር', om: 'To\'ataa Qabeenyaa' },
  DRIVER: { en: 'Delivery Driver', am: 'አሽከርካሪ / አከፋፋይ', om: 'Konkolaachisaa' },
  CAKE_WORKER: { en: 'Cake & Pastry Chef', am: 'የኬክና ፓስትሪ ባለሙያ', om: 'Oogeessa Keekii' },
  SAMBUSA_WORKER: { en: 'Sambusa & Snack Maker', am: 'የሳምቡሳና ፈጣን ምግብ ሠራተኛ', om: 'Hojjataa Sambuusaa' },
  EMPLOYEE: { en: 'General Staff', am: 'አጠቃላይ ሠራተኛ', om: 'Hojjataa Waliigalaa' },
};

export function translateRoleName(role: string | undefined | null, lang: NativeLanguage): string {
  if (!role) {
    if (lang === 'am') return 'ሠራተኛ';
    if (lang === 'om') return 'Hojjataa';
    return 'Staff';
  }
  const match = roleTranslations[role.trim()];
  if (match) return match[lang];
  return role;
}

// 6. Damage Reasons Display Dictionary
const damageReasonTranslations: Record<string, { en: string; am: string; om: string }> = {
  'Crushed in transport': {
    en: 'Crushed in transport',
    am: 'በትራንስፖርት ወቅት የተጨፈለቀ',
    om: 'Geejjibarratti kan caccabe',
  },
  'Burnt in oven': {
    en: 'Burnt in oven',
    am: 'በፎርን የተቃጠለ',
    om: 'Foornii keessatti kan gubate',
  },
  'Expired / Mouldy': {
    en: 'Expired / Mouldy',
    am: 'የሻገተ / ጊዜው ያለፈበት',
    om: 'Yeroon kan darbe / Arreeffame',
  },
  'Customer returned': {
    en: 'Customer returned',
    am: 'በደንበኛ የተመለሰ',
    om: 'Maamilaan kan deebi\'e',
  },
  'Mishandled at counter': {
    en: 'Mishandled at counter',
    am: 'በሽያጭ ጠረጴዛ የተበላሸ',
    om: 'Gabatee gurgurtaarratti kan manca\'e',
  },
  'Unaccounted shortage': {
    en: 'Unaccounted shortage',
    am: 'ያልታወቀ ጉድለት',
    om: 'Hanqina hin beekamne',
  },
};

export function translateDamageReason(reason: string | undefined | null, lang: NativeLanguage): string {
  if (!reason) return '';
  const match = damageReasonTranslations[reason.trim()];
  if (match) return match[lang];
  return reason;
}

// 7. Expense Categories Display Dictionary
const expenseCategoryTranslations: Record<string, { en: string; am: string; om: string }> = {
  STAFF_LUNCH: { en: 'Staff Meals', am: 'የሠራተኛ ምሳ / ምግብ', om: 'Laaqana Hojjattootaa' },
  TRANSPORT: { en: 'Transport & Fuel', am: 'የትራንስፖርት / ማድረሻ', om: 'Geejjiba / Dhiyeessii' },
  TEA_COFFEE: { en: 'Tea & Coffee', am: 'ሻይና ቡና', om: 'Shaayee fi Buna' },
  CLEANING_SUPPLIES: { en: 'Cleaning & Sanitation', am: 'የጽዳት ዕቃዎችና ሳሙና', om: 'Mi\'oota Qulqullinaa' },
  MAINTENANCE: { en: 'Maintenance & Repairs', am: 'ጥቃቅን ጥገና', om: 'Suphaa Xiqqaa' },
  RAW_MATERIAL: { en: 'Raw Material Purchase', am: 'የጥሬ ዕቃ ግዢ', om: 'Bittaa Meeshaa Dheedaa' },
  UTILITIES: { en: 'Utilities (Water/Electric)', am: 'የመብራት፣ ውሃ እና ስልክ', om: 'Ibsaa, Bishaan fi Tajaajila' },
  PACKAGING: { en: 'Packaging Supplies', am: 'የማሸጊያ ፌስታል እና ሳጥን', om: 'Meeshaa Saamsamaa' },
  DAILY_WAGE: { en: 'Daily Labor Wage', am: 'የዕለት ሠራተኛ ክፍያ', om: 'Kaffaltii Hojjetaa Guyyaa' },
  OTHER: { en: 'Other Operating Expense', am: 'ሌላ የሥራ ወጪ', om: 'Baasii Hojii Biroo' },
};

export function translateExpenseCategory(category: string | undefined | null, lang: NativeLanguage): string {
  if (!category) {
    if (lang === 'am') return 'ወጪ';
    if (lang === 'om') return 'Baasii';
    return 'Expense';
  }
  const match = expenseCategoryTranslations[category.trim()];
  if (match) return match[lang];
  return category;
}

// 8. General Status Badges Display Dictionary
const statusTranslations: Record<string, { en: string; am: string; om: string }> = {
  ACTIVE: { en: 'Active', am: 'ንቁ', om: 'Hojirra' },
  INACTIVE: { en: 'Inactive', am: 'ቦዘኔ', om: 'Dhaabbate' },
  LOCKED: { en: 'Locked & Reconciled', am: 'ተቆልፎ የተዘጋ', om: 'Cufamee kan mirkanaa\'e' },
  OPEN: { en: 'Open Register', am: 'ክፍት የሥራ መስመር', om: 'Banaa kan jiru' },
  PENDING: { en: 'Pending Verification', am: 'በመጠባበቅ ላይ', om: 'Eeggamarra kan jiru' },
  EXACT_MATCH: { en: 'Balanced (Exact)', am: 'ትክክለኛ ሂሳብ', om: 'Hiriira Sirrii' },
  OVERAGE: { en: 'Cash Overage', am: 'የትርፍ ሂሳብ', om: 'Haftee Dabalataa' },
  SHORTAGE: { en: 'Cash Shortage', am: 'የጉድለት ሂሳብ', om: 'Hanqina Maallaqaa' },
  HUB: { en: 'Central Production Hub', am: 'ዋና ማዕከል', om: 'Wiirtuu Guddaa' },
  SPOKE: { en: 'Retail Spoke Outlet', am: 'የችርቻሮ ቅርንጫፍ', om: 'Dammee Gurgurtaa' },
  VERIFIED: { en: 'Optimal Yield', am: 'ትክክለኛ ምርት', om: 'Oomisha Sirrii' },
  FLAGGED_DEFICIT: { en: 'Flour Deficit Alert', am: 'የዱቄት ጉድለት ማስጠንቀቂያ', om: 'Akeekkachiisa Hanqina Daakuu' },
  FLAGGED_SURPLUS: { en: 'Water Dilution Alert', am: 'የውሃ መብዛት ማስጠንቀቂያ', om: 'Akeekkachiisa Bishaan Baay\x27ee' },
  DISPATCHED: { en: 'In Transit', am: 'በመንገድ ላይ ያለ', om: 'Karaarra Jira' },
  RECEIVED: { en: 'Received by Branch', am: 'በቅርንጫፍ ተረክቧል', om: 'Dammeen Fudhateera' },
  REJECTED: { en: 'Rejected', am: 'ውድቅ ተደርጓል', om: 'Kufaamameera' },
};

export function translateStatus(status: string | undefined | null, lang: NativeLanguage): string {
  if (!status) return '';
  const match = statusTranslations[status.trim()];
  if (match) return match[lang];
  return status;
}
