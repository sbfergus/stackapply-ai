#!/bin/bash

# Test script for signin endpoint
# This script tests the /api/auth/extension/signin endpoint

echo "🧪 Testing Extension Signin Endpoint"
echo "=================================="
echo ""

# Test 1: Missing credentials
echo "Test 1: Missing credentials (should fail with 401)"
curl -X POST http://localhost:3000/api/auth/extension/signin \
  -H "Content-Type: application/json" \
  -d '{}' \
  -w "\nHTTP Status: %{http_code}\n" \
  -s
echo ""
echo "---"
echo ""

# Test 2: Invalid credentials
echo "Test 2: Invalid credentials (should fail with 401)"
curl -X POST http://localhost:3000/api/auth/extension/signin \
  -H "Content-Type: application/json" \
  -d '{"email":"nonexistent@test.com","password":"wrongpassword"}' \
  -w "\nHTTP Status: %{http_code}\n" \
  -s
echo ""
echo "---"
echo ""

# Test 3: Valid credentials (demo user)
echo "Test 3: Valid credentials - demo@stackapply.ai (should succeed with 200)"
echo "Note: This will only work if demo user exists with a password"
curl -X POST http://localhost:3000/api/auth/extension/signin \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@stackapply.ai","password":"password123"}' \
  -w "\nHTTP Status: %{http_code}\n" \
  -s
echo ""
echo "---"
echo ""

# Test 4: OPTIONS preflight
echo "Test 4: OPTIONS preflight request (should succeed with CORS headers)"
curl -X OPTIONS http://localhost:3000/api/auth/extension/signin \
  -H "Content-Type: application/json" \
  -v \
  2>&1 | grep -i "access-control"
echo ""
echo "---"
echo ""

echo "✅ Test script completed!"
echo "Note: For Test 3 to pass, you need a user with email 'demo@stackapply.ai' and password 'password123'"
