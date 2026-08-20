import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { put, del } from "@vercel/blob";
import Anthropic from "@anthropic-ai/sdk";
import { Prisma } from "@prisma/client";
import { decryptApiKey } from "@/lib/encryption";

/**
 * POST /api/user/linkedin-pdf
 * Upload LinkedIn profile PDF and parse it with AI
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("linkedin") as File;

    if (!file) {
      return NextResponse.json(
        { error: "No file uploaded" },
        { status: 400 }
      );
    }

    // Validate file type
    if (file.type !== "application/pdf") {
      return NextResponse.json(
        { error: "File must be a PDF" },
        { status: 400 }
      );
    }

    // Validate file size (max 10MB for LinkedIn profiles)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File size must be less than 10MB" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { 
        id: true, 
        linkedinUrl: true,
        apiKeyProvider: true,
        apiKeyEncrypted: true,
        aiAnalysisCount: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Upload PDF to Vercel Blob
    const blob = await put(`linkedin/${user.id}-${Date.now()}.pdf`, file, {
      access: "public",
    });

    // Check user's API key status
    const hasCustomKey = !!user.apiKeyEncrypted;
    const userProvider = user.apiKeyProvider;

    // PDF parsing requires Anthropic (Claude) for document vision
    // OpenAI doesn't support PDF document input yet
    if (hasCustomKey && userProvider === 'OPENAI') {
      return NextResponse.json(
        { 
          error: "PDF parsing not supported with OpenAI",
          message: "LinkedIn PDF parsing requires Anthropic's Claude model for document vision. Please add an Anthropic API key or use the free tier.",
        },
        { status: 400 }
      );
    }

    // Get free tier config
    const FREE_TIER_LIMIT = parseInt(process.env.FREE_TIER_LIMIT || '5', 10);
    const FREE_TIER_MODEL = process.env.FREE_TIER_MODEL!;
    const LINKEDIN_PDF_MODEL = process.env.LINKEDIN_PDF_MODEL!;

    // Check if user has exceeded free tier (only if not using custom Anthropic key)
    if (!hasCustomKey) {
      if (user.aiAnalysisCount >= FREE_TIER_LIMIT) {
        return NextResponse.json(
          { 
            error: "Free tier limit reached",
            message: `You've used all ${FREE_TIER_LIMIT} free AI analyses. Add your own Anthropic API key to continue.`,
            freeAnalysesUsed: user.aiAnalysisCount,
            freeAnalysesLimit: FREE_TIER_LIMIT,
          },
          { status: 403 }
        );
      }
    }

    // Use appropriate API key and model
    if (!hasCustomKey && !process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: "AI service not configured" },
        { status: 500 }
      );
    }

    const apiKey = hasCustomKey && userProvider === 'ANTHROPIC'
      ? decryptApiKey(user.apiKeyEncrypted!) 
      : process.env.ANTHROPIC_API_KEY!;
    
    const modelToUse = hasCustomKey && userProvider === 'ANTHROPIC' 
      ? LINKEDIN_PDF_MODEL 
      : FREE_TIER_MODEL;

    // Extract text from PDF using Anthropic's PDF support
    const anthropic = new Anthropic({ apiKey });

    // Convert file to base64 for Anthropic API
    const arrayBuffer = await file.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');

    // Parse LinkedIn PDF with AI
    const message = await anthropic.messages.create({
      model: modelToUse,
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: {
                type: "base64",
                media_type: "application/pdf",
                data: base64,
              },
            },
            {
              type: "text",
              text: `Extract structured profile data from this LinkedIn PDF export.

Return ONLY a valid JSON object with this exact structure (no markdown, no code blocks):

{
  "name": "Full Name",
  "headline": "Professional headline/title",
  "location": "City, State/Country",
  "about": "Full about/summary section",
  "experience": [
    {
      "title": "Job Title",
      "company": "Company Name",
      "dates": "Start Date - End Date",
      "description": "Role description"
    }
  ],
  "education": [
    {
      "school": "School Name",
      "degree": "Degree Name",
      "dates": "Start Year - End Year"
    }
  ],
  "skills": ["Skill 1", "Skill 2", "Skill 3"],
  "certifications": [
    {
      "name": "Certification Name",
      "issuer": "Issuing Organization",
      "date": "Issue Date"
    }
  ]
}

Important:
- Extract all information accurately from the PDF
- If a section is missing, use an empty array [] or empty string ""
- Ensure the JSON is valid and parseable
- Do NOT include any markdown formatting or code blocks`
            }
          ],
        },
      ],
    });

    // Parse AI response
    const responseText = message.content[0].type === 'text' 
      ? message.content[0].text 
      : '';

    // Remove markdown code blocks if present
    const cleanedResponse = responseText
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    let linkedinData;
    try {
      linkedinData = JSON.parse(cleanedResponse);
    } catch (parseError) {
      console.error('Failed to parse AI response:', cleanedResponse);
      throw new Error('AI returned invalid JSON');
    }

    // Add metadata
    linkedinData.profileUrl = user.linkedinUrl || '';
    linkedinData.scrapedAt = new Date().toISOString();
    linkedinData.source = 'pdf_upload';

    // Update user record with parsed LinkedIn data and increment usage counter
    await prisma.user.update({
      where: { id: user.id },
      data: { 
        linkedinData: linkedinData,
        linkedinSyncedAt: new Date(),
        // Only increment if using free tier (not custom Anthropic key)
        ...(!hasCustomKey || userProvider !== 'ANTHROPIC' ? { aiAnalysisCount: { increment: 1 } } : {}),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'LinkedIn profile uploaded and parsed successfully',
      linkedinData: linkedinData,
      pdfUrl: blob.url,
    });
  } catch (error) {
    console.error("LinkedIn PDF upload error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to upload LinkedIn PDF" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/user/linkedin-pdf
 * Delete LinkedIn profile data
 */
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, linkedinData: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    if (!user.linkedinData) {
      return NextResponse.json(
        { error: "No LinkedIn data to delete" },
        { status: 404 }
      );
    }

    // Clear LinkedIn data
    await prisma.user.update({
      where: { id: user.id },
      data: { 
        linkedinData: Prisma.JsonNull,
        linkedinSyncedAt: null,
      },
    });

    return NextResponse.json({
      success: true,
      message: "LinkedIn profile data deleted successfully",
    });
  } catch (error) {
    console.error("LinkedIn deletion error:", error);
    return NextResponse.json(
      { error: "Failed to delete LinkedIn data" },
      { status: 500 }
    );
  }
}
