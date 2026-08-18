# Manual Testing Guide for Signout Endpoint

## Overview
This guide explains how to manually test the `/api/auth/extension/signout` endpoint.

## Prerequisites
1. Development server running: `npm run dev`
2. A valid user account to test with

## Test Steps

### Test 1: Successful Signout
1. **Sign in to get a token:**
   ```bash
   curl -X POST http://localhost:3000/api/auth/extension/signin \
     -H "Content-Type: application/json" \
     -d '{"email": "demo@stackapply.ai", "password": "demo123"}'
   ```
   
   Expected response:
   ```json
   {
     "success": true,
     "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
     "user": {
       "id": "...",
       "email": "demo@stackapply.ai",
       "fullName": "Demo User"
     }
   }
   ```

2. **Copy the token from the response**

3. **Sign out using the token:**
   ```bash
   curl -X POST http://localhost:3000/api/auth/extension/signout \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer YOUR_TOKEN_HERE"
   ```
   
   Expected response (200):
   ```json
   {
     "success": true,
     "message": "Signed out successfully"
   }
   ```

4. **Try to validate the same token (should fail):**
   ```bash
   curl -X POST http://localhost:3000/api/auth/extension/validate \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer YOUR_TOKEN_HERE"
   ```
   
   Expected response (401):
   ```json
   {
     "error": "Invalid token"
   }
   ```

### Test 2: Missing Authorization Header
```bash
curl -X POST http://localhost:3000/api/auth/extension/signout \
  -H "Content-Type: application/json"
```

Expected response (401):
```json
{
  "error": "Invalid token"
}
```

### Test 3: Invalid Token Format
```bash
curl -X POST http://localhost:3000/api/auth/extension/signout \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer invalid-token-123"
```

Expected response (401):
```json
{
  "error": "Invalid token"
}
```

### Test 4: Already Signed Out Token (Double Signout)
1. Follow Test 1 to sign out
2. Try to sign out again with the same token

Expected response (401):
```json
{
  "error": "Invalid token"
}
```

### Test 5: CORS Headers (OPTIONS Request)
```bash
curl -X OPTIONS http://localhost:3000/api/auth/extension/signout \
  -H "Origin: chrome-extension://abc123" \
  -v
```

Expected headers in response:
- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Methods: POST, OPTIONS`
- `Access-Control-Allow-Headers: Content-Type, Authorization`

## Implementation Details

### Endpoint: `POST /api/auth/extension/signout`

**Requirements Validated:**
- 9.1: Provides "Sign Out" functionality
- 9.2: Clears Session_Token from database (ExtensionSession record deleted)
- 9.6: Clears cached user data (session deleted from database)

**Request:**
- Method: POST
- Headers: `Authorization: Bearer <token>`
- Body: None

**Success Response (200):**
```json
{
  "success": true,
  "message": "Signed out successfully"
}
```

**Error Response (401):**
```json
{
  "error": "Invalid token"
}
```

**Implementation Flow:**
1. Extract token from `Authorization: Bearer <token>` header
2. Call `ExtensionAuthService.revokeToken(token)` which:
   - Verifies JWT signature
   - Extracts JWT ID (jti claim)
   - Deletes ExtensionSession record from database using jti
3. Return success confirmation

**Security Features:**
- HTTPS-only in production
- Token validation with JWT signature verification
- Session deletion prevents token reuse
- CORS headers for extension compatibility
- No sensitive data in error messages
