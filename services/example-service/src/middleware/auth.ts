import type { Context, Next } from "hono";
import { HTTPException } from "hono/http-exception";
import dotenv from "dotenv";
dotenv.config();

export const authMiddleware = () => {
  return async (c: Context, next: Next) => {
    const authHeader = c.req.header("Authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new HTTPException(401, { message: "Unauthorized: No token provided" });
    }

    const token = authHeader.substring(7);

    try {
      const authServiceUrl = process.env.AUTH_SERVICE_URL || "http://localhost:3010";
      
      const response = await fetch(`${authServiceUrl}/api/auth/get-session`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new HTTPException(401, { message: "Invalid or expired token" });
      }

      const session = await response.json();

      // Validate that session actually contains user data
      if (!session.user) {
        throw new HTTPException(401, { message: "Invalid session data" });
      }

      c.set("user", session.user);
      c.set("session", session.session);

      await next();
    } catch (error) {
      if (error instanceof HTTPException) {
        throw error;
      }
      // Log the actual error for debugging, but don't expose it to client
      console.error("Token validation error:", error);
      throw new HTTPException(401, { message: "Authentication failed" });
    }
  };
};

// Helper to get user from context
export const getUser = (c: Context) => {
  return c.get("user");
};

// Helper to get session from context
export const getSession = (c: Context) => {
  return c.get("session");
};
