import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function checkUser() {
  try {
    const user = await prisma.user.findUnique({
      where: { email: 'test-1787088263@stackapply.ai' },
      include: { extensionSessions: true }
    });
    
    if (user) {
      console.log('✅ User Record Created:');
      console.log(JSON.stringify({
        id: user.id,
        email: user.email,
        passwordHashLength: user.password ? user.password.length : 0,
        passwordStartsWith: user.password ? user.password.substring(0, 7) : null,
        sessionCount: user.extensionSessions.length
      }, null, 2));
      
      if (user.extensionSessions.length > 0) {
        console.log('\n✅ Extension Session Created:');
        console.log(JSON.stringify({
          id: user.extensionSessions[0].id,
          tokenJti: user.extensionSessions[0].token,
          expiresAt: user.extensionSessions[0].expiresAt,
          createdAt: user.extensionSessions[0].createdAt
        }, null, 2));
      }
    } else {
      console.log('❌ User not found');
    }
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
    pool.end();
  }
}

checkUser();
