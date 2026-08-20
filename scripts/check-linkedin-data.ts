import { config } from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { Pool } from '@neondatabase/serverless';

// Load environment variables
config();

// Use Neon adapter for CLI script
const connectionString = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ DATABASE_URL_UNPOOLED or DATABASE_URL not found in environment');
  process.exit(1);
}

const pool = new Pool({ connectionString });
const adapter = new PrismaNeon(pool);
const prisma = new PrismaClient({ adapter });

const userEmail = process.argv[2];

if (!userEmail) {
  console.error('❌ Please provide user email as argument');
  console.log('Usage: npx tsx scripts/check-linkedin-data.ts user@example.com');
  process.exit(1);
}

async function checkLinkedInData() {
  try {
    const user = await prisma.user.findUnique({
      where: { email: userEmail.toLowerCase() },
      select: {
        id: true,
        email: true,
        fullName: true,
        linkedinData: true,
        linkedinSyncedAt: true,
        linkedinUrl: true,
      },
    });

    if (!user) {
      console.error(`❌ User not found: ${userEmail}`);
      process.exit(1);
    }

    console.log('\n✅ User found:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`ID: ${user.id}`);
    console.log(`Email: ${user.email}`);
    console.log(`Name: ${user.fullName || '(not set)'}`);
    console.log(`LinkedIn URL: ${user.linkedinUrl || '(not set)'}`);
    console.log(`Last Synced: ${user.linkedinSyncedAt ? user.linkedinSyncedAt.toISOString() : '(never)'}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    if (!user.linkedinData) {
      console.log('⚠️  No LinkedIn data synced yet');
      process.exit(0);
    }

    const data = user.linkedinData as any;

    console.log('📊 LinkedIn Profile Data:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Name: ${data.name || '(not captured)'}`);
    console.log(`Headline: ${data.headline || '(not captured)'}`);
    console.log(`Location: ${data.location || '(not captured)'}`);
    console.log(`Profile URL: ${data.profileUrl || '(not captured)'}`);
    console.log(`Scraped At: ${data.scrapedAt || '(not captured)'}`);
    
    console.log('\n📝 About:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    if (data.about) {
      const preview = data.about.length > 200 ? data.about.substring(0, 200) + '...' : data.about;
      console.log(preview);
      console.log(`(${data.about.length} characters)`);
    } else {
      console.log('(not captured)');
    }

    console.log('\n💼 Experience:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    if (data.experience && data.experience.length > 0) {
      data.experience.forEach((exp: any, index: number) => {
        console.log(`\n${index + 1}. ${exp.title || '(no title)'}`);
        console.log(`   Company: ${exp.company || '(not captured)'}`);
        console.log(`   Dates: ${exp.dates || '(not captured)'}`);
        if (exp.description) {
          const preview = exp.description.length > 150 ? exp.description.substring(0, 150) + '...' : exp.description;
          console.log(`   Description: ${preview}`);
        }
      });
      console.log(`\nTotal: ${data.experience.length} positions`);
    } else {
      console.log('(no experience captured)');
    }

    console.log('\n🎓 Education:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    if (data.education && data.education.length > 0) {
      data.education.forEach((edu: any, index: number) => {
        console.log(`\n${index + 1}. ${edu.school || '(no school)'}`);
        console.log(`   Degree: ${edu.degree || '(not captured)'}`);
        console.log(`   Dates: ${edu.dates || '(not captured)'}`);
      });
      console.log(`\nTotal: ${data.education.length} entries`);
    } else {
      console.log('(no education captured)');
    }

    console.log('\n🎯 Skills:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    if (data.skills && data.skills.length > 0) {
      console.log(data.skills.join(', '));
      console.log(`\nTotal: ${data.skills.length} skills`);
    } else {
      console.log('(no skills captured)');
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n💾 Full JSON data:');
    console.log(JSON.stringify(data, null, 2));

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

checkLinkedInData();
