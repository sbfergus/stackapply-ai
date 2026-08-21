/**
 * Database Schema Checker
 * 
 * This script checks if the production database has been properly migrated
 * with the resume-only fields.
 * 
 * Usage:
 *   DATABASE_URL="your-production-db-url" npx tsx scripts/check-db-schema.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkSchema() {
  console.log('🔍 Checking database schema...\n');

  try {
    // Check if we can query the User table with new fields
    const testUser = await prisma.user.findFirst({
      select: {
        id: true,
        email: true,
        resumeUrl: true,
        resumeHash: true,
        resumeUpdatedAt: true,
        parsedResume: true,
        resumeLastParsedAt: true,
      },
      take: 1,
    });

    console.log('✅ User table has all resume-only fields:');
    console.log('   - resumeUrl ✓');
    console.log('   - resumeHash ✓');
    console.log('   - resumeUpdatedAt ✓');
    console.log('   - parsedResume ✓');
    console.log('   - resumeLastParsedAt ✓');
    
    if (testUser) {
      console.log('\n📊 Sample user data:');
      console.log(`   ID: ${testUser.id}`);
      console.log(`   Email: ${testUser.email}`);
      console.log(`   Has Resume: ${testUser.resumeUrl ? 'Yes' : 'No'}`);
      console.log(`   Resume Hash: ${testUser.resumeHash || 'Not set'}`);
      console.log(`   Resume Updated: ${testUser.resumeUpdatedAt || 'Never'}`);
      console.log(`   Parsed Resume Cached: ${testUser.parsedResume ? 'Yes' : 'No'}`);
      console.log(`   Last Parsed: ${testUser.resumeLastParsedAt || 'Never'}`);
    }

    // Check Job table
    const testJob = await prisma.job.findFirst({
      select: {
        id: true,
        title: true,
        matchScore: true,
        matchCalculatedWithResumeHash: true,
      },
      take: 1,
    });

    console.log('\n✅ Job table has matchCalculatedWithResumeHash field ✓');
    
    if (testJob) {
      console.log('\n📊 Sample job data:');
      console.log(`   ID: ${testJob.id}`);
      console.log(`   Title: ${testJob.title}`);
      console.log(`   Match Score: ${testJob.matchScore || 'Not calculated'}`);
      console.log(`   Calculated With Hash: ${testJob.matchCalculatedWithResumeHash || 'Not set'}`);
    }

    // Check for old LinkedIn fields (should not exist)
    try {
      await prisma.$queryRaw`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'User' 
        AND column_name IN ('linkedinUrl', 'linkedinData', 'linkedinSyncedAt', 'linkedinPdfUrl')
      `;
      console.log('\n⚠️  WARNING: Old LinkedIn fields still exist in database!');
      console.log('   Migration may not have been fully applied.');
    } catch (e) {
      console.log('\n✅ Old LinkedIn fields have been removed ✓');
    }

    console.log('\n✅ Database schema is up to date!\n');

  } catch (error) {
    console.error('\n❌ Database schema check FAILED!\n');
    
    if (error instanceof Error) {
      if (error.message.includes('column') || error.message.includes('does not exist')) {
        console.error('🚨 SCHEMA MISMATCH DETECTED');
        console.error('   The database is missing required fields.');
        console.error('   Please run: npx prisma migrate deploy\n');
      } else {
        console.error('Error details:', error.message);
      }
    } else {
      console.error('Unknown error:', error);
    }
    
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

checkSchema().catch(console.error);
