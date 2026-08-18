/**
 * Manual integration test for token validation endpoint
 * 
 * This test validates the token validation functionality according to requirements 5.3, 5.4, 5.5, 11.2, and 11.3.
 * 
 * To run this test:
 * 1. Start the development server: npm run dev
 * 2. Run: npx ts-node src/app/api/auth/extension/validate/route.test.ts
 * 
 * Test cases covered:
 * - ✓ Valid token returns user data and expiration info
 * - ✓ Updates lastUsedAt timestamp on successful validation
 * - ✓ Invalid token returns 401
 * - ✓ Expired token returns 401
 * - ✓ Missing Authorization header returns 401
 * - ✓ Revoked session (deleted) returns 401
 * - ✓ OPTIONS handler returns correct CORS headers
 */

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
  
  return new NextRequest("http://localhost:3000/api/auth/extension/validate", {
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
 * Test: Malformed Authorization header returns 401
 */
async function testMalformedAuthHeader() {
  console.log("Test: Malformed Authorization header returns 401");
  
  // Test without "Bearer " prefix
  const headers = new Headers();
  headers.set("Authorization", "sometoken123");
  const req = new NextRequest("http://localhost:3000/api/auth/extension/validate", {
    method: "POST",
    headers,
  });
  
  const response = await POST(req);
  const data = await response.json();
  
  if (response.status !== 401) {
    throw new Error(`Expected 401, got ${response.status}`);
  }
  
  if (data.error !== "Invalid token") {
    throw new Error(`Unexpected error message: ${data.error}`);
  }
  
  console.log("✓ Malformed auth header handled correctly\n");
}

/**
 * Integration test: Create a test user, generate token, and validate it
 * 
 * This test requires:
 * - Database connection
 * - EXTENSION_JWT_SECRET environment variable
 */
async function testValidTokenFlow() {
  console.log("Test: Valid token returns user data and expiration info");
  
  // Create a test user
  const testEmail = `test-validate-${Date.now()}@example.com`;
  const bcrypt = require("bcryptjs");
  const hashedPassword = await bcrypt.hash("testpassword123", 10);
  
  const user = await prisma.user.create({
    data: {
      email: testEmail,
      password: hashedPassword,
      fullName: "Test Validate User",
    },
  });
  
  try {
    // Generate token
    const token = await ExtensionAuthService.generateToken(
      { userId: user.id, email: user.email },
      "extension"
    );
    
    console.log("  - Created token");
    
    // Get initial session state
    const sessionBefore = await prisma.extensionSession.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });
    
    if (!sessionBefore) {
      throw new Error("Session not found after token generation");
    }
    
    const initialLastUsedAt = sessionBefore.lastUsedAt;
    console.log("  - Initial lastUsedAt:", initialLastUsedAt.toISOString());
    
    // Wait a moment to ensure timestamps differ
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Test validation
    const req = createMockRequest(token);
    const response = await POST(req);
    const data = await response.json();
    
    if (response.status !== 200) {
      throw new Error(`Expected 200, got ${response.status}: ${JSON.stringify(data)}`);
    }
    
    if (!data.success || !data.user || !data.expiresAt) {
      throw new Error(`Invalid response structure: ${JSON.stringify(data)}`);
    }
    
    // Verify user data
    if (data.user.id !== user.id) {
      throw new Error("User ID mismatch");
    }
    
    if (data.user.email !== user.email) {
      throw new Error("User email mismatch");
    }
    
    if (data.user.fullName !== user.fullName) {
      throw new Error("User fullName mismatch");
    }
    
    console.log("  - User data returned correctly");
    
    // Verify expiration info
    const expiresAt = new Date(data.expiresAt);
    const daysUntilExpiry = (expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    
    if (daysUntilExpiry < 29 || daysUntilExpiry > 31) {
      throw new Error(`Token should expire in ~30 days, got ${daysUntilExpiry}`);
    }
    
    console.log("  - Expiration info correct");
    
    // Verify lastUsedAt was updated
    const sessionAfter = await prisma.extensionSession.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });
    
    if (!sessionAfter) {
      throw new Error("Session not found after validation");
    }
    
    if (sessionAfter.lastUsedAt <= initialLastUsedAt) {
      throw new Error("lastUsedAt was not updated");
    }
    
    console.log("  - lastUsedAt updated:", sessionAfter.lastUsedAt.toISOString());
    console.log("✓ Valid token flow works correctly\n");
    
  } finally {
    // Cleanup: delete test user and sessions
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
 * Integration test: Validate expired token
 */
async function testExpiredTokenFlow() {
  console.log("Test: Expired token returns 401");
  
  // Create a test user
  const testEmail = `test-expired-${Date.now()}@example.com`;
  const bcrypt = require("bcryptjs");
  const hashedPassword = await bcrypt.hash("testpassword123", 10);
  
  const user = await prisma.user.create({
    data: {
      email: testEmail,
      password: hashedPassword,
      fullName: "Test Expired User",
    },
  });
  
  try {
    // Generate token
    const token = await ExtensionAuthService.generateToken(
      { userId: user.id, email: user.email },
      "extension"
    );
    
    console.log("  - Created token");
    
    // Manually expire the session
    const session = await prisma.extensionSession.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });
    
    if (!session) {
      throw new Error("Session not found after token generation");
    }
    
    // Set expiration to past date
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await prisma.extensionSession.update({
      where: { id: session.id },
      data: { expiresAt: yesterday },
    });
    
    console.log("  - Set token expiration to past date");
    
    // Test validation
    const req = createMockRequest(token);
    const response = await POST(req);
    const data = await response.json();
    
    if (response.status !== 401) {
      throw new Error(`Expected 401, got ${response.status}: ${JSON.stringify(data)}`);
    }
    
    if (data.error !== "Token expired") {
      throw new Error(`Expected "Token expired", got "${data.error}"`);
    }
    
    console.log("✓ Expired token handled correctly\n");
    
  } finally {
    // Cleanup: delete test user and sessions
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
 * Integration test: Validate token with revoked session
 */
async function testRevokedSessionFlow() {
  console.log("Test: Revoked session returns 401");
  
  // Create a test user
  const testEmail = `test-revoked-${Date.now()}@example.com`;
  const bcrypt = require("bcryptjs");
  const hashedPassword = await bcrypt.hash("testpassword123", 10);
  
  const user = await prisma.user.create({
    data: {
      email: testEmail,
      password: hashedPassword,
      fullName: "Test Revoked User",
    },
  });
  
  try {
    // Generate token
    const token = await ExtensionAuthService.generateToken(
      { userId: user.id, email: user.email },
      "extension"
    );
    
    console.log("  - Created token");
    
    // Delete the session (simulate revocation)
    await prisma.extensionSession.deleteMany({
      where: { userId: user.id },
    });
    
    console.log("  - Revoked session (deleted from database)");
    
    // Test validation
    const req = createMockRequest(token);
    const response = await POST(req);
    const data = await response.json();
    
    if (response.status !== 401) {
      throw new Error(`Expected 401, got ${response.status}: ${JSON.stringify(data)}`);
    }
    
    if (data.error !== "Invalid token") {
      throw new Error(`Expected "Invalid token", got "${data.error}"`);
    }
    
    console.log("✓ Revoked session handled correctly\n");
    
  } finally {
    // Cleanup: delete test user
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
  console.log("=== Token Validation Endpoint Tests ===\n");
  
  try {
    await testOptionsHandler();
    await testMissingAuthHeader();
    await testMalformedAuthHeader();
    await testInvalidToken();
    
    // Only run integration tests if database is available
    if (process.env.DATABASE_URL) {
      await testValidTokenFlow();
      await testExpiredTokenFlow();
      await testRevokedSessionFlow();
    } else {
      console.log("⚠ Skipping integration tests (DATABASE_URL not set)\n");
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
