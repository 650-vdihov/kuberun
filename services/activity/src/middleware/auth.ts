import type { Context, Next } from "hono";
import { HTTPException } from "hono/http-exception";
import { jwtVerify, createRemoteJWKSet, type JWTPayload } from "jose";
import { config } from "../config.js";

// JWKS URL for fetching public keys from auth service
const JWKS_URL = new URL(`${config.authServiceUrl}/api/auth/jwks`);

// Create a remote JWKS - jose handles caching automatically
const JWKS = createRemoteJWKSet(JWKS_URL);

// JWT payload type based on what auth service includes
interface JwtUser {
  sub: string;  // user id
  email: string;
  name: string;
  emailVerified: boolean;
  sessionId: string;
}

/**
 * JWT Authentication Middleware
 */
export const authMiddleware = () => {
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
            // Include hint for client to refresh token
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

// Helper to get user from context
export const getUser = (c: Context): JwtUser => {
  return c.get("user");
};

// Helper to get full JWT payload from context
export const getJwtPayload = (c: Context): JWTPayload => {
  return c.get("jwtPayload");
};
