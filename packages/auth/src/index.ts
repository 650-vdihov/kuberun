import type { Context, Next } from "hono";
import { HTTPException } from "hono/http-exception";
import { jwtVerify, createRemoteJWKSet, type JWTPayload } from "jose";

// JWT payload type based on what auth service includes
export interface JwtUser {
  sub: string;  // user id
  email: string;
  name: string;
  emailVerified: boolean;
  sessionId: string;
}

/**
 * Create JWT Authentication Middleware
 * @param authServiceUrl - URL of the auth service (e.g., "http://localhost:4001")
 */
export function createAuthMiddleware(authServiceUrl: string) {
  // JWKS URL for fetching public keys from auth service
  const JWKS_URL = new URL(`${authServiceUrl}/api/auth/jwks`);
  
  // Create a remote JWKS - jose handles caching automatically
  const JWKS = createRemoteJWKSet(JWKS_URL);

  return () => {
    return async (c: Context, next: Next) => {
      const authHeader = c.req.header("Authorization");

      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        throw new HTTPException(401, { message: "Unauthorized: No token provided" });
      }

      const token = authHeader.substring(7);

      // Check if this looks like a JWT (should have 3 parts separated by dots)
      const tokenParts = token.split('.');
      if (tokenParts.length !== 3) {
        throw new HTTPException(401, { 
          message: "Invalid token format. Expected JWT. Get one from /api/auth/token using your session token." 
        });
      }

      try {
        // Verify JWT locally using JWKS
        const { payload } = await jwtVerify(token, JWKS, {});

        // Extract user data from JWT claims
        const user: JwtUser = {
          sub: payload.sub as string,
          email: payload.email as string,
          name: payload.name as string,
          emailVerified: payload.emailVerified as boolean,
          sessionId: payload.sessionId as string,
        };

        c.set("user", user);
        c.set("jwtPayload", payload);

        await next();
      } catch (error) {
        // Handle specific JWT errors
        if (error instanceof Error) {
          if (error.message.includes("expired")) {
            throw new HTTPException(401, { 
              message: "Token expired",
            });
          }
          if (error.message.includes("signature")) {
            throw new HTTPException(401, { message: "Invalid token signature" });
          }
        }
        
        console.error("JWT validation error:", error);
        throw new HTTPException(401, { message: "Authentication failed" });
      }
    };
  };
}

/**
 * Helper to get user from context
 */
export function getUser(c: Context): JwtUser {
  const user = c.get("user");
  if (!user) {
    throw new HTTPException(401, { message: "User not authenticated" });
  }
  return user as JwtUser;
}

/**
 * Helper to get full JWT payload from context
 */
export function getJwtPayload(c: Context): JWTPayload {
  const payload = c.get("jwtPayload");
  if (!payload) {
    throw new HTTPException(401, { message: "JWT payload not found" });
  }
  return payload as JWTPayload;
}
