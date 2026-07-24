import { PrismaClient } from '@prisma/client';

const db = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres.xvimpyvwncsxfsumgosv:9042mgt0993@aws-1-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1'
    }
  }
});

try {
  const count = await db.user.count();
  console.log('✅ POOLER OK — count:', count);
} catch (err) {
  console.error('❌ POOLER FAILED');
  console.error('Name:', err.name);
  console.error('Message:', err.message);
  console.error('Code:', err.code);
} finally {
  await db.$disconnect();
}

// Also test direct connection
const db2 = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres:9042mgt0993@db.xvimpyvwncsxfsumgosv.supabase.co:5432/postgres'
    }
  }
});

try {
  const count = await db2.user.count();
  console.log('✅ DIRECT OK — count:', count);
} catch (err) {
  console.error('❌ DIRECT FAILED');
  console.error('Name:', err.name);
  console.error('Message:', err.message);
  console.error('Code:', err.code);
} finally {
  await db2.$disconnect();
}
