import { prisma } from '../prisma';

export interface ComprehensiveUserProfile {
  // Basic Info
  name: string;
  headline: string;
  location: string;
  
  // Work Experience (combined from LinkedIn + Resume)
  experience: Array<{
    title: string;
    company: string;
    dates: string;
    description: string;
    source: 'linkedin' | 'resume' | 'both';
  }>;
  
  // Education
  education: Array<{
    school: string;
    degree: string;
    dates: string;
  }>;
  
  // Skills (deduplicated)
  skills: string[];
  
  // Certifications
  certifications: Array<{
    name: string;
    issuer: string;
    date: string;
  }>;
  
  // Professional Summary
  summary: string;
  
  // Raw resume text (if available)
  resumeText?: string;
  
  // Metadata
  hasResume: boolean;
  hasLinkedInProfile: boolean;
  completeness: number; // 0-100
}

/**
 * Build a comprehensive user profile by combining resume and LinkedIn data
 */
export async function buildComprehensiveProfile(
  userId: string
): Promise<ComprehensiveUserProfile> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      fullName: true,
      resumeUrl: true,
      linkedinData: true,
      linkedinUrl: true,
      baseResumeText: true,
    },
  });

  if (!user) {
    throw new Error('User not found');
  }

  const linkedinData = user.linkedinData as any;
  const hasResume = !!user.resumeUrl || !!user.baseResumeText;
  const hasLinkedIn = !!linkedinData;

  // Initialize profile
  const profile: ComprehensiveUserProfile = {
    name: user.fullName || linkedinData?.name || 'Unknown',
    headline: linkedinData?.headline || '',
    location: linkedinData?.location || '',
    experience: [],
    education: [],
    skills: [],
    certifications: [],
    summary: '',
    resumeText: user.baseResumeText || undefined,
    hasResume,
    hasLinkedInProfile: hasLinkedIn,
    completeness: 0,
  };

  // Merge LinkedIn data
  if (linkedinData) {
    // Add LinkedIn experience
    if (linkedinData.experience && Array.isArray(linkedinData.experience)) {
      profile.experience.push(
        ...linkedinData.experience.map((exp: any) => ({
          title: exp.title || '',
          company: exp.company || '',
          dates: exp.dates || '',
          description: exp.description || '',
          source: 'linkedin' as const,
        }))
      );
    }

    // Add LinkedIn education
    if (linkedinData.education && Array.isArray(linkedinData.education)) {
      profile.education.push(...linkedinData.education);
    }

    // Add LinkedIn skills
    if (linkedinData.skills && Array.isArray(linkedinData.skills)) {
      profile.skills.push(...linkedinData.skills);
    }

    // Add certifications
    if (linkedinData.certifications && Array.isArray(linkedinData.certifications)) {
      profile.certifications.push(...linkedinData.certifications);
    }

    // Use About section as summary
    if (linkedinData.about) {
      profile.summary = linkedinData.about;
    }
  }

  // TODO: If we add resume parsing in the future, merge resume data here
  // This would involve parsing the resume PDF and combining experience/skills
  // with LinkedIn data (deduplicating and marking source)

  // Deduplicate skills (case-insensitive)
  profile.skills = [...new Set(profile.skills.map(s => s.trim()))]
    .filter(Boolean)
    .sort();

  // Calculate completeness score
  profile.completeness = calculateCompletenessScore(profile);

  return profile;
}

/**
 * Calculate how complete a user profile is (0-100)
 */
function calculateCompletenessScore(profile: ComprehensiveUserProfile): number {
  let score = 0;
  const maxScore = 100;

  // Basic info (30 points)
  if (profile.name && profile.name !== 'Unknown') score += 10;
  if (profile.headline) score += 10;
  if (profile.location) score += 10;

  // Experience (25 points)
  if (profile.experience.length > 0) score += 15;
  if (profile.experience.length >= 3) score += 10;

  // Education (10 points)
  if (profile.education.length > 0) score += 10;

  // Skills (20 points)
  if (profile.skills.length > 0) score += 10;
  if (profile.skills.length >= 5) score += 10;

  // Professional summary (10 points)
  if (profile.summary && profile.summary.length > 50) score += 10;

  // Certifications (5 points bonus)
  if (profile.certifications.length > 0) score += 5;

  return Math.min(score, maxScore);
}

/**
 * Format profile as readable text for AI analysis
 */
export function formatProfileForAI(profile: ComprehensiveUserProfile): string {
  const sections: string[] = [];

  // Header
  sections.push(`=== CANDIDATE PROFILE ===\n`);
  sections.push(`Name: ${profile.name}`);
  if (profile.headline) sections.push(`Title: ${profile.headline}`);
  if (profile.location) sections.push(`Location: ${profile.location}`);
  sections.push(`Profile Completeness: ${profile.completeness}%\n`);

  // Professional Summary
  if (profile.summary) {
    sections.push(`=== PROFESSIONAL SUMMARY ===`);
    sections.push(profile.summary);
    sections.push('');
  }

  // Experience
  if (profile.experience.length > 0) {
    sections.push(`=== WORK EXPERIENCE ===`);
    profile.experience.forEach((exp, i) => {
      sections.push(`\n${i + 1}. ${exp.title} at ${exp.company}`);
      if (exp.dates) sections.push(`   ${exp.dates}`);
      if (exp.description) sections.push(`   ${exp.description}`);
    });
    sections.push('');
  }

  // Education
  if (profile.education.length > 0) {
    sections.push(`=== EDUCATION ===`);
    profile.education.forEach((edu, i) => {
      sections.push(`${i + 1}. ${edu.school}`);
      if (edu.degree) sections.push(`   ${edu.degree}`);
      if (edu.dates) sections.push(`   ${edu.dates}`);
    });
    sections.push('');
  }

  // Skills
  if (profile.skills.length > 0) {
    sections.push(`=== SKILLS ===`);
    sections.push(profile.skills.join(', '));
    sections.push('');
  }

  // Certifications
  if (profile.certifications.length > 0) {
    sections.push(`=== CERTIFICATIONS ===`);
    profile.certifications.forEach((cert, i) => {
      sections.push(`${i + 1}. ${cert.name}`);
      if (cert.issuer) sections.push(`   Issuer: ${cert.issuer}`);
      if (cert.date) sections.push(`   Date: ${cert.date}`);
    });
    sections.push('');
  }

  // Raw Resume (if available)
  if (profile.resumeText) {
    sections.push(`=== RAW RESUME TEXT ===`);
    sections.push(profile.resumeText);
    sections.push('');
  }

  return sections.join('\n');
}

/**
 * Get profile summary stats for UI display
 */
export function getProfileStats(profile: ComprehensiveUserProfile) {
  return {
    experienceCount: profile.experience.length,
    skillsCount: profile.skills.length,
    educationCount: profile.education.length,
    certificationsCount: profile.certifications.length,
    completeness: profile.completeness,
    hasResume: profile.hasResume,
    hasLinkedInProfile: profile.hasLinkedInProfile,
  };
}
