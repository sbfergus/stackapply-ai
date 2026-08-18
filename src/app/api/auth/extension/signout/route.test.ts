/**
 * Manual integration test for signout endpoint
 * 
 * This test validates the signout functionality according to requirements 9.1, 9.2, and 9.6.
 * 
 * To run this test:
 * 1. Ensure DATABASE_URL is set in .env
 * 2. Run: npx tsx src/app/api/auth/extension/signout/route.test.ts
 * 
 * Test cases covered:
 * - ✓ Valid token successfully signs out and deletes session
 * - ✓ Invalid token returns 401
 * - ✓ Missing Authorization header returns 401
 * - ✓ Already signed-out token returns 401
 * - ✓ CORS headers are present
 */

// Load environment variables
import dotenv from "dotenv";
dotenv.config();

import { NextRequest } from "next/server";
import { POST, OPTIONS } from "./route";
import { ExtensionAuthService } from "@/lib/extensionAuth";
import { prisma } from "@/lib/prisma";

/**
 * Helper to create a mock NextRequest
 */
function createMockRequest(token?: string): NextRequest {
  const headers = new Headers();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  
  return new NextRequest("http://localhost:3000/api/auth/extension/signout", {
    method: "POST",
    headers,
  });
}

/**
 * Test: OPTIONS handler returns CORS headers
 */
async function testOptionsHandler() {
  console.log("Test: OPTIONS handler returns CORS headers");
  const response = await OPTIONS();
  const headers = Object.fromEntries(response.headers.entries());
  
  if (headers["access-control-allow-origin"] !== "*") {
    throw new Error("Missing CORS origin header");
  }
  
  if (!headers["access-control-allow-methods"]?.includes("POST")) {
    throw new Error("Missing POST in allowed methods");
  }
  
  console.log("✓ OPTIONS handler works correctly\n");
}

/**
 * Test: Missing Authorization header returns 401
 */
async function testMissingAuthHeader() {
  console.log("Test: Missing Authorization header returns 401");
  const req = createMockRequest();
  const response = await POST(req);
  const data = await response.json();
  
  if (response.status !== 401) {
    throw new Error(`Expected 401, got ${response.status}`);
  }
  
  if (data.error !== "Invalid token") {
    throw new Error(`Unexpected error message: ${data.error}`);
  }
  
  console.log("✓ Missing auth header handled correctly\n");
}

/**
 * Test: Invalid token returns 401
 */
async function testInvalidToken() {
  console.log("Test: Invalid token returns 401");
  const req = createMockRequest("invalid-token-123");
  const response = await POST(req);
  const data = await response.json();
  
  if (response.status !== 401) {
    throw new Error(`Expected 401, got ${response.status}`);
  }
  
  if (data.error !== "Invalid token") {
    throw new Error(`Unexpected error message: ${data.error}`);
  }
  
  console.log("✓ Invalid token handled correctly\n");
}

/**
 * Integration test: Create a test user, sign in, and sign out
 * 
 * This test requires:
 * - Database connection
 * - EXTENSION_JWT_SECRET environment variable
 */
async function testFullSignoutFlow() {
  console.log("Test: Full signout flow");
  
  // Create a test user
  const testEmail = `test-signout-${Date.now()}@example.com`;
  const bcrypt = require("bcryptjs");
  const hashedPassword = await bcrypt.hash("testpassword123", 10);
  
  const user = await prisma.user.create({
    data: {
      email: testEmail,
      password: hashedPassword,
      fullName: "Test User",
    },
  });
  
  try {
    // Generate token (simulates sign-in)
    const token = await ExtensionAuthService.generateToken(
      { userId: user.id, email: user.email },
      "extension"
    );
    
    console.log("  - Created token and session");
    
    // Verify session exists
    const sessionsBefore = await prisma.extensionSession.findMany({
      where: { userId: user.id },
    });
    
    if (sessionsBefore.length !== 1) {
      throw new Error(`Expected 1 session before signout, found ${sessionsBefore.length}`);
    }
    
    console.log("  - Verified session exists in database");
    
    // Test signout
    const req = createMockRequest(token);
    const response = await POST(req);
    const data = await response.json();
    
    if (response.status !== 200) {
      throw new Error(`Expected 200, got ${response.status}: ${JSON.stringify(data)}`);
    }
    
    if (!data.success || data.message !== "Signed out successfully") {
      throw new Error(`Invalid response: ${JSON.stringify(data)}`);
    }
    
    console.log("  - Signout endpoint returned success");
    
    // Verify session was deleted from database
    const sessionsAfter = await prisma.extensionSession.findMany({
      where: { userId: user.id },
    });
    
    if (sessionsAfter.length !== 0) {
      throw new Error(`Expected 0 sessions after signout, found ${sessionsAfter.length}`);
    }
    
    console.log("  - Session deleted from database");
    
    // Try signing out again with the same token (should fail)
    const req2 = createMockRequest(token);
    const response2 = await POST(req2);
    const data2 = await response2.json();
    
    if (response2.status !== 401) {
      throw new Error(`Expected 401 on second signout, got ${response2.status}`);
    }
    
    if (data2.error !== "Invalid token") {
      throw new Error(`Expected "Invalid token" error, got: ${data2.error}`);
    }
    
    console.log("  - Second signout with same token correctly returns 401");
    console.log("✓ Full signout flow works correctly\n");
    
  } finally {
    // Cleanup: delete test user (sessions cascade delete)
    await prisma.extensionSession.deleteMany({
      where: { userId: user.id },
    });
    await prisma.user.delete({
      where: { id: user.id },
    });
    console.log("  - Cleaned up test data");
  }
}

/**
 * Run all tests
 */
async function runTests() {
  console.log("=== Signout Endpoint Tests ===\n");
  
  try {
    await testOptionsHandler();
    await testMissingAuthHeader();
    await testInvalidToken();
    
    // Only run integration test if database is available
    if (process.env.DATABASE_URL) {
      await testFullSignoutFlow();
    } else {
      console.log("⚠ Skipping integration test (DATABASE_URL not set)\n");
    }
    
    console.log("=== All tests passed! ===");
  } catch (error) {
    console.error("❌ Test failed:", error);
    process.exit(1);
  }
}

// Run tests if executed directly
if (require.main === module) {
  runTests();
}
