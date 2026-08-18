# Requirements Document

## Introduction

The StackApply.ai browser extension currently saves all scraped jobs to a shared demo user account (demo@stackapply.ai). This creates a critical privacy and security issue where all users' job data is mixed together in a single account. This feature implements proper user authentication for the browser extension, allowing each user to sign in directly within the extension using their email and password, just like the web application's sign-in/sign-up flow.

The authentication system will use direct sign-in with JWT/session token-based authentication, following the same pattern as popular browser extensions (1Password, Grammarly, Notion). Users will sign in or sign up directly in the extension popup, and their session will persist across browser restarts. A "Continue as Guest" option will be available for testing purposes, linking to the guest dashboard account.

## Glossary

- **Extension**: The StackApply.ai Chrome browser extension (Manifest V3)
- **Dashboard**: The StackApply.ai web application (Next.js 16.3, NextAuth.js)
- **Session_Token**: A JWT or session identifier issued upon successful authentication
- **API_Endpoint**: The `/api/jobs` POST endpoint that receives scraped job data
- **Guest_User**: The demo/guest account used when "Continue as Guest" is selected
- **Chrome_Storage**: The browser extension's secure storage API for persisting session tokens
- **User_Account**: An authenticated user record in the PostgreSQL database with email and password
- **Auth_Endpoint**: The API endpoints for sign-in, sign-up, and token validation

## Requirements

### Requirement 1: Extension Sign-In UI

**User Story:** As a user, I want to sign in directly within the extension using my email and password, so that I can authenticate without leaving the extension context.

#### Acceptance Criteria

1. WHEN a user opens the extension for the first time, THE Extension SHALL display a sign-in/sign-up form with email and password input fields
2. THE Extension SHALL provide "Sign In" and "Sign Up" buttons following the same UI design as the web application
3. THE Extension SHALL display a "Continue as Guest" button below the authentication form
4. THE Extension SHALL validate email format before allowing form submission
5. THE Extension SHALL validate password requirements (minimum 8 characters) before allowing form submission
6. WHEN validation fails, THE Extension SHALL display the same error messages as the web application
7. THE Extension SHALL show loading states during authentication requests

### Requirement 2: Extension Sign-Up Flow

**User Story:** As a new user, I want to create an account directly from the extension, so that I can start using authenticated features immediately.

#### Acceptance Criteria

1. WHEN a user clicks "Sign Up", THE Extension SHALL send a registration request to the Auth_Endpoint with email and password
2. WHEN registration succeeds, THE Auth_Endpoint SHALL return a Session_Token and user information
3. WHEN registration succeeds, THE Extension SHALL store the Session_Token in Chrome_Storage and transition to the authenticated state
4. WHEN registration fails due to existing email, THE Extension SHALL display "Email already registered. Please sign in."
5. WHEN registration fails due to invalid input, THE Extension SHALL display the specific validation error from the API
6. THE Extension SHALL apply the same password strength requirements as the web application

### Requirement 3: Extension Sign-In Flow

**User Story:** As a returning user, I want to sign in to the extension with my existing credentials, so that my scraped jobs save to my personal account.

#### Acceptance Criteria

1. WHEN a user clicks "Sign In", THE Extension SHALL send an authentication request to the Auth_Endpoint with email and password
2. WHEN authentication succeeds, THE Auth_Endpoint SHALL return a Session_Token and user information
3. WHEN authentication succeeds, THE Extension SHALL store the Session_Token in Chrome_Storage and transition to the authenticated state
4. WHEN authentication fails, THE Extension SHALL display "Invalid email or password"
5. THE Extension SHALL include the Session_Token in all subsequent API requests using the `Authorization: Bearer <token>` header format
6. WHEN sign-in succeeds, THE Extension SHALL display "Signed in as [user email]" in the popup header

### Requirement 4: Guest Mode

**User Story:** As a user testing the extension, I want to use "Continue as Guest" mode, so that I can try the extension without creating an account.

#### Acceptance Criteria

1. WHEN a user clicks "Continue as Guest", THE Extension SHALL authenticate with the Guest_User account
2. WHEN in guest mode, THE Extension SHALL display a clear indicator "Using Guest Mode" in the popup header
3. WHEN in guest mode, THE Extension SHALL save all scraped jobs to the shared guest/demo account

### Requirement 5: Session Token Management

**User Story:** As a user, I want my session to persist across browser restarts, so that I don't need to sign in every time I use the extension.

#### Acceptance Criteria

1. WHEN a user successfully authenticates, THE Extension SHALL store the Session_Token securely in Chrome_Storage
2. WHEN the extension starts, THE Extension SHALL check Chrome_Storage for an existing Session_Token
3. WHEN a valid Session_Token exists, THE Extension SHALL validate it against the Auth_Endpoint
4. WHEN token validation succeeds, THE Extension SHALL transition to authenticated state without requiring sign-in
5. WHEN token validation fails, THE Extension SHALL clear the stored token and display the sign-in form
6. THE Extension SHALL store the Session_Token using Chrome Storage's encryption capabilities

### Requirement 6: Authenticated Job Saving

**User Story:** As a user with an active session, I want my scraped jobs to save automatically to my personal account, so that my job data remains private and separate from other users.

#### Acceptance Criteria

1. WHEN the extension sends a job save request with a valid Session_Token, THE API_Endpoint SHALL authenticate the request and associate the job with the corresponding user account
2. WHEN the extension sends a job save request in guest mode, THE API_Endpoint SHALL save the job to the Guest_User account
3. WHEN the extension sends a job save request with an invalid or expired Session_Token, THE API_Endpoint SHALL return a 401 Unauthorized error
4. THE API_Endpoint SHALL include the Session_Token in request headers using the `Authorization: Bearer <token>` format
5. WHEN a job is successfully saved with authentication, THE Extension SHALL display "Saved to your dashboard"
6. WHEN authentication fails, THE Extension SHALL prompt the user to sign in again

### Requirement 7: Token Security

**User Story:** As a platform administrator, I want session tokens to be handled securely throughout the system, so that user accounts cannot be compromised through token theft or misuse.

#### Acceptance Criteria

1. THE Auth_Endpoint SHALL generate session tokens using cryptographically secure random number generation with at least 128 bits of entropy
2. THE Auth_Endpoint SHALL sign tokens using a secure secret key (JWT) or use secure session storage
3. THE API_Endpoint SHALL validate token signatures and expiration times on every authenticated request
4. THE Extension SHALL store Session_Token values in Chrome_Storage with appropriate encryption flags
5. THE Session_Token SHALL be transmitted only over HTTPS connections
6. THE Auth_Endpoint SHALL implement rate limiting on sign-in attempts to prevent brute force attacks

### Requirement 8: Token Expiration and Refresh

**User Story:** As a user, I want my session to remain active for a reasonable period, so that I don't need to sign in frequently while maintaining security.

#### Acceptance Criteria

1. THE Auth_Endpoint SHALL issue session tokens with a 30-day expiration period
2. WHEN a Session_Token expires, THE API_Endpoint SHALL return a 401 error with message "Session expired"
3. WHEN the extension receives a session expired error, THE Extension SHALL clear the stored token and display the sign-in form
4. THE Extension SHALL display "Your session has expired. Please sign in again." when prompting re-authentication
5. THE Auth_Endpoint SHALL support token refresh functionality to extend sessions without re-entering credentials
6. WHEN a Session_Token will expire within 3 days, THE Extension SHALL automatically attempt to refresh the token

### Requirement 9: Sign-Out Functionality

**User Story:** As a user, I want to sign out of the extension, so that I can switch accounts or protect my data on shared computers.

#### Acceptance Criteria

1. WHEN a user is authenticated, THE Extension SHALL display a "Sign Out" button in the settings menu
2. WHEN a user clicks "Sign Out", THE Extension SHALL clear the Session_Token from Chrome_Storage
3. WHEN sign-out completes, THE Extension SHALL display the sign-in form
4. WHEN sign-out completes, THE Extension SHALL display a confirmation message "Signed out successfully"
5. THE Extension SHALL provide a "Switch Account" option that signs out and immediately shows the sign-in form
6. WHEN a user signs out, THE Extension SHALL clear all cached user data from Chrome_Storage

### Requirement 10: Error Handling and User Feedback

**User Story:** As a user, I want clear error messages when authentication fails, so that I can quickly resolve issues.

#### Acceptance Criteria

1. WHEN an API request fails due to authentication, THE Extension SHALL display the exact error message returned by the Auth_Endpoint
2. WHEN sign-in fails due to invalid credentials, THE Extension SHALL display "Invalid email or password"
3. WHEN sign-up fails due to existing email, THE Extension SHALL display "Email already registered. Please sign in."
4. WHEN session expires, THE Extension SHALL display "Your session has expired. Please sign in again."
5. WHEN network errors occur during authentication, THE Extension SHALL display "Could not connect to StackApply API. Check your internet connection."
6. THE Extension SHALL provide clear visual feedback during loading states with a spinner and "Signing in..." message

### Requirement 11: Authentication State Persistence

**User Story:** As a user, I want the extension to remember my authentication state across browser sessions, so that I don't need to sign in every time I restart my browser.

#### Acceptance Criteria

1. WHEN the extension initializes, THE Extension SHALL check Chrome_Storage for an existing Session_Token
2. WHEN a Session_Token is found, THE Extension SHALL validate it with the Auth_Endpoint before transitioning to authenticated state
3. WHEN token validation succeeds, THE Extension SHALL load the user's profile information and display the authenticated UI
4. WHEN token validation fails, THE Extension SHALL clear the invalid token and display the sign-in form
5. THE Extension SHALL display a loading state while validating stored tokens on startup
6. WHEN validation completes successfully, THE Extension SHALL display "Welcome back, [user email]" briefly

### Requirement 12: Audit Logging

**User Story:** As a platform administrator, I want to track authentication events and session usage, so that I can detect suspicious activity and support users with authentication issues.

#### Acceptance Criteria

1. WHEN a user signs in successfully, THE Auth_Endpoint SHALL log the user ID, timestamp, and IP address
2. WHEN an authentication attempt fails, THE Auth_Endpoint SHALL log the attempted email (hashed), IP address, and failure reason
3. WHEN a Session_Token is used for API requests, THE API_Endpoint SHALL log the user ID, endpoint accessed, and timestamp
4. THE Dashboard SHALL display recent authentication activity to the user (last 10 sign-in events with timestamps and IP addresses)
5. WHEN multiple failed authentication attempts occur from the same IP, THE Auth_Endpoint SHALL rate limit requests to prevent brute force attacks
6. THE Dashboard SHALL display active sessions and allow users to revoke specific sessions

### Requirement 13: Extension Authentication UI Design Consistency

**User Story:** As a user familiar with the web application, I want the extension's authentication UI to match the web app's design, so that I have a consistent experience across platforms.

#### Acceptance Criteria

1. THE Extension SHALL use the same color scheme, fonts, and button styles as the Dashboard sign-in page
2. THE Extension SHALL apply the same email validation rules as the Dashboard (valid email format required)
3. THE Extension SHALL apply the same password validation rules as the Dashboard (minimum 8 characters)
4. THE Extension SHALL display the same error messages as the Dashboard for validation failures
5. THE Extension SHALL use the same loading spinner design as the Dashboard during authentication
6. THE Extension SHALL follow the same form layout as the Dashboard (email field above password field, submit button below)

### Requirement 14: Password Reset Integration

**User Story:** As a user who forgot my password, I want to reset it from within the extension, so that I can regain access without navigating to the web application.

#### Acceptance Criteria

1. WHEN a user is on the sign-in form, THE Extension SHALL display a "Forgot Password?" link below the password field
2. WHEN the user clicks "Forgot Password?", THE Extension SHALL open the Dashboard password reset page in a new browser tab
3. THE Dashboard password reset page SHALL follow the existing password reset flow (send email with reset link)
4. WHEN a user successfully resets their password via the web flow, THE Extension SHALL allow them to sign in with the new password
5. THE Extension SHALL display a message "Password reset link sent to [email]" if the reset is initiated from the extension
