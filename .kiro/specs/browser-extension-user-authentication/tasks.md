# Implementation Plan: Browser Extension User Authentication

## Overview

This implementation plan converts the authentication design into executable coding tasks across 4 major phases: Database and Backend, Extension UI and Authentication, Integration and Testing, and Deployment. The plan ensures incremental progress with clear checkpoints, allowing each task to build on previous work while maintaining a functional state throughout development.

## Tasks

### Phase 1: Database and Backend Infrastructure

- [x] 1. Set up database schema and JWT infrastructure
  - [x] 1.1 Update Prisma schema with ExtensionSession model
    - Add `ExtensionSession` model to `prisma/schema.prisma` with fields: id, userId, token, expiresAt, lastUsedAt, ipAddress, userAgent, createdAt
    - Add relation to User model: `extensionSessions ExtensionSession[]`
    - Add indexes for performance: `@@index([userId, expiresAt])` and `@@index([token])`
    - _Requirements: 5.1, 5.2, 7.1_

  - [x] 1.2 Generate and apply Prisma migration
    - Run `npx prisma migrate dev --name add-extension-session` to create migration
    - Verify migration files created in `prisma/migrations/`
    - _Requirements: 5.1_

  - [x] 1.3 Create JWT service module
    - Create `src/lib/extensionAuth.ts` with `ExtensionAuthService` class
    - Implement `generateToken()` method: creates JWT with HS256, 30-day expiration, stores session in database
    - Implement `validateToken()` method: verifies JWT signature, checks session exists and not expired, updates lastUsedAt
    - Implement `revokeToken()` method: deletes session from database
    - Add TypeScript interfaces for `ExtensionJWT` and `TokenPayload`
    - _Requirements: 7.1, 7.2, 7.3, 8.1, 8.2_

  - [ ]* 1.4 Write unit tests for JWT service
    - Test token generation with valid user data
    - Test token validation with valid and expired tokens
    - Test token revocation
    - Test session database operations
    - _Requirements: 7.1, 7.2, 8.1_

- [ ] 2. Implement authentication API endpoints
  - [ ] 2.1 Create signup endpoint
    - Create `src/app/api/auth/extension/signup/route.ts`
    - Validate email format (RFC 5322) and password length (≥8 chars)
    - Check for existing email in database
    - Hash password with bcryptjs (10 salt rounds)
    - Create user record and generate JWT token
    - Return token and user data
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [ ]* 2.2 Write unit tests for signup endpoint
    - Test successful signup with valid credentials
    - Test duplicate email rejection
    - Test email format validation
    - Test password length validation
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [ ] 2.3 Create signin endpoint
    - Create `src/app/api/auth/extension/signin/route.ts`
    - Find user by email
    - Verify password with bcryptjs.compare()
    - Generate JWT token with 30-day expiration
    - Create or update ExtensionSession record
    - Return token and user data
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [ ]* 2.4 Write unit tests for signin endpoint
    - Test successful signin with valid credentials
    - Test invalid email rejection
    - Test invalid password rejection
    - Test session creation in database
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [ ] 2.5 Create token validation endpoint
    - Create `src/app/api/auth/extension/validate/route.ts`
    - Extract token from Authorization header (Bearer format)
    - Verify JWT signature and expiration with ExtensionAuthService
    - Check ExtensionSession exists and not expired
    - Update lastUsedAt timestamp
    - Return user data and expiration info
    - _Requirements: 5.3, 5.4, 5.5, 11.2, 11.3_

  - [ ]* 2.6 Write unit tests for validation endpoint
    - Test valid token validation
    - Test expired token rejection
    - Test invalid token rejection
    - Test lastUsedAt timestamp update
    - _Requirements: 5.3, 5.4, 5.5_

  - [ ] 2.7 Create token refresh endpoint
    - Create `src/app/api/auth/extension/refresh/route.ts`
    - Validate existing token with ExtensionAuthService
    - Check token expires within 3 days
    - Generate new JWT with fresh 30-day expiration
    - Update ExtensionSession with new token and expiration
    - Return new token and expiration timestamp
    - _Requirements: 8.5, 8.6_

  - [ ]* 2.8 Write unit tests for refresh endpoint
    - Test successful refresh for tokens expiring within 3 days
    - Test rejection for tokens with >3 days until expiry
    - Test rejection for expired tokens
    - _Requirements: 8.5, 8.6_

  - [ ] 2.9 Create signout endpoint
    - Create `src/app/api/auth/extension/signout/route.ts`
    - Extract and validate token from Authorization header
    - Delete ExtensionSession record from database
    - Return success confirmation
    - _Requirements: 9.1, 9.2, 9.6_

  - [ ]* 2.10 Write unit tests for signout endpoint
    - Test successful signout with valid token
    - Test session deletion from database
    - Test signout with invalid token
    - _Requirements: 9.1, 9.2, 9.6_

  - [ ] 2.11 Create guest mode endpoint
    - Create `src/app/api/auth/extension/guest/route.ts`
    - Find or create demo user (email: demo@stackapply.ai)
    - Generate JWT token with "guest" type claim
    - Create ExtensionSession record
    - Return token and guest user data
    - _Requirements: 4.1, 4.2, 4.3_

  - [ ]* 2.12 Write unit tests for guest mode endpoint
    - Test guest token generation
    - Test guest user retrieval/creation
    - Test guest token type claim
    - _Requirements: 4.1, 4.2, 4.3_

- [ ] 3. Update jobs API to support extension tokens
  - [ ] 3.1 Modify /api/jobs POST endpoint for token authentication
    - Update `src/app/api/jobs/route.ts` to check Authorization header
    - Extract Bearer token and validate with ExtensionAuthService
    - Fall back to NextAuth session if no extension token
    - Associate job with authenticated user ID
    - Return 401 Unauthorized for invalid/missing tokens
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [ ]* 3.2 Write integration tests for jobs API authentication
    - Test job creation with valid extension token
    - Test job creation with NextAuth session
    - Test job creation with guest token
    - Test 401 rejection for invalid token
    - Test 401 rejection for expired token
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [ ] 4. Implement rate limiting and audit logging
  - [ ] 4.1 Create rate limiting service
    - Create `src/lib/rateLimit.ts` with `rateLimit()` function
    - Implement in-memory rate limiting with Map-based store
    - Configure rate limits: signup (5/hour), signin (10/hour), validate (100/min), refresh (10/hour)
    - Return 429 Too Many Requests when limits exceeded
    - _Requirements: 7.6_

  - [ ]* 4.2 Write unit tests for rate limiting
    - Test rate limit enforcement across different endpoints
    - Test rate limit reset after time window
    - Test different IP addresses tracked separately
    - _Requirements: 7.6_

  - [ ] 4.3 Create audit logging service
    - Create `src/lib/auditLog.ts` with `AuditLogger` class
    - Implement `logSignIn()`: logs userId, timestamp, IP address on successful signin
    - Implement `logSignInFailure()`: logs hashed email, IP, failure reason
    - Implement `logTokenUsage()`: logs userId, endpoint, timestamp for API requests
    - Store logs in database or logging service (e.g., Prisma, Winston)
    - _Requirements: 12.1, 12.2, 12.3_

  - [ ]* 4.4 Write unit tests for audit logging
    - Test successful signin logging
    - Test failed signin logging
    - Test token usage logging
    - _Requirements: 12.1, 12.2, 12.3_

  - [ ] 4.5 Integrate rate limiting into auth endpoints
    - Add rate limiting middleware to signup, signin, validate, and refresh endpoints
    - Return appropriate error messages when rate limited
    - _Requirements: 7.6, 12.5_

  - [ ] 4.6 Integrate audit logging into auth endpoints
    - Add audit logging calls to signin endpoint (success and failure)
    - Add audit logging to jobs API for token usage tracking
    - _Requirements: 12.1, 12.2, 12.3_

- [ ] 5. Checkpoint - Backend infrastructure complete
  - Ensure all API endpoints are accessible and return expected responses
  - Verify database migrations applied successfully
  - Test token generation, validation, and revocation flows with API client (Postman/curl)
  - Ask the user if questions arise

### Phase 2: Extension UI and Authentication

- [ ] 6. Create extension authentication UI
  - [ ] 6.1 Create authentication screen HTML
    - Create `extension/popup-auth.html` with sign-in/sign-up form
    - Add email and password input fields with proper types and validation attributes
    - Add "Sign In" and "Sign Up" tab switcher buttons
    - Add "Forgot Password?" link below password field
    - Add "Continue as Guest" button below authentication form
    - Add loading state container with spinner
    - Add error message container
    - _Requirements: 1.1, 1.2, 1.3, 13.6, 14.1_

  - [ ] 6.2 Create authentication screen CSS
    - Create `extension/popup-auth.css` matching web app design
    - Use primary blue (#3B82F6) and error red (#EF4444) colors
    - Style input fields with border (#E5E7EB) and focus ring (#3B82F6)
    - Style buttons with rounded corners (8px) and padding (12px 24px)
    - Create animated loading spinner (blue circle)
    - Style error messages with red background (#FEE2E2) and red text (#991B1B)
    - Ensure consistent typography with web application
    - _Requirements: 13.1, 13.5, 13.6_

  - [ ] 6.3 Create authentication JavaScript module
    - Create `extension/popup-auth.js` with authentication logic
    - Implement form validation: email format (RFC 5322), password length (≥8 chars)
    - Display validation errors matching web app messages
    - Implement tab switching between sign-in and sign-up forms
    - _Requirements: 1.4, 1.5, 1.6, 13.2, 13.3, 13.4_

- [ ] 7. Implement Chrome Storage helpers
  - [ ] 7.1 Create storage utility module
    - Create `extension/storage.js` with Chrome Storage wrapper functions
    - Implement `saveAuthState(token, user, expiresAt, isGuest)`: stores auth data in chrome.storage.local
    - Implement `loadAuthState()`: retrieves auth data from chrome.storage.local
    - Implement `clearAuthState()`: removes auth data from chrome.storage.local
    - Add TypeScript-style JSDoc comments for type safety
    - _Requirements: 5.1, 5.2, 9.6, 11.1_

  - [ ]* 7.2 Write unit tests for storage helpers
    - Test saving auth state to Chrome Storage
    - Test loading auth state from Chrome Storage
    - Test clearing auth state
    - Mock chrome.storage.local API
    - _Requirements: 5.1, 9.6, 11.1_

- [ ] 8. Implement authentication flows in extension
  - [ ] 8.1 Implement sign-up flow
    - In `extension/popup-auth.js`, create `handleSignUp(email, password)` function
    - Validate email format and password length before submission
    - Send POST request to `/api/auth/extension/signup` with credentials
    - Handle success: save token to Chrome Storage, transition to authenticated UI
    - Handle errors: display "Email already registered" or validation errors
    - Show loading state during request
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 10.3_

  - [ ] 8.2 Implement sign-in flow
    - In `extension/popup-auth.js`, create `handleSignIn(email, password)` function
    - Send POST request to `/api/auth/extension/signin` with credentials
    - Handle success: save token to Chrome Storage, transition to authenticated UI, show "Signed in as [email]"
    - Handle errors: display "Invalid email or password"
    - Show loading state during request
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 10.2_

  - [ ] 8.3 Implement guest mode flow
    - In `extension/popup-auth.js`, create `handleGuestMode()` function
    - Send POST request to `/api/auth/extension/guest`
    - Handle success: save guest token to Chrome Storage, transition to authenticated UI, show "Using Guest Mode" badge
    - Handle errors: display "Could not activate guest mode"
    - _Requirements: 4.1, 4.2, 4.3_

  - [ ] 8.4 Implement sign-out flow
    - In `extension/popup.js`, create `handleSignOut()` function
    - Send POST request to `/api/auth/extension/signout` with Authorization header
    - Clear token from Chrome Storage (even if API call fails)
    - Transition to authentication form
    - Display "Signed out successfully" confirmation message
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

  - [ ] 8.5 Implement token validation on startup
    - In `extension/popup.js`, create `validateToken(token)` function
    - Send POST request to `/api/auth/extension/validate` with Authorization header
    - Return boolean indicating validity
    - _Requirements: 5.3, 5.4, 5.5, 11.2, 11.3_

  - [ ] 8.6 Implement token refresh mechanism
    - In `extension/popup.js`, create `checkTokenExpiration()` function
    - Check if stored token expires within 3 days
    - If yes, call `refreshToken(oldToken)` to get new token
    - Update stored token in Chrome Storage
    - Run check on extension startup
    - _Requirements: 8.5, 8.6_

  - [ ] 8.7 Implement startup authentication flow
    - In `extension/popup.js`, add `DOMContentLoaded` event listener
    - Load auth state from Chrome Storage on startup
    - If token exists, validate with API
    - If valid, show authenticated UI with user email
    - If invalid/expired, clear storage and show authentication form
    - Display "Welcome back, [email]" briefly on successful validation
    - _Requirements: 5.3, 5.4, 5.5, 11.1, 11.2, 11.3, 11.4, 11.5, 11.6_

- [ ] 9. Update existing extension popup with user header
  - [ ] 9.1 Update popup.html with authentication header
    - Update `extension/popup.html` to include user info header
    - Add user email display element
    - Add "Guest Mode" badge element (hidden by default)
    - Add settings menu button (gear icon)
    - Add settings dropdown with "Sign Out" and "Switch Account" buttons
    - _Requirements: 3.6, 4.2, 9.1, 9.5_

  - [ ] 9.2 Update popup.css with header styles
    - Update `extension/popup.css` to style user header
    - Style guest mode badge with distinctive color
    - Style settings menu dropdown
    - Match web application design system
    - _Requirements: 3.6, 4.2, 9.1_

  - [ ] 9.3 Implement settings menu interactions
    - In `extension/popup.js`, add click handler for settings menu button
    - Toggle settings dropdown visibility
    - Add click handler for "Sign Out" button (calls `handleSignOut()`)
    - Add click handler for "Switch Account" button (signs out and shows auth form immediately)
    - _Requirements: 9.1, 9.5_

  - [ ] 9.4 Update job saving to include authentication token
    - In `extension/popup.js`, modify job save request to include Authorization header
    - Extract token from Chrome Storage before making request
    - Add `Authorization: Bearer ${token}` header to fetch request
    - Handle 401 errors: clear storage, show "Session expired" message, display auth form
    - Display "Saved to your dashboard" on success
    - _Requirements: 6.1, 6.4, 6.5, 6.6, 8.3, 10.4_

- [ ] 10. Implement error handling and user feedback
  - [ ] 10.1 Create error display utility functions
    - In `extension/popup-auth.js`, create `showErrorMessage(message)` function
    - In `extension/popup-auth.js`, create `showSuccessMessage(message)` function
    - In `extension/popup-auth.js`, create `showLoadingState(message)` function
    - In `extension/popup-auth.js`, create `hideLoadingState()` function
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6_

  - [ ] 10.2 Implement network error handling
    - Wrap all fetch requests in try-catch blocks
    - Display "Could not connect to StackApply API. Check your internet connection." for network errors
    - Display specific API error messages when available
    - _Requirements: 10.5_

  - [ ] 10.3 Implement forgot password integration
    - Add click handler to "Forgot Password?" link
    - Open web application password reset page in new tab
    - URL: `https://stackapply-ai.vercel.app/auth/reset-password`
    - _Requirements: 14.1, 14.2, 14.3_

- [ ] 11. Update extension manifest and permissions
  - [ ] 11.1 Update manifest.json with new files and permissions
    - Update `extension/manifest.json` to include `popup-auth.html`, `popup-auth.js`, `popup-auth.css`, `storage.js`
    - Add `storage` permission for Chrome Storage API
    - Ensure `host_permissions` includes `https://stackapply-ai.vercel.app/*`
    - _Requirements: 5.6, 11.1_

- [ ] 12. Checkpoint - Extension UI complete
  - Test sign-in, sign-up, guest mode, and sign-out flows manually
  - Verify token persistence across browser restarts
  - Verify job saving with authentication tokens
  - Ensure error messages display correctly
  - Ask the user if questions arise

### Phase 3: Integration and Testing

- [ ] 13. End-to-end integration testing
  - [ ] 13.1 Create integration test suite
    - Create test file `tests/integration/extension-auth.test.ts`
    - Set up test environment with test database and API server
    - _Requirements: All_

  - [ ]* 13.2 Write integration tests for complete user flows
    - **Property 1: User registration and signin cycle**
    - **Validates: Requirements 2.1-2.6, 3.1-3.6**
    - Test: Sign up → Sign out → Sign in with same credentials
    - Test: Guest mode → Sign out → Sign in with real account
    - Test: Token persistence across extension restarts
    - Test: Multiple concurrent sessions (different devices)
    - _Requirements: 2.1-2.6, 3.1-3.6, 4.1-4.3, 5.1-5.6, 11.1-11.6_

  - [ ]* 13.3 Write integration tests for error scenarios
    - **Property 2: Error handling consistency**
    - **Validates: Requirements 10.1-10.6**
    - Test: Network failure during signin
    - Test: Invalid credentials
    - Test: Expired token during job save
    - Test: Session revoked from dashboard
    - _Requirements: 10.1-10.6_

  - [ ]* 13.4 Write integration tests for security scenarios
    - **Property 3: Token security guarantees**
    - **Validates: Requirements 7.1-7.6, 8.1-8.6**
    - Test: Invalid token rejection
    - Test: Expired token rejection
    - Test: Rate limiting enforcement
    - Test: Brute force prevention
    - _Requirements: 7.1-7.6, 8.1-8.6, 12.5_

- [ ] 14. Manual testing checklist
  - [ ] 14.1 Perform manual testing of all user flows
    - Test sign-up with new email
    - Test sign-in with existing account
    - Test guest mode activation
    - Test sign-out and re-authentication
    - Test forgot password link
    - Test job saving with authenticated account
    - Test session persistence across browser restarts
    - Test token refresh after 27 days
    - Test session expiration after 30 days
    - Test error messages for all failure scenarios
    - Test switch account functionality
    - _Requirements: All_

- [ ] 15. Checkpoint - Testing complete
  - All integration tests passing
  - Manual testing checklist completed
  - Critical bugs fixed
  - Ask the user if questions arise

### Phase 4: Deployment and Documentation

- [ ] 16. Configure environment variables
  - [ ] 16.1 Set up production environment variables
    - Add `EXTENSION_JWT_SECRET` to production environment (Vercel)
    - Ensure `DATABASE_URL` is configured for production PostgreSQL
    - Verify `NEXTAUTH_SECRET` is set
    - Verify `NEXTAUTH_URL` points to production domain
    - Document all required environment variables in `.env.example`
    - _Requirements: 7.1, 7.2_

- [ ] 17. Database migration and deployment
  - [ ] 17.1 Apply database migration to production
    - Run `npx prisma migrate deploy` against production database
    - Verify `ExtensionSession` table created successfully
    - Verify indexes created for performance
    - _Requirements: 5.1_

  - [ ] 17.2 Seed guest/demo user in production
    - Ensure demo@stackapply.ai user exists in production database
    - If not, run seed script or manually create user
    - _Requirements: 4.1, 4.3_

- [ ] 18. Extension package and deployment
  - [ ] 18.1 Update extension version and build
    - Update `version` in `extension/manifest.json` (e.g., "2.0.0")
    - Update API_URL in extension code to production URL
    - Create production build: zip all extension files
    - Test extension in Chrome with production API
    - _Requirements: All_

  - [ ] 18.2 Update Chrome Web Store listing
    - Upload new extension version to Chrome Web Store
    - Update extension description to mention authentication
    - Update screenshots to show new authentication UI
    - Submit for review
    - _Requirements: All_

  - [ ] 18.3 Update extension download on website
    - Replace `public/stackapply-extension.zip` with new version
    - Update download button to reference new version
    - _Requirements: All_

- [ ] 19. Documentation and user communication
  - [ ] 19.1 Create user documentation
    - Write extension authentication guide in `docs/extension-auth.md`
    - Document sign-up, sign-in, guest mode flows
    - Document forgot password process
    - Document sign-out and switch account
    - Add troubleshooting section for common issues
    - _Requirements: All_

  - [ ] 19.2 Update README.md
    - Add authentication section to README
    - Document new API endpoints
    - Document environment variables
    - Update setup instructions for new developers
    - _Requirements: All_

  - [ ] 19.3 Create migration guide for existing users
    - Write guide for users upgrading from demo-only extension
    - Explain how to create an account
    - Explain guest mode as alternative
    - Communicate timeline for deprecating demo-only mode
    - _Requirements: All_

- [ ] 20. Final checkpoint - Deployment complete
  - Backend deployed with all endpoints live
  - Database migration applied
  - Extension updated in Chrome Web Store
  - Documentation complete
  - User communication sent
  - Ask the user if questions arise

## Notes

- Tasks marked with `*` are optional testing tasks and can be skipped for faster MVP delivery
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation and user feedback opportunities
- Phase 1 (Database and Backend) must complete before Phase 2 (Extension UI) due to API dependencies
- Phase 3 (Integration and Testing) validates the complete system before production deployment
- Phase 4 (Deployment) includes production configuration, migration, and user communication
- Property-based tests validate universal correctness properties defined in the design document
- Unit tests validate specific examples and edge cases for critical components
- The implementation uses TypeScript for backend APIs and JavaScript for browser extension code
- All API endpoints follow RESTful conventions and return consistent JSON responses
- Extension uses Chrome Storage API for secure token persistence
- JWT tokens use HS256 algorithm with 30-day expiration
- Rate limiting prevents brute force attacks on authentication endpoints
- Audit logging tracks all authentication events for security monitoring

## Task Dependency Graph

```json
{
  "waves": [
    {
      "id": 0,
      "tasks": ["1.1"]
    },
    {
      "id": 1,
      "tasks": ["1.2", "1.3"]
    },
    {
      "id": 2,
      "tasks": ["1.4", "2.1", "2.3", "2.5", "2.7", "2.9", "2.11"]
    },
    {
      "id": 3,
      "tasks": ["2.2", "2.4", "2.6", "2.8", "2.10", "2.12", "3.1"]
    },
    {
      "id": 4,
      "tasks": ["3.2", "4.1", "4.3"]
    },
    {
      "id": 5,
      "tasks": ["4.2", "4.4", "4.5", "4.6"]
    },
    {
      "id": 6,
      "tasks": ["6.1", "6.2"]
    },
    {
      "id": 7,
      "tasks": ["6.3", "7.1"]
    },
    {
      "id": 8,
      "tasks": ["7.2", "8.1", "8.2", "8.3", "8.4", "8.5", "8.6"]
    },
    {
      "id": 9,
      "tasks": ["8.7", "9.1", "9.2"]
    },
    {
      "id": 10,
      "tasks": ["9.3", "9.4", "10.1", "10.2"]
    },
    {
      "id": 11,
      "tasks": ["10.3", "11.1"]
    },
    {
      "id": 12,
      "tasks": ["13.1"]
    },
    {
      "id": 13,
      "tasks": ["13.2", "13.3", "13.4", "14.1"]
    },
    {
      "id": 14,
      "tasks": ["16.1"]
    },
    {
      "id": 15,
      "tasks": ["17.1", "17.2"]
    },
    {
      "id": 16,
      "tasks": ["18.1"]
    },
    {
      "id": 17,
      "tasks": ["18.2", "18.3", "19.1", "19.2", "19.3"]
    }
  ]
}
```
