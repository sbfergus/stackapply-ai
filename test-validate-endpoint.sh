#!/bin/bash

# Test script for /api/auth/extension/validate endpoint
# This script demonstrates how to test the token validation functionality

echo "=== Testing Extension Token Validation Endpoint ==="
echo ""

# Step 1: Sign in to get a valid token
echo "Step 1: Signing in to get a valid token..."
SIGNIN_RESPONSE=$(curl -s -X POST http://localhost:3000/api/auth/extension/signin \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test-validate2@example.com",
    "password": "testpassword123"
  }')

TOKEN=$(echo $SIGNIN_RESPONSE | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "❌ Failed to get token from signin"
  echo "Response: $SIGNIN_RESPONSE"
  exit 1
fi

echo "✅ Successfully obtained token"
echo "Token: ${TOKEN:0:50}..."
echo ""

# Step 2: Validate the token (should succeed)
echo "Step 2: Validating the token (should succeed)..."
VALIDATE_RESPONSE=$(curl -s -X POST http://localhost:3000/api/auth/extension/validate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN")

echo "Response: $VALIDATE_RESPONSE"
echo ""

# Check if success is true
if echo "$VALIDATE_RESPONSE" | grep -q '"success":true'; then
  echo "✅ Token validation successful"
else
  echo "❌ Token validation failed"
fi
echo ""

# Step 3: Test validate endpoint without Authorization header
echo "Step 3: Testing validate without Authorization header (should fail)..."
NO_AUTH_RESPONSE=$(curl -s -X POST http://localhost:3000/api/auth/extension/validate \
  -H "Content-Type: application/json")

echo "Response: $NO_AUTH_RESPONSE"
if echo "$NO_AUTH_RESPONSE" | grep -q '"error"'; then
  echo "✅ Correctly rejected request without auth header"
else
  echo "❌ Should have rejected request without auth header"
fi
echo ""

# Step 4: Test validate endpoint with invalid token
echo "Step 4: Testing validate with invalid token (should fail)..."
INVALID_RESPONSE=$(curl -s -X POST http://localhost:3000/api/auth/extension/validate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer invalid-token-12345")

echo "Response: $INVALID_RESPONSE"
if echo "$INVALID_RESPONSE" | grep -q '"error"'; then
  echo "✅ Correctly rejected invalid token"
else
  echo "❌ Should have rejected invalid token"
fi
echo ""

# Step 5: Test validate endpoint with malformed Authorization header
echo "Step 5: Testing validate with malformed Authorization header (should fail)..."
MALFORMED_RESPONSE=$(curl -s -X POST http://localhost:3000/api/auth/extension/validate \
  -H "Content-Type: application/json" \
  -H "Authorization: NotBearer $TOKEN")

echo "Response: $MALFORMED_RESPONSE"
if echo "$MALFORMED_RESPONSE" | grep -q '"error"'; then
  echo "✅ Correctly rejected malformed auth header"
else
  echo "❌ Should have rejected malformed auth header"
fi
echo ""

echo "=== Test Complete ==="
echo ""
echo "Summary of Expected Results:"
echo "✓ Step 2: Should return success:true with user data and expiresAt"
echo "✓ Step 3: Should return 401 with 'Missing Authorization header' error"
echo "✓ Step 4: Should return 401 with 'Invalid token' error"
echo "✓ Step 5: Should return 401 with 'Invalid Authorization header format' error"
