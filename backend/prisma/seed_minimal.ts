import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting Minimal Clean Setup (One Branch & One Owner)...');

  // 1. Wipe any existing data
  const tableNames = [
    'CustomerCreditPayment',
    'CustomerCredit',
    'Customer',
    'PasswordResetRequest',
    'PayrollRecord',
    'Penalty',
    'LoanPayment',
    'Loan',
    'Expense',
    'SupplierDelivery',
    'Supplier',
    'LeftoverRecord',
    'SaleItem',
    'Sale',
    'ProductConversion',
    'ProductionMaterialUsage',
    'ProductionItem',
    'ProductionBatch',
    'StockPurchasePayment',
    'StockPurchaseLoan',
    'StockMovement',
    'StockItem',
    'Product',
    'FinancialCategory',
    'ProductCategory',
    'DailySession',
    'AttendanceRecord',
    'Notification',
    'User',
    'Branch',
    'Company',
    'SystemSetting',
  ];

  const quotedTables = tableNames.map((t) => `"${t}"`).join(', ');
  try {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${quotedTables} CASCADE;`);
    console.log('🧹 Cleaned existing records.');
  } catch (e: any) {
    console.log('Table truncate notice:', e.message);
  }

  // 2. Create Company
  const company = await prisma.company.create({
    data: {
      name: 'Habesha Bakery Enterprise',
      email: 'contact@habeshabakery.et',
      phone: '0912345678',
      address: 'Bole, Addis Ababa, Ethiopia',
    },
  });
  console.log('🏢 Company created:', company.name);

  // 3. Create One Branch (Hub)
  const branch = await prisma.branch.create({
    data: {
      name: 'Megenagna Main Branch',
      code: 'MEG-HUB',
      isHub: true,
      address: 'Around Megenagna Square, Zefmesh Mall Area, Addis Ababa',
      companyId: company.id,
    },
  });
  console.log('📍 Single Branch created:', branch.name, `(${branch.code})`);

  // 4. Create Owner User
  const passwordHash = await bcrypt.hash('password123', 10);
  const owner = await prisma.user.create({
    data: {
      fullName: 'Hamza Owner',
      phone: '0912345678',
      passwordHash,
      role: Role.OWNER,
      salary: 50000,
      branchId: branch.id,
    },
  });
  console.log('👑 Single Owner created:');
  console.log('   - Name:', owner.fullName);
  console.log('   - Phone / Username:', owner.phone);
  console.log('   - Password: password123');
  console.log('   - Role:', owner.role);

  // 5. Default Calendar Setting
  await prisma.systemSetting.upsert({
    where: { key: 'calendarType' },
    update: { value: 'ETHIOPIAN' },
    create: { key: 'calendarType', value: 'ETHIOPIAN' },
  });
  console.log('📅 Calendar Setting initialized: ETHIOPIAN');

  console.log('\n✅ Clean database ready for end-to-end testing!');
  console.log('   No mock products, stock, sales, sessions, or staff created.');
}

main()
  .catch((e) => {
    console.error('❌ Error during minimal setup:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
