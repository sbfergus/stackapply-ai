# Design Document: Browser Extension User Authentication

## Overview

This design document specifies the technical implementation for direct user authentication in the StackApply.ai browser extension. The solution enables users to sign in/sign up directly within the extension popup using email and password credentials, replacing the current demo user approach with proper per-user authentication.

### Key Design Goals

1. **Direct Authentication**: Users authenticate within the extension popup without redirecting to external pages
2. **Session Persistence**: Authentication state persists across browser restarts using Chrome Storage
3. **Security**: JWT-based tokens with cryptographic signing, HTTPS-only transmission, and secure storage
4. **Seamless Integration**: Extension tokens work with existing NextAuth.js infrastructure
5. **Guest Mode Support**: Maintain "Continue as Guest" functionality for testing and onboarding
6. **Consistent UX**: Match web application authentication UI/UX patterns

### Authentication Flow Summary

```mermaid
sequenceDiagram
    participant User
    participant Extension
    participant ChromeStorage
    participant API
    participant Database

    User->>Extension: Open extension
    Extension->>ChromeStorage: Check for stored token
    alt Token exists
        Extension->>API: Validate token
        alt Token valid
            API-->>Extension: User data
            Extension-->>User: Show authenticated UI
        else Token invalid/expired
            Extension->>ChromeStorage: Clear token
            Extension-->>User: Show sign-in form
        end
    else No token
        Extension-->>User: Show sign-in form
    end

    User->>Extension: Enter email/password
    Extension->>API: POST /api/auth/extension/signin
    API->>Database: Verify credentials
    Database-->>API: User record
    API-->>Extension: JWT token + user data
    Extension->>ChromeStorage: Store token
    Extension-->>User: Show authenticated UI
```

---

## Architecture

### System Components

```mermaid
graph TB
    subgraph "Browser Extension"
        A[Popup UI] -->|User Actions| B[Auth Manager]
        B -->|Store/Retrieve| C[Chrome Storage]
        B -->|HTTP Requests| D[API Client]
    end
    
    subgraph "Next.js Backend"
        D -->|POST /api/auth/extension/*| E[Extension Auth Routes]
        D -->|POST /api/jobs| F[Jobs API]
        E -->|Generate/Validate| G[JWT Service]
        F -->|Validate Token| G
        E -->|Query/Create| H[Prisma Client]
        F -->|Create Jobs| H
    end
    
    subgraph "Database"
        H -->|Read/Write| I[PostgreSQL]
        I --> J[User Table]
        I --> K[ExtensionSession Table]
        I --> L[Job Table]
    end

```

### Technology Stack

- **Frontend (Extension)**: Vanilla JavaScript, Chrome Extension Manifest V3 APIs
- **Backend**: Next.js 16.3 App Router, NextAuth.js 4.24.15
- **Database**: PostgreSQL via Prisma ORM 7.9.1
- **Authentication**: JWT (JSON Web Tokens) via `jsonwebtoken` library
- **Password Hashing**: bcryptjs 3.0.3 (already in use)
- **Token Storage**: Chrome Storage API with sync capability

---

## Components and Interfaces

### 1. Database Schema Changes

#### New Table: `ExtensionSession`

```prisma
model ExtensionSession {
  id                String    @id @default(uuid())
  userId            String
  user              User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  token             String    @unique // JWT token identifier (jti claim)
  expiresAt         DateTime
  lastUsedAt        DateTime  @default(now())
  ipAddress         String?
  userAgent         String?
  createdAt         DateTime  @default(now())

  @@index([userId, expiresAt])
  @@index([token])
}
```

#### Updated `User` Model

```prisma
model User {
  // ... existing fields ...
  extensionSessions ExtensionSession[]
}
```


**Rationale**: The `ExtensionSession` table tracks active extension sessions separately from NextAuth sessions, enabling:
- Session revocation from the dashboard
- Audit logging of extension activity
- Multiple concurrent sessions across devices
- Token lifecycle management

---

### 2. JWT Structure and Claims

```typescript
interface ExtensionJWT {
  // Standard JWT claims
  iss: string;           // Issuer: "stackapply-extension"
  sub: string;           // Subject: user.id (UUID)
  jti: string;           // JWT ID: unique token identifier (UUID)
  iat: number;           // Issued At: Unix timestamp
  exp: number;           // Expiration: Unix timestamp (30 days from iat)
  
  // Custom claims
  email: string;         // User's email address
  type: "extension";     // Token type identifier
}
```

**Token Properties**:
- **Algorithm**: HS256 (HMAC with SHA-256)
- **Secret**: `process.env.EXTENSION_JWT_SECRET` (separate from NEXTAUTH_SECRET)
- **Expiration**: 30 days from issuance
- **Size**: ~200-250 bytes when encoded


---

### 3. API Endpoints

#### 3.1 POST `/api/auth/extension/signup`

**Purpose**: Register a new user account from the extension

**Request**:
```typescript
interface SignupRequest {
  email: string;       // Valid email format
  password: string;    // Minimum 8 characters
}
```

**Response** (Success - 201):
```typescript
interface SignupResponse {
  success: true;
  token: string;       // JWT token
  user: {
    id: string;
    email: string;
    fullName: string | null;
  };
}
```

**Response** (Error - 400):
```typescript
interface SignupError {
  error: string;       // "Email already registered" | "Invalid email format" | "Password too short"
}
```

**Implementation Logic**:
1. Validate email format (RFC 5322 compliant)
2. Validate password length (≥ 8 characters)
3. Check if email already exists in database
4. Hash password using bcryptjs (salt rounds: 10)
5. Create user record in database
6. Generate JWT token with 30-day expiration
7. Create ExtensionSession record
8. Return token and user data


**Rate Limiting**: 5 signup attempts per IP address per hour

---

#### 3.2 POST `/api/auth/extension/signin`

**Purpose**: Authenticate existing user from the extension

**Request**:
```typescript
interface SigninRequest {
  email: string;
  password: string;
}
```

**Response** (Success - 200):
```typescript
interface SigninResponse {
  success: true;
  token: string;       // JWT token
  user: {
    id: string;
    email: string;
    fullName: string | null;
  };
}
```

**Response** (Error - 401):
```typescript
interface SigninError {
  error: string;       // "Invalid email or password"
}
```

**Implementation Logic**:
1. Find user by email
2. Verify password using bcryptjs.compare()
3. Generate JWT token with 30-day expiration
4. Create ExtensionSession record (or update if exists)
5. Return token and user data

**Rate Limiting**: 10 failed attempts per IP address per hour, then 1-hour lockout


---

#### 3.3 POST `/api/auth/extension/validate`

**Purpose**: Validate an existing token on extension startup

**Request**:
```typescript
// Authorization header: Bearer <token>
// No request body
```

**Response** (Success - 200):
```typescript
interface ValidateResponse {
  success: true;
  user: {
    id: string;
    email: string;
    fullName: string | null;
  };
  expiresAt: string;   // ISO 8601 timestamp
}
```

**Response** (Error - 401):
```typescript
interface ValidateError {
  error: string;       // "Invalid token" | "Token expired" | "Session revoked"
}
```

**Implementation Logic**:
1. Extract token from Authorization header
2. Verify JWT signature and expiration
3. Check ExtensionSession exists and is not expired
4. Update `lastUsedAt` timestamp
5. Return user data and expiration info

**Rate Limiting**: 100 requests per token per minute


---

#### 3.4 POST `/api/auth/extension/refresh`

**Purpose**: Refresh token before expiration to extend session

**Request**:
```typescript
// Authorization header: Bearer <token>
// No request body
```

**Response** (Success - 200):
```typescript
interface RefreshResponse {
  success: true;
  token: string;       // New JWT token
  expiresAt: string;   // ISO 8601 timestamp
}
```

**Response** (Error - 401):
```typescript
interface RefreshError {
  error: string;       // "Invalid token" | "Token expired" | "Refresh not allowed"
}
```

**Implementation Logic**:
1. Validate existing token
2. Check token expires within 3 days
3. Generate new JWT with fresh 30-day expiration
4. Update ExtensionSession with new token and expiration
5. Return new token

**Constraints**: Can only refresh tokens that expire within 3 days


---

#### 3.5 POST `/api/auth/extension/signout`

**Purpose**: Revoke extension session and invalidate token

**Request**:
```typescript
// Authorization header: Bearer <token>
// No request body
```

**Response** (Success - 200):
```typescript
interface SignoutResponse {
  success: true;
  message: string;     // "Signed out successfully"
}
```

**Implementation Logic**:
1. Extract and validate token
2. Delete ExtensionSession record from database
3. Return success confirmation

---

#### 3.6 POST `/api/auth/extension/guest`

**Purpose**: Authenticate as guest user for testing

**Request**:
```typescript
// No request body
```

**Response** (Success - 200):
```typescript
interface GuestResponse {
  success: true;
  token: string;       // Special guest token
  user: {
    id: string;
    email: "demo@stackapply.ai";
    fullName: "Demo User";
  };
}
```

**Implementation Logic**:
1. Find or create demo user (email: demo@stackapply.ai)
2. Generate JWT token with "guest" type claim
3. Create ExtensionSession record
4. Return token and guest user data


---

### 4. Token Generation and Validation Service

Create a new service module: `src/lib/extensionAuth.ts`

```typescript
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';
import { v4 as uuidv4 } from 'uuid';

interface TokenPayload {
  userId: string;
  email: string;
}

interface ExtensionJWT {
  iss: string;
  sub: string;
  jti: string;
  iat: number;
  exp: number;
  email: string;
  type: "extension" | "guest";
}

const JWT_SECRET = process.env.EXTENSION_JWT_SECRET!;
const TOKEN_EXPIRY_DAYS = 30;

export class ExtensionAuthService {
  /**
   * Generate a new JWT token and create session record
   */
  static async generateToken(
    payload: TokenPayload,
    type: "extension" | "guest" = "extension",
    ipAddress?: string,
    userAgent?: string
  ): Promise<string> {
    const jti = uuidv4();
    const now = Math.floor(Date.now() / 1000);
    const exp = now + (TOKEN_EXPIRY_DAYS * 24 * 60 * 60);

    const tokenData: ExtensionJWT = {
      iss: "stackapply-extension",
      sub: payload.userId,
      jti,
      iat: now,
      exp,
      email: payload.email,
      type,
    };

    const token = jwt.sign(tokenData, JWT_SECRET);


    // Store session in database
    await prisma.extensionSession.create({
      data: {
        userId: payload.userId,
        token: jti,
        expiresAt: new Date(exp * 1000),
        ipAddress,
        userAgent,
      },
    });

    return token;
  }

  /**
   * Validate token and return decoded payload
   */
  static async validateToken(token: string): Promise<ExtensionJWT | null> {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as ExtensionJWT;

      // Check session exists and not expired
      const session = await prisma.extensionSession.findUnique({
        where: { token: decoded.jti },
      });

      if (!session || session.expiresAt < new Date()) {
        return null;
      }

      // Update last used timestamp
      await prisma.extensionSession.update({
        where: { token: decoded.jti },
        data: { lastUsedAt: new Date() },
      });

      return decoded;
    } catch (error) {
      return null;
    }
  }

  /**
   * Revoke token and delete session
   */
  static async revokeToken(token: string): Promise<boolean> {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as ExtensionJWT;
      
      await prisma.extensionSession.delete({
        where: { token: decoded.jti },
      });
      
      return true;
    } catch (error) {
      return false;
    }
  }
}
```


---

### 5. Extension UI Components

#### 5.1 Authentication Screen (`popup-auth.html`)

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>StackApply AI - Sign In</title>
  <link rel="stylesheet" href="popup-auth.css">
</head>
<body>
  <div class="auth-container">
    <div class="logo">
      <img src="icon48.png" alt="StackApply">
      <h1>StackApply AI</h1>
    </div>

    <div id="auth-form">
      <div class="tab-switcher">
        <button id="signin-tab" class="tab active">Sign In</button>
        <button id="signup-tab" class="tab">Sign Up</button>
      </div>

      <form id="signin-form" class="auth-form">
        <input type="email" id="signin-email" placeholder="Email" required>
        <input type="password" id="signin-password" placeholder="Password" required>
        <a href="#" id="forgot-password">Forgot password?</a>
        <button type="submit" id="signin-btn">Sign In</button>
      </form>

      <form id="signup-form" class="auth-form hidden">
        <input type="email" id="signup-email" placeholder="Email" required>
        <input type="password" id="signup-password" placeholder="Password (min 8 characters)" required>
        <button type="submit" id="signup-btn">Sign Up</button>
      </form>

      <div class="divider">
        <span>or</span>
      </div>

      <button id="guest-btn" class="guest-button">Continue as Guest</button>
    </div>

    <div id="loading-state" class="hidden">
      <div class="spinner"></div>
      <p id="loading-message">Signing in...</p>
    </div>

    <div id="error-message" class="error hidden"></div>
  </div>
  
  <script src="popup-auth.js"></script>
</body>
</html>
```


---

#### 5.2 Authenticated Screen (`popup.html` - Updated)

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>StackApply AI</title>
  <link rel="stylesheet" href="popup.css">
</head>
<body>
  <div class="popup-container">
    <!-- Header with user info -->
    <div class="header">
      <div class="user-info">
        <span id="user-email">user@example.com</span>
        <span id="guest-badge" class="badge hidden">Guest Mode</span>
      </div>
      <button id="menu-btn" class="icon-btn">⚙️</button>
    </div>

    <!-- Settings menu (hidden by default) -->
    <div id="settings-menu" class="settings-menu hidden">
      <button id="signout-btn">Sign Out</button>
      <button id="switch-account-btn">Switch Account</button>
    </div>

    <!-- Job form (existing content) -->
    <div class="form-container">
      <!-- ... existing job save form ... -->
    </div>

    <div id="status" class="status"></div>
  </div>
  
  <script src="popup.js"></script>
</body>
</html>
```


---

#### 5.3 CSS Design (Match Web Application)

Key design principles:
- Match color scheme: Primary blue (#3B82F6), Error red (#EF4444)
- Font: System font stack (same as web app)
- Button styles: Rounded corners (8px), padding (12px 24px)
- Input fields: Border (#E5E7EB), focus ring (#3B82F6)
- Loading spinner: Animated blue circle
- Error messages: Red background (#FEE2E2), red text (#991B1B)

---

### 6. Chrome Storage Implementation

#### Storage Structure

```typescript
interface ExtensionStorage {
  auth: {
    token: string | null;
    user: {
      id: string;
      email: string;
      fullName: string | null;
    } | null;
    expiresAt: string | null;  // ISO 8601 timestamp
    isGuest: boolean;
  };
}
```

#### Storage Operations

**Save Authentication State**:
```javascript
async function saveAuthState(token, user, expiresAt, isGuest = false) {
  await chrome.storage.local.set({
    auth: {
      token,
      user,
      expiresAt,
      isGuest
    }
  });
}
```


**Load Authentication State**:
```javascript
async function loadAuthState() {
  const result = await chrome.storage.local.get('auth');
  return result.auth || null;
}
```

**Clear Authentication State**:
```javascript
async function clearAuthState() {
  await chrome.storage.local.remove('auth');
}
```

**Storage Security**:
- Use `chrome.storage.local` (encrypted at rest by Chrome)
- Never log token values to console
- Clear storage immediately on sign-out
- Validate token on every extension startup

---

### 7. Extension Authentication Flow Implementation

#### 7.1 Startup Flow (`popup.js` initialization)

```javascript
// popup.js - Initialization
document.addEventListener('DOMContentLoaded', async () => {
  const authState = await loadAuthState();
  
  if (authState && authState.token) {
    // Validate stored token
    const isValid = await validateToken(authState.token);
    
    if (isValid) {
      // Show authenticated UI
      showAuthenticatedUI(authState.user, authState.isGuest);
    } else {
      // Token invalid/expired - show auth form
      await clearAuthState();
      showAuthForm();
    }
  } else {
    // No stored token - show auth form
    showAuthForm();
  }
});
```


---

#### 7.2 Sign-In Flow

```javascript
async function handleSignIn(email, password) {
  try {
    showLoadingState('Signing in...');
    
    const response = await fetch('https://stackapply-ai.vercel.app/api/auth/extension/signin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    
    const data = await response.json();
    
    if (response.ok && data.success) {
      // Save auth state
      await saveAuthState(data.token, data.user, calculateExpiresAt(30), false);
      
      // Show authenticated UI
      showAuthenticatedUI(data.user, false);
      showSuccessMessage('Signed in successfully!');
    } else {
      showErrorMessage(data.error || 'Sign in failed');
    }
  } catch (error) {
    showErrorMessage('Could not connect to StackApply API. Check your internet connection.');
  } finally {
    hideLoadingState();
  }
}
```

---

#### 7.3 Sign-Up Flow

```javascript
async function handleSignUp(email, password) {
  // Validate email format
  if (!isValidEmail(email)) {
    showErrorMessage('Invalid email format');
    return;
  }
  
  // Validate password length
  if (password.length < 8) {
    showErrorMessage('Password must be at least 8 characters');
    return;
  }
  
  try {
    showLoadingState('Creating account...');
    
    const response = await fetch('https://stackapply-ai.vercel.app/api/auth/extension/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    
    const data = await response.json();
    
    if (response.ok && data.success) {
      await saveAuthState(data.token, data.user, calculateExpiresAt(30), false);
      showAuthenticatedUI(data.user, false);
      showSuccessMessage('Account created successfully!');
    } else {
      showErrorMessage(data.error || 'Sign up failed');
    }
  } catch (error) {
    showErrorMessage('Could not connect to StackApply API.');
  } finally {
    hideLoadingState();
  }
}
```


---

#### 7.4 Guest Mode Flow

```javascript
async function handleGuestMode() {
  try {
    showLoadingState('Entering guest mode...');
    
    const response = await fetch('https://stackapply-ai.vercel.app/api/auth/extension/guest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    
    const data = await response.json();
    
    if (response.ok && data.success) {
      await saveAuthState(data.token, data.user, calculateExpiresAt(30), true);
      showAuthenticatedUI(data.user, true);
      showSuccessMessage('Using guest mode');
    } else {
      showErrorMessage('Could not activate guest mode');
    }
  } catch (error) {
    showErrorMessage('Could not connect to StackApply API.');
  } finally {
    hideLoadingState();
  }
}
```

---

#### 7.5 Sign-Out Flow

```javascript
async function handleSignOut() {
  try {
    const authState = await loadAuthState();
    
    if (authState && authState.token) {
      // Call sign-out endpoint
      await fetch('https://stackapply-ai.vercel.app/api/auth/extension/signout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authState.token}`
        }
      });
    }
    
    // Clear local storage
    await clearAuthState();
    
    // Show auth form
    showAuthForm();
    showSuccessMessage('Signed out successfully');
  } catch (error) {
    console.error('Sign out error:', error);
    // Clear local state even if API call fails
    await clearAuthState();
    showAuthForm();
  }
}
```


---

#### 7.6 Token Validation

```javascript
async function validateToken(token) {
  try {
    const response = await fetch('https://stackapply-ai.vercel.app/api/auth/extension/validate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      return data.success === true;
    }
    
    return false;
  } catch (error) {
    console.error('Token validation error:', error);
    return false;
  }
}
```

---

#### 7.7 Token Refresh (Background)

```javascript
// Check token expiration on extension startup and periodically
async function checkTokenExpiration() {
  const authState = await loadAuthState();
  
  if (!authState || !authState.token || !authState.expiresAt) {
    return;
  }
  
  const expiresAt = new Date(authState.expiresAt);
  const now = new Date();
  const daysUntilExpiry = (expiresAt - now) / (1000 * 60 * 60 * 24);
  
  // Refresh if expires within 3 days
  if (daysUntilExpiry <= 3 && daysUntilExpiry > 0) {
    await refreshToken(authState.token);
  }
}

async function refreshToken(oldToken) {
  try {
    const response = await fetch('https://stackapply-ai.vercel.app/api/auth/extension/refresh', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${oldToken}`
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      const authState = await loadAuthState();
      
      // Update stored token
      await saveAuthState(
        data.token,
        authState.user,
        data.expiresAt,
        authState.isGuest
      );
    }
  } catch (error) {
    console.error('Token refresh error:', error);
  }
}
```


---

### 8. API Request Authentication

#### Update `/api/jobs` Route

**Current Implementation**: Uses NextAuth session or demo user fallback

**New Implementation**: Support both NextAuth sessions AND extension tokens

```typescript
// src/app/api/jobs/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ExtensionAuthService } from "@/lib/extensionAuth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    let userId: string | null = null;
    
    // 1. Try NextAuth session (web application)
    const session = await getServerSession(authOptions);
    if (session?.user?.id) {
      userId = session.user.id;
    }
    
    // 2. Try extension token (Authorization header)
    if (!userId) {
      const authHeader = req.headers.get('Authorization');
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        const decoded = await ExtensionAuthService.validateToken(token);
        
        if (decoded) {
          userId = decoded.sub;
        }
      }
    }
    
    // 3. No authentication - return 401
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized. Please sign in." },
        { status: 401, headers: corsHeaders() }
      );
    }
    
    // Continue with job creation...
    const body = await req.json();
    // ... existing job creation logic ...
    
  } catch (error) {
    // ... existing error handling ...
  }
}
```


**Authorization Header Format**: `Authorization: Bearer <jwt_token>`

**Error Responses**:
- **401 Unauthorized**: Invalid or missing token → Extension shows sign-in form
- **403 Forbidden**: Valid token but insufficient permissions (future use)
- **500 Internal Server Error**: Server-side errors

---

### 9. Security Considerations

#### 9.1 HTTPS-Only Enforcement

**Implementation**:
- All API endpoints reject HTTP requests (Next.js production default)
- Extension manifest enforces HTTPS: `"host_permissions": ["https://*.stackapply.ai/*"]`
- Development environment uses ngrok or localhost with self-signed cert

**Error Handling**:
```javascript
// Extension checks protocol before making requests
if (!API_URL.startsWith('https://') && process.env.NODE_ENV === 'production') {
  throw new Error('HTTPS required in production');
}
```

---

#### 9.2 CORS Configuration

**API Configuration** (`next.config.js`):
```javascript
module.exports = {
  async headers() {
    return [
      {
        source: '/api/auth/extension/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: 'chrome-extension://*' },
          { key: 'Access-Control-Allow-Methods', value: 'POST, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
        ],
      },
    ];
  },
};
```

**Chrome Extension Manifest**:
```json
{
  "host_permissions": ["https://stackapply-ai.vercel.app/*"]
}
```


---

#### 9.3 Rate Limiting Implementation

**Strategy**: Use in-memory rate limiter with Redis fallback for production

**Implementation** (`src/lib/rateLimit.ts`):
```typescript
import { NextRequest } from 'next/server';

interface RateLimitConfig {
  maxAttempts: number;
  windowMs: number;
}

const store = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(config: RateLimitConfig) {
  return async (req: NextRequest): Promise<boolean> => {
    const ip = req.headers.get('x-forwarded-for') || 
               req.headers.get('x-real-ip') || 
               'unknown';
    
    const key = `${ip}:${req.url}`;
    const now = Date.now();
    
    const record = store.get(key);
    
    if (!record || now > record.resetAt) {
      store.set(key, {
        count: 1,
        resetAt: now + config.windowMs
      });
      return true;
    }
    
    if (record.count >= config.maxAttempts) {
      return false;
    }
    
    record.count++;
    return true;
  };
}
```

**Usage in API Routes**:
```typescript
const signInRateLimit = rateLimit({ maxAttempts: 10, windowMs: 60 * 60 * 1000 });

export async function POST(req: NextRequest) {
  if (!(await signInRateLimit(req))) {
    return NextResponse.json(
      { error: 'Too many attempts. Please try again later.' },
      { status: 429 }
    );
  }
  // ... continue with authentication ...
}
```


**Rate Limits by Endpoint**:
- `/api/auth/extension/signup`: 5 attempts/hour per IP
- `/api/auth/extension/signin`: 10 attempts/hour per IP (increases to 1-hour lockout after)
- `/api/auth/extension/validate`: 100 requests/minute per token
- `/api/auth/extension/refresh`: 10 requests/hour per token

---

#### 9.4 Token Storage Encryption

**Chrome Storage Security**:
- `chrome.storage.local` data is encrypted at rest by Chrome
- Accessible only to the extension (isolated by extension ID)
- Cleared when extension is uninstalled

**Additional Precautions**:
```javascript
// Never log tokens
// BAD:
console.log('Token:', token);

// GOOD:
console.log('Token received:', !!token);

// Never expose tokens in error messages
// BAD:
throw new Error(`Invalid token: ${token}`);

// GOOD:
throw new Error('Invalid token');
```

---

#### 9.5 Brute Force Prevention

**Mechanism**: Progressive delays + account lockout

```typescript
// Track failed attempts per email
const failedAttempts = new Map<string, { count: number; lockedUntil: number }>();

async function checkBruteForce(email: string): Promise<{ allowed: boolean; retryAfter?: number }> {
  const record = failedAttempts.get(email);
  const now = Date.now();
  
  if (record && record.lockedUntil > now) {
    return { 
      allowed: false, 
      retryAfter: Math.ceil((record.lockedUntil - now) / 1000) 
    };
  }
  
  return { allowed: true };
}

function recordFailedAttempt(email: string) {
  const record = failedAttempts.get(email) || { count: 0, lockedUntil: 0 };
  record.count++;
  
  if (record.count >= 5) {
    // Lock for 1 hour after 5 failed attempts
    record.lockedUntil = Date.now() + (60 * 60 * 1000);
  }
  
  failedAttempts.set(email, record);
}
```


---

### 10. Error Handling and Edge Cases

#### 10.1 Network Failures During Authentication

**Scenario**: User tries to sign in but network is unavailable

**Handling**:
```javascript
try {
  const response = await fetch(API_URL, options);
  // ... handle response ...
} catch (error) {
  if (error.name === 'TypeError' || error.message.includes('fetch')) {
    showErrorMessage('Could not connect to StackApply API. Check your internet connection.');
  } else {
    showErrorMessage('An unexpected error occurred. Please try again.');
  }
}
```

---

#### 10.2 Token Expiration During Active Use

**Scenario**: User has extension open, token expires mid-session

**Handling**:
```javascript
// When saving a job
async function saveJob(jobData) {
  try {
    const authState = await loadAuthState();
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authState.token}`
      },
      body: JSON.stringify(jobData)
    });
    
    if (response.status === 401) {
      // Token expired
      await clearAuthState();
      showErrorMessage('Your session has expired. Please sign in again.');
      showAuthForm();
      return;
    }
    
    // ... handle success ...
  } catch (error) {
    // ... handle other errors ...
  }
}
```


---

#### 10.3 Invalid Token Scenarios

**Scenarios**:
1. Token signature invalid (tampered)
2. Token expired
3. Session revoked from dashboard
4. User deleted from database

**Handling**: All treated the same way
```javascript
// In validateToken()
if (!decoded || !decoded.sub) {
  await clearAuthState();
  return false;
}

// Check session still exists
const session = await prisma.extensionSession.findUnique({
  where: { token: decoded.jti }
});

if (!session || session.expiresAt < new Date()) {
  await clearAuthState();
  return false;
}

return true;
```

---

#### 10.4 Switching Between Guest and Authenticated Modes

**Scenario**: User starts in guest mode, then signs in

**Handling**:
```javascript
async function handleSignInFromGuest(email, password) {
  // Sign in normally
  const response = await signIn(email, password);
  
  if (response.success) {
    // Clear guest flag
    await saveAuthState(response.token, response.user, expiresAt, false);
    
    // Show message
    showSuccessMessage('Signed in! Your new jobs will save to your account.');
    
    // Note: Old guest jobs remain in demo account
    // Could add migration logic here if desired
  }
}
```

**Data Migration Decision**: Do NOT migrate guest jobs to user account
- Reason: Guest account is shared/demo data
- Alternative: Show message "Start fresh with your new account"


---

#### 10.5 Extension Updates Preserving Session

**Chrome Behavior**: `chrome.storage.local` persists across extension updates

**Handling**: No special handling required
```javascript
// Extension loads normally after update
document.addEventListener('DOMContentLoaded', async () => {
  const authState = await loadAuthState(); // Still works after update
  // ... proceed normally ...
});
```

**Edge Case**: If token structure changes in update
```javascript
// Add version check
interface ExtensionStorage {
  auth: {
    version: number; // Add version field
    token: string | null;
    // ... other fields ...
  };
}

// On load, check version
const authState = await loadAuthState();
if (authState && authState.version !== CURRENT_VERSION) {
  // Clear old format, require re-authentication
  await clearAuthState();
  showAuthForm();
  showMessage('Extension updated. Please sign in again.');
}
```

---

### 11. Integration with NextAuth.js

#### Dual Authentication Support

The system supports **two authentication methods simultaneously**:

1. **NextAuth.js (Web Application)**: Cookie-based sessions for dashboard users
2. **Extension JWT (Browser Extension)**: Token-based auth for extension users

```mermaid
graph LR
    A[User Request] --> B{Request Source}
    B -->|Web Browser| C[NextAuth Session Cookie]
    B -->|Extension| D[JWT Authorization Header]
    C --> E[getServerSession]
    D --> F[ExtensionAuthService.validateToken]
    E --> G[User ID]
    F --> G
    G --> H[API Logic]
```


#### Shared User Database

Both authentication methods use the same `User` table:
- Web users sign in via NextAuth → email/password → User record
- Extension users sign in via JWT → email/password → **same User record**

**Account Interoperability**:
- User can sign in to web app with credentials
- User can sign in to extension with **same credentials**
- Jobs saved from either source appear in same dashboard
- Single source of truth for user data

---

### 12. Audit Logging Implementation

#### Database Schema for Audit Logs

```prisma
model AuthLog {
  id              String    @id @default(uuid())
  userId          String?   // Null for failed attempts
  eventType       String    // "signin_success", "signin_failure", "signup", "signout", "token_refresh"
  ipAddress       String
  userAgent       String?
  emailAttempted  String?   // Hashed for failed attempts
  success         Boolean
  failureReason   String?
  timestamp       DateTime  @default(now())

  @@index([userId, timestamp])
  @@index([ipAddress, timestamp])
}
```

#### Logging Implementation

```typescript
// src/lib/auditLog.ts
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

export class AuditLogger {
  static async logSignIn(
    userId: string | null,
    success: boolean,
    ipAddress: string,
    userAgent: string,
    email?: string,
    failureReason?: string
  ) {
    const emailHashed = email 
      ? crypto.createHash('sha256').update(email).digest('hex')
      : null;

    await prisma.authLog.create({
      data: {
        userId,
        eventType: success ? 'signin_success' : 'signin_failure',
        ipAddress,
        userAgent,
        emailAttempted: success ? null : emailHashed,
        success,
        failureReason,
      },
    });
  }
}
```


#### Usage in Auth Endpoints

```typescript
// In /api/auth/extension/signin
export async function POST(req: NextRequest) {
  const { email, password } = await req.json();
  const ipAddress = req.headers.get('x-forwarded-for') || 'unknown';
  const userAgent = req.headers.get('user-agent') || 'unknown';

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    
    if (!user || !user.password) {
      await AuditLogger.logSignIn(null, false, ipAddress, userAgent, email, 'Invalid credentials');
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    const isValid = await bcrypt.compare(password, user.password);
    
    if (!isValid) {
      await AuditLogger.logSignIn(null, false, ipAddress, userAgent, email, 'Invalid password');
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    // Success
    await AuditLogger.logSignIn(user.id, true, ipAddress, userAgent);
    
    // ... generate token and return ...
  } catch (error) {
    await AuditLogger.logSignIn(null, false, ipAddress, userAgent, email, 'Server error');
    // ... handle error ...
  }
}
```

---

### 13. Dashboard Integration

#### Session Management UI

Add new page: `src/app/dashboard/security/page.tsx`

```typescript
export default async function SecurityPage() {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    redirect('/');
  }

  const extensionSessions = await prisma.extensionSession.findMany({
    where: { userId: session.user.id },
    orderBy: { lastUsedAt: 'desc' },
  });

  const authLogs = await prisma.authLog.findMany({
    where: { userId: session.user.id },
    orderBy: { timestamp: 'desc' },
    take: 10,
  });

  return (
    <div>
      <h1>Security & Sessions</h1>
      
      <section>
        <h2>Active Extension Sessions</h2>
        {extensionSessions.map(session => (
          <SessionCard key={session.id} session={session} />
        ))}
      </section>

      <section>
        <h2>Recent Activity</h2>
        {authLogs.map(log => (
          <ActivityLogItem key={log.id} log={log} />
        ))}
      </section>
    </div>
  );
}
```


#### Session Revocation API

Add endpoint: `/api/auth/extension/revoke`

```typescript
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { sessionId } = await req.json();

  // Verify session belongs to current user
  const extensionSession = await prisma.extensionSession.findUnique({
    where: { id: sessionId },
  });

  if (!extensionSession || extensionSession.userId !== session.user.id) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  // Delete session
  await prisma.extensionSession.delete({
    where: { id: sessionId },
  });

  return NextResponse.json({ success: true });
}
```

---

### 14. Password Reset Integration

#### Extension Implementation

```javascript
// popup-auth.js
document.getElementById('forgot-password').addEventListener('click', (e) => {
  e.preventDefault();
  
  // Open password reset page in new tab
  chrome.tabs.create({
    url: 'https://stackapply-ai.vercel.app/reset-password'
  });
  
  // Show message
  showMessage('Password reset page opened in new tab');
});
```

#### Web Application Password Reset Flow

**Existing Flow** (no changes needed):
1. User clicks "Forgot Password?" in extension
2. Opens `/reset-password` page in new browser tab
3. User enters email
4. System sends password reset email
5. User clicks link in email
6. User sets new password
7. User can sign in to extension with new password


---

## Data Models

### Complete Prisma Schema Updates

```prisma
// Add to existing schema.prisma

model ExtensionSession {
  id                String    @id @default(uuid())
  userId            String
  user              User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  token             String    @unique  // JWT token identifier (jti claim)
  expiresAt         DateTime
  lastUsedAt        DateTime  @default(now())
  ipAddress         String?
  userAgent         String?
  createdAt         DateTime  @default(now())

  @@index([userId, expiresAt])
  @@index([token])
}

model AuthLog {
  id              String    @id @default(uuid())
  userId          String?
  eventType       String    // "signin_success", "signin_failure", "signup", "signout", "token_refresh"
  ipAddress       String
  userAgent       String?
  emailAttempted  String?   // Hashed for failed attempts
  success         Boolean
  failureReason   String?
  timestamp       DateTime  @default(now())

  @@index([userId, timestamp])
  @@index([ipAddress, timestamp])
}

// Update User model
model User {
  // ... existing fields ...
  extensionSessions ExtensionSession[]
}
```

### Migration Command

```bash
# Generate migration
npx prisma migrate dev --name add_extension_auth

# Apply to production
npx prisma migrate deploy
```


---

## Error Handling

### Error Response Format

All API endpoints return consistent error format:

```typescript
interface ErrorResponse {
  error: string;        // Human-readable error message
  code?: string;        // Machine-readable error code (optional)
  details?: any;        // Additional error context (optional, dev only)
}
```

### Error Codes and Messages

| HTTP Status | Error Code | Message | Extension Action |
|-------------|-----------|---------|------------------|
| 400 | `INVALID_EMAIL` | "Invalid email format" | Show inline error |
| 400 | `PASSWORD_TOO_SHORT` | "Password must be at least 8 characters" | Show inline error |
| 401 | `INVALID_CREDENTIALS` | "Invalid email or password" | Show error, allow retry |
| 401 | `TOKEN_EXPIRED` | "Session expired" | Clear storage, show sign-in form |
| 401 | `TOKEN_INVALID` | "Invalid token" | Clear storage, show sign-in form |
| 409 | `EMAIL_EXISTS` | "Email already registered. Please sign in." | Switch to sign-in form |
| 429 | `RATE_LIMIT` | "Too many attempts. Please try again later." | Disable form, show countdown |
| 500 | `SERVER_ERROR` | "Server error. Please try again." | Show error, allow retry |

### Extension Error Display

```javascript
function showErrorMessage(message) {
  const errorEl = document.getElementById('error-message');
  errorEl.textContent = message;
  errorEl.classList.remove('hidden');
  
  // Auto-hide after 5 seconds
  setTimeout(() => {
    errorEl.classList.add('hidden');
  }, 5000);
}
```


---

## Testing Strategy

### Unit Tests

**Backend Tests** (using Jest or Vitest):

1. **JWT Generation and Validation**
   - Test token generation with valid user data
   - Test token validation with valid/invalid/expired tokens
   - Test token signature verification
   - Test token revocation

2. **Password Hashing**
   - Test bcrypt hashing produces different hashes for same password
   - Test bcrypt compare validates correct passwords
   - Test bcrypt compare rejects incorrect passwords

3. **Rate Limiting**
   - Test rate limiter allows requests within limit
   - Test rate limiter blocks requests exceeding limit
   - Test rate limiter resets after window expires

4. **Audit Logging**
   - Test successful sign-in logs correct event
   - Test failed sign-in logs hashed email
   - Test log entries include IP and user agent

**Frontend Tests** (using Chrome Extension test utilities):

1. **Storage Operations**
   - Test saveAuthState stores data correctly
   - Test loadAuthState retrieves stored data
   - Test clearAuthState removes all auth data

2. **Token Validation**
   - Test validateToken with valid token returns true
   - Test validateToken with expired token returns false
   - Test validateToken with malformed token returns false

3. **UI State Management**
   - Test showAuthForm displays sign-in form
   - Test showAuthenticatedUI displays user email
   - Test guest badge appears in guest mode


---

### Integration Tests

1. **Sign-Up Flow**
   - Create new account via extension
   - Verify user created in database
   - Verify token stored in Chrome Storage
   - Verify extension shows authenticated UI

2. **Sign-In Flow**
   - Sign in with existing credentials
   - Verify token returned and stored
   - Verify extension shows authenticated UI
   - Verify invalid credentials return error

3. **Token Persistence**
   - Sign in and close extension
   - Reopen extension
   - Verify token validated automatically
   - Verify authenticated UI appears without re-sign-in

4. **Job Saving with Authentication**
   - Sign in to extension
   - Save a job
   - Verify job associated with correct user in database
   - Verify job appears in user's dashboard

5. **Guest Mode**
   - Click "Continue as Guest"
   - Verify guest token received
   - Save a job
   - Verify job saved to demo user account

6. **Sign-Out Flow**
   - Sign in to extension
   - Click sign out
   - Verify token cleared from storage
   - Verify sign-in form displayed
   - Verify session deleted from database

7. **Token Expiration**
   - Create token with 1-second expiration (test mode)
   - Wait for expiration
   - Attempt to save job
   - Verify 401 error returned
   - Verify extension shows sign-in form


---

### Manual Testing Checklist

- [ ] Sign up with new email creates account
- [ ] Sign up with existing email shows error
- [ ] Sign up with invalid email shows validation error
- [ ] Sign up with short password shows validation error
- [ ] Sign in with correct credentials succeeds
- [ ] Sign in with incorrect password shows error
- [ ] Sign in with non-existent email shows error
- [ ] Token persists after closing and reopening extension
- [ ] Token persists after browser restart
- [ ] Guest mode activates and saves to demo account
- [ ] Sign out clears token and shows sign-in form
- [ ] Job save with valid token succeeds
- [ ] Job save with expired token shows re-auth prompt
- [ ] Job save without authentication shows sign-in form
- [ ] Rate limiting blocks excessive sign-in attempts
- [ ] Forgot password link opens web page
- [ ] UI matches web application design
- [ ] Loading states appear during API calls
- [ ] Error messages display clearly
- [ ] Success messages display briefly then disappear

---

## Implementation Phases

### Phase 1: Database and Backend (Week 1)

**Tasks**:
1. Update Prisma schema with `ExtensionSession` and `AuthLog` models
2. Run database migration
3. Create `src/lib/extensionAuth.ts` service
4. Implement `/api/auth/extension/signup` endpoint
5. Implement `/api/auth/extension/signin` endpoint
6. Implement `/api/auth/extension/validate` endpoint
7. Implement `/api/auth/extension/refresh` endpoint
8. Implement `/api/auth/extension/signout` endpoint
9. Implement `/api/auth/extension/guest` endpoint
10. Update `/api/jobs` route to support extension tokens
11. Add rate limiting middleware
12. Add audit logging to all auth endpoints
13. Write unit tests for token service
14. Write integration tests for API endpoints

**Environment Variables**:
```env
EXTENSION_JWT_SECRET=<generate-secure-random-256-bit-key>
```


---

### Phase 2: Extension UI and Authentication (Week 2)

**Tasks**:
1. Create `popup-auth.html` with sign-in/sign-up form
2. Create `popup-auth.css` matching web app design
3. Create `popup-auth.js` with authentication logic
4. Implement Chrome Storage helpers (save/load/clear)
5. Implement sign-in flow in extension
6. Implement sign-up flow in extension
7. Implement guest mode flow in extension
8. Implement token validation on startup
9. Implement sign-out functionality
10. Update `popup.html` to show user info header
11. Add settings menu with sign-out button
12. Implement error message display
13. Implement loading state display
14. Add forgot password link
15. Test extension authentication flows manually

**Files to Create**:
- `extension/popup-auth.html`
- `extension/popup-auth.css`
- `extension/popup-auth.js`
- `extension/auth-storage.js` (storage helpers)

**Files to Update**:
- `extension/popup.html` (add user header)
- `extension/popup.js` (add auth check, token handling)
- `extension/manifest.json` (add storage permission if not present)

---

### Phase 3: Integration and Testing (Week 3)

**Tasks**:
1. Test complete sign-up → save job → dashboard flow
2. Test complete sign-in → save job → dashboard flow
3. Test guest mode → save job → guest dashboard
4. Test token persistence across browser restarts
5. Test token expiration and re-authentication
6. Test switching between guest and authenticated modes
7. Test sign-out and re-sign-in
8. Test forgot password integration
9. Verify audit logs appear in database
10. Test rate limiting on sign-in endpoint
11. Test CORS configuration
12. Test HTTPS-only enforcement
13. Implement dashboard security page
14. Implement session revocation from dashboard
15. Write end-to-end tests
16. Performance testing (token validation speed)
17. Security audit (token storage, transmission)


---

### Phase 4: Deployment and Documentation (Week 4)

**Tasks**:
1. Add `EXTENSION_JWT_SECRET` to production environment variables
2. Deploy backend changes to Vercel
3. Run database migrations on production
4. Update extension to use production API URL
5. Package updated extension for Chrome Web Store
6. Submit extension update for review
7. Write user documentation for authentication
8. Write developer documentation for maintenance
9. Create troubleshooting guide
10. Monitor authentication success rates
11. Monitor error logs for issues
12. Set up alerts for rate limit violations
13. Set up alerts for suspicious login patterns

---

## Dependencies

### New NPM Packages

```json
{
  "dependencies": {
    "jsonwebtoken": "^9.0.2",
    "uuid": "^9.0.0"
  },
  "devDependencies": {
    "@types/jsonwebtoken": "^9.0.5",
    "@types/uuid": "^9.0.7"
  }
}
```

**Installation**:
```bash
npm install jsonwebtoken uuid
npm install -D @types/jsonwebtoken @types/uuid
```

### Existing Dependencies (Already Installed)

- `bcryptjs`: Password hashing
- `next-auth`: Web application authentication
- `@prisma/client`: Database ORM
- `next`: Web framework


---

## File Structure

```
stackapply-ai/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth/
│   │   │   │   └── extension/
│   │   │   │       ├── signin/
│   │   │   │       │   └── route.ts          # POST /api/auth/extension/signin
│   │   │   │       ├── signup/
│   │   │   │       │   └── route.ts          # POST /api/auth/extension/signup
│   │   │   │       ├── validate/
│   │   │   │       │   └── route.ts          # POST /api/auth/extension/validate
│   │   │   │       ├── refresh/
│   │   │   │       │   └── route.ts          # POST /api/auth/extension/refresh
│   │   │   │       ├── signout/
│   │   │   │       │   └── route.ts          # POST /api/auth/extension/signout
│   │   │   │       └── guest/
│   │   │   │           └── route.ts          # POST /api/auth/extension/guest
│   │   │   └── jobs/
│   │   │       └── route.ts                  # Updated to support extension tokens
│   │   └── dashboard/
│   │       └── security/
│   │           └── page.tsx                  # Security & sessions page
│   └── lib/
│       ├── extensionAuth.ts                  # JWT service (NEW)
│       ├── rateLimit.ts                      # Rate limiting (NEW)
│       ├── auditLog.ts                       # Audit logging (NEW)
│       ├── auth.ts                           # Existing NextAuth config
│       └── prisma.ts                         # Existing Prisma client
├── extension/
│   ├── manifest.json                         # Updated permissions
│   ├── popup.html                            # Updated with user header
│   ├── popup.css                             # Updated styles
│   ├── popup.js                              # Updated with auth logic
│   ├── popup-auth.html                       # NEW: Auth form
│   ├── popup-auth.css                        # NEW: Auth form styles
│   ├── popup-auth.js                         # NEW: Auth logic
│   └── auth-storage.js                       # NEW: Storage helpers
├── prisma/
│   └── schema.prisma                         # Updated with ExtensionSession, AuthLog
└── package.json                              # Updated dependencies
```


---

## Security Checklist

### Pre-Deployment Security Review

- [ ] JWT secret is cryptographically secure (256-bit minimum)
- [ ] JWT secret stored in environment variable, not committed to git
- [ ] Password hashing uses bcrypt with sufficient salt rounds (10+)
- [ ] Tokens transmitted only over HTTPS
- [ ] CORS properly configured to allow only extension origin
- [ ] Rate limiting implemented on all authentication endpoints
- [ ] Brute force protection prevents account enumeration
- [ ] Failed login attempts logged with hashed email
- [ ] Token expiration properly enforced (30 days)
- [ ] Token signature validated on every request
- [ ] Session revocation works from dashboard
- [ ] Chrome Storage used correctly (no sensitive data in sync storage)
- [ ] Error messages don't leak sensitive information
- [ ] SQL injection prevented by Prisma parameterization
- [ ] XSS prevented by not using innerHTML for user data
- [ ] Audit logs capture all authentication events
- [ ] IP addresses logged for security analysis
- [ ] No tokens logged to console or error messages
- [ ] Production uses HTTPS-only (no HTTP fallback)
- [ ] Database uses encrypted connections
- [ ] Environment variables not exposed to client

---

## Performance Considerations

### Token Validation Performance

**Expected Performance**:
- Token validation: < 10ms per request
- Database session lookup: < 20ms per request
- Total authentication overhead: < 30ms per request

**Optimization Strategies**:
1. Index `ExtensionSession.token` for fast lookups
2. Cache user data in JWT payload to avoid extra DB queries
3. Use connection pooling for database queries
4. Consider Redis cache for frequently validated tokens (future enhancement)


### Database Query Optimization

**Indexes Required**:
```sql
-- ExtensionSession lookups by token (unique index already created)
CREATE UNIQUE INDEX "ExtensionSession_token_key" ON "ExtensionSession"("token");

-- User session lookups
CREATE INDEX "ExtensionSession_userId_expiresAt_idx" ON "ExtensionSession"("userId", "expiresAt");

-- Audit log queries by user
CREATE INDEX "AuthLog_userId_timestamp_idx" ON "AuthLog"("userId", "timestamp");

-- Audit log queries by IP (security analysis)
CREATE INDEX "AuthLog_ipAddress_timestamp_idx" ON "AuthLog"("ipAddress", "timestamp");
```

**Query Patterns**:
- Most common: Validate token (lookup by token)
- Second most common: List user sessions (lookup by userId)
- Least common: Audit log analysis (lookup by IP or userId)

---

## Monitoring and Observability

### Metrics to Track

1. **Authentication Success Rate**: Percentage of successful sign-in attempts
2. **Token Validation Rate**: Percentage of valid token validations
3. **Sign-Up Rate**: New user registrations per day
4. **Guest Mode Usage**: Percentage of users using guest mode
5. **Token Refresh Rate**: Number of tokens refreshed per day
6. **Rate Limit Hits**: Number of requests blocked by rate limiting
7. **Failed Authentication Attempts**: Failed sign-ins per IP address

### Logging Strategy

**What to Log**:
- All authentication attempts (success and failure)
- Token generation and validation
- Session creation and deletion
- Rate limit violations
- API errors and exceptions

**What NOT to Log**:
- Plain text passwords
- Full JWT tokens
- User sensitive data in error messages


**Log Levels**:
```typescript
// Error: Authentication failures, token validation errors
console.error('Authentication failed:', { userId, reason });

// Warning: Rate limit hits, suspicious activity
console.warn('Rate limit exceeded:', { ip, endpoint });

// Info: Successful authentication, session creation
console.info('User signed in:', { userId, timestamp });

// Debug: Token validation, session lookups (development only)
console.debug('Validating token:', { jti, expiresAt });
```

---

## Future Enhancements

### Phase 2 Features (Post-Launch)

1. **Biometric Authentication** (Chrome 108+)
   - WebAuthn integration for passwordless sign-in
   - Touch ID / Face ID on supported devices

2. **Multi-Device Session Management**
   - View all active sessions across devices
   - Revoke individual sessions from dashboard
   - "Sign out of all devices" option

3. **OAuth Integration**
   - Google Sign-In for extension
   - LinkedIn Sign-In for extension
   - Match existing web OAuth flow

4. **Token Refresh Improvements**
   - Sliding window token expiration
   - Automatic token refresh before expiration
   - Seamless re-authentication

5. **Advanced Security Features**
   - Two-factor authentication (2FA)
   - Email verification for new accounts
   - Suspicious login detection
   - Device fingerprinting

6. **Performance Optimizations**
   - Redis cache for token validation
   - Reduce database queries with caching
   - Background token validation

7. **Enhanced Audit Logging**
   - Detailed session activity logs
   - Export audit logs to CSV
   - Real-time security alerts

---

## Conclusion

This design provides a comprehensive, secure, and user-friendly authentication system for the StackApply.ai browser extension. The implementation follows industry best practices for JWT-based authentication, token management, and security. The system integrates seamlessly with the existing NextAuth.js infrastructure while providing extension-specific functionality like Chrome Storage persistence and guest mode.


### Key Design Decisions

1. **Separate JWT Secret**: Use `EXTENSION_JWT_SECRET` separate from `NEXTAUTH_SECRET` to isolate extension auth from web auth
2. **Session Table**: Track extension sessions separately in `ExtensionSession` table for revocation and audit
3. **Dual Authentication**: Support both NextAuth sessions (web) and JWT tokens (extension) in same API endpoints
4. **30-Day Expiration**: Balance security with user convenience
5. **Guest Mode Preservation**: Maintain guest functionality for testing and onboarding
6. **No Data Migration**: Guest jobs stay with demo account when switching to authenticated mode
7. **Rate Limiting**: Prevent brute force attacks with progressive delays and lockouts
8. **Audit Logging**: Comprehensive logging for security analysis and troubleshooting
9. **Chrome Storage Local**: Use local storage (not sync) for better security control
10. **Password Reset Delegation**: Leverage existing web password reset flow via new tab

---

## Appendix: API Request Examples

### Sign-Up Request

```bash
curl -X POST https://stackapply-ai.vercel.app/api/auth/extension/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "securepassword123"
  }'
```

**Response**:
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "fullName": null
  }
}
```


---

### Sign-In Request

```bash
curl -X POST https://stackapply-ai.vercel.app/api/auth/extension/signin \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "securepassword123"
  }'
```

**Response**:
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "fullName": "John Doe"
  }
}
```

---

### Token Validation Request

```bash
curl -X POST https://stackapply-ai.vercel.app/api/auth/extension/validate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Response**:
```json
{
  "success": true,
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "fullName": "John Doe"
  },
  "expiresAt": "2024-03-15T10:30:00.000Z"
}
```

---

### Save Job with Authentication

```bash
curl -X POST https://stackapply-ai.vercel.app/api/jobs \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -d '{
    "title": "Senior Software Engineer",
    "company": "Tech Corp",
    "location": "San Francisco, CA",
    "workSetting": "HYBRID"
  }'
```

**Response**:
```json
{
  "success": true,
  "job": {
    "id": "job-uuid",
    "title": "Senior Software Engineer",
    "company": "Tech Corp",
    "userId": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

