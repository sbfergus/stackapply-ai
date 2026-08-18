#!/bin/bash

# Test script for POST /api/auth/extension/signup endpoint
# This script tests all validation and success cases for the signup endpoint

BASE_URL="http://localhost:3000"
ENDPOINT="/api/auth/extension/signup"

echo "=========================================="
echo "Testing POST /api/auth/extension/signup"
echo "=========================================="
echo ""

# Generate unique email for testing
TIMESTAMP=$(date +%s)
VALID_EMAIL="test-${TIMESTAMP}@stackapply.ai"

# Test 1: Invalid email format (Requirement 2.1)
echo "Test 1: Invalid email format"
RESPONSE=$(curl -s -X POST "${BASE_URL}${ENDPOINT}" \
  -H "Content-Type: application/json" \
  -d '{"email": "invalid-email", "password": "TestPassword123"}')
echo "Response: $RESPONSE"
echo ""

# Test 2: Password too short (Requirement 2.3)
echo "Test 2: Password too short (< 8 characters)"
RESPONSE=$(curl -s -X POST "${BASE_URL}${ENDPOINT}" \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "short"}')
echo "Response: $RESPONSE"
echo ""

# Test 3: Successful signup (Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6)
echo "Test 3: Successful signup with valid credentials"
RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST "${BASE_URL}${ENDPOINT}" \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"${VALID_EMAIL}\", \"password\": \"ValidPassword123\"}")
echo "Response: $RESPONSE"
echo ""

# Test 4: Duplicate email (Requirement 2.2)
echo "Test 4: Duplicate email registration"
RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST "${BASE_URL}${ENDPOINT}" \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"${VALID_EMAIL}\", \"password\": \"AnotherPassword123\"}")
echo "Response: $RESPONSE"
echo ""

# Test 5: OPTIONS preflight request (CORS)
echo "Test 5: OPTIONS preflight request"
RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X OPTIONS "${BASE_URL}${ENDPOINT}" \
  -H "Origin: chrome-extension://test" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type")
echo "Response: $RESPONSE"
echo ""

echo "=========================================="
echo "Testing complete!"
echo "=========================================="
echo ""
echo "Expected results:"
echo "- Test 1: Should return 400 with 'Invalid email format'"
echo "- Test 2: Should return 400 with 'Password must be at least 8 characters'"
echo "- Test 3: Should return 201 with success: true, token, and user data"
echo "- Test 4: Should return 409 with 'Email already registered. Please sign in.'"
echo "- Test 5: Should return 200 with CORS headers"
echo ""
echo "Note: Test user email: ${VALID_EMAIL}"
echo "You may want to clean up this test user from the database."
