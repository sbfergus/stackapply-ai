import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';
import { v4 as uuidv4 } from 'uuid';

/**
 * Payload for token generation
 */
interface TokenPayload {
  userId: string;
  email: string;
}

/**
 * Complete JWT structure with standard and custom claims
 */
interface ExtensionJWT {
  iss: string;           // Issuer: "stackapply-extension"
  sub: string;           // Subject: user.id (UUID)
  jti: string;           // JWT ID: unique token identifier (UUID)
  iat: number;           // Issued At: Unix timestamp
  exp: number;           // Expiration: Unix timestamp (30 days from iat)
  email: string;         // User's email address
  type: "extension" | "guest"; // Token type identifier
}

const JWT_SECRET = process.env.EXTENSION_JWT_SECRET!;
const TOKEN_EXPIRY_DAYS = 30;

/**
 * Service for managing extension JWT tokens and sessions
 */
export class ExtensionAuthService {
  /**
   * Generate a new JWT token and create session record in database
   * 
   * @param payload - User information (userId and email)
   * @param type - Token type: "extension" for regular users, "guest" for guest mode
   * @param ipAddress - Optional IP address for audit logging
   * @param userAgent - Optional user agent string for audit logging
   * @returns JWT token string
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
   * Updates lastUsedAt timestamp in database
   * 
   * @param token - JWT token string to validate
   * @returns Decoded JWT payload if valid, null if invalid or expired
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
   * Revoke token and delete session from database
   * 
   * @param token - JWT token string to revoke
   * @returns true if revocation successful, false if token invalid or session not found
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

// Export interfaces for use in API routes
export type { TokenPayload, ExtensionJWT };
