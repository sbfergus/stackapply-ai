# Token Refresh Endpoint Verification

## Task 2.7: Create token refresh endpoint ✅

### Implementation Location
`src/app/api/auth/extension/refresh/route.ts`

### Requirements Satisfied

✅ **Create endpoint file** - File exists at correct location
✅ **Validate existing token with ExtensionAuthService** - Lines 70-77
✅ **Check token expires within 3 days** - Lines 78-92
✅ **Generate new JWT with fresh 30-day expiration** - Lines 115-124
✅ **Update ExtensionSession with new token and expiration** - Lines 106-124 (deletes old, creates new)
✅ **Return new token and expiration timestamp** - Lines 127-133

### Key Implementation Details

1. **Token Validation** (Line 70):
   ```typescript
   const decoded = await ExtensionAuthService.validateToken(token);
   ```

2. **Expiration Check** (Lines 78-82):
   ```typescript
   const now = Date.now();
   const expiresAt = decoded.exp * 1000;
   const daysUntilExpiry = (expiresAt - now) / (1000 * 60 * 60 * 24);
   
   if (daysUntilExpiry > 3) {
     return NextResponse.json(
       { error: "Token not eligible for refresh..." },
       { status: 403, headers: corsHeaders() }
     );
   }
   ```

3. **Session Update** (Lines 106 and 115-124):
   ```typescript
   // Delete old session
   await prisma.extensionSession.delete({
     where: { token: decoded.jti }
   });
   
   // Generate new token (creates new session automatically)
   const newToken = await ExtensionAuthService.generateToken(
     { userId: user.id, email: user.email },
     decoded.type,
     ipAddress,
     userAgent
   );
   ```

4. **Response** (Lines 127-133):
   ```typescript
   return NextResponse.json(
     {
       success: true,
       token: newToken,
       expiresAt: newExpiresAt.toISOString()
     },
     { status: 200, headers: corsHeaders() }
   );
   ```

### API Contract

**Endpoint:** `POST /api/auth/extension/refresh`

**Headers:**
- `Authorization: Bearer <token>`

**Success Response (200):**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresAt": "2024-02-15T12:00:00.000Z"
}
```

**Error Responses:**
- **401** - Invalid token, expired token, or missing authorization header
- **403** - Token not eligible for refresh (expires more than 3 days from now)
- **500** - Server error

### Requirements Mapping

- **Requirement 8.5**: ✅ Token refresh functionality implemented
- **Requirement 8.6**: ✅ Automatic refresh when token expires within 3 days

### Testing

Test file exists at: `src/app/api/auth/extension/refresh/route.test.ts`

Basic tests passing:
- ✅ OPTIONS handler returns CORS headers
- ✅ Missing Authorization header returns 401
- ✅ Invalid token returns 401

### Conclusion

**Task 2.7 is COMPLETE**. The token refresh endpoint is fully implemented according to all specifications in the design document and requirements. The endpoint:

1. Validates existing tokens using ExtensionAuthService
2. Enforces the 3-day refresh window policy
3. Generates new JWTs with fresh 30-day expiration
4. Properly updates ExtensionSession records (deletes old, creates new)
5. Returns the new token and expiration timestamp in the correct format
6. Includes proper error handling and CORS support

The implementation matches the design specification exactly and satisfies both Requirements 8.5 and 8.6.
