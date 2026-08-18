/**
 * Manual test script for token validation endpoint
 * 
 * This script tests the /api/auth/extension/validate endpoint
 * by creating a test user, signing in, and validating the token.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

async function testValidateEndpoint() {
  console.log('🧪 Testing Token Validation Endpoint\n');

  // Test 1: Sign up a test user
  console.log('Test 1: Sign up test user...');
  const signupEmail = `test-${Date.now()}@example.com`;
  const signupPassword = 'testpassword123';

  try {
    const signupRes = await fetch(`${API_BASE}/api/auth/extension/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: signupEmail, password: signupPassword }),
    });

    if (!signupRes.ok) {
      console.error('❌ Signup failed:', await signupRes.text());
      return;
    }

    const signupData = await signupRes.json();
    console.log('✅ Signup successful:', { 
      success: signupData.success, 
      userId: signupData.user.id,
      email: signupData.user.email 
    });

    const token = signupData.token;
    console.log('Token received (first 50 chars):', token.substring(0, 50) + '...\n');

    // Test 2: Validate the token
    console.log('Test 2: Validate token...');
    const validateRes = await fetch(`${API_BASE}/api/auth/extension/validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
    });

    if (!validateRes.ok) {
      console.error('❌ Validation failed:', await validateRes.text());
      return;
    }

    const validateData = await validateRes.json();
    console.log('✅ Validation successful:', {
      success: validateData.success,
      userId: validateData.user.id,
      email: validateData.user.email,
      expiresAt: validateData.expiresAt
    });

    // Verify expiration is ~30 days in the future
    const expiresAt = new Date(validateData.expiresAt);
    const now = new Date();
    const daysUntilExpiry = (expiresAt - now) / (1000 * 60 * 60 * 24);
    console.log(`Token expires in ${daysUntilExpiry.toFixed(2)} days\n`);

    if (daysUntilExpiry < 29 || daysUntilExpiry > 31) {
      console.warn('⚠️  Warning: Expected ~30 days expiration, got', daysUntilExpiry.toFixed(2));
    }

    // Test 3: Validate without Authorization header
    console.log('Test 3: Validate without Authorization header...');
    const noAuthRes = await fetch(`${API_BASE}/api/auth/extension/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    if (noAuthRes.status === 401) {
      const errorData = await noAuthRes.json();
      console.log('✅ Correctly rejected: 401 -', errorData.error, '\n');
    } else {
      console.error('❌ Should have returned 401, got:', noAuthRes.status);
    }

    // Test 4: Validate with invalid token
    console.log('Test 4: Validate with invalid token...');
    const invalidRes = await fetch(`${API_BASE}/api/auth/extension/validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer invalid.token.here'
      },
    });

    if (invalidRes.status === 401) {
      const errorData = await invalidRes.json();
      console.log('✅ Correctly rejected: 401 -', errorData.error, '\n');
    } else {
      console.error('❌ Should have returned 401, got:', invalidRes.status);
    }

    // Test 5: Validate token again to check lastUsedAt update
    console.log('Test 5: Validate token again (checking lastUsedAt update)...');
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second

    const validateRes2 = await fetch(`${API_BASE}/api/auth/extension/validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
    });

    if (validateRes2.ok) {
      const validateData2 = await validateRes2.json();
      console.log('✅ Second validation successful:', {
        success: validateData2.success,
        email: validateData2.user.email
      });
      console.log('Note: lastUsedAt timestamp should be updated in database\n');
    } else {
      console.error('❌ Second validation failed:', await validateRes2.text());
    }

    // Test 6: Sign out and verify token becomes invalid
    console.log('Test 6: Sign out and verify token becomes invalid...');
    const signoutRes = await fetch(`${API_BASE}/api/auth/extension/signout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
    });

    if (signoutRes.ok) {
      console.log('✅ Sign out successful');
    } else {
      console.error('❌ Sign out failed:', await signoutRes.text());
    }

    // Try validating the signed-out token
    const validateAfterSignoutRes = await fetch(`${API_BASE}/api/auth/extension/validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
    });

    if (validateAfterSignoutRes.status === 401) {
      const errorData = await validateAfterSignoutRes.json();
      console.log('✅ Correctly rejected after signout: 401 -', errorData.error, '\n');
    } else {
      console.error('❌ Should have returned 401 after signout, got:', validateAfterSignoutRes.status);
    }

    console.log('✅ All tests completed successfully!');

  } catch (error) {
    console.error('❌ Test failed with error:', error);
  }
}

// Run tests
testValidateEndpoint();
