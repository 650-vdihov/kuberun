import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { bearer, jwt } from "better-auth/plugins";
import { Resend } from "resend";
import { db } from "./db/index.js";
import * as schema from "./db/schema.js";
import dotenv from "dotenv";
dotenv.config();

const resend = new Resend(process.env.RESEND_API_KEY);

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
      jwks: schema.jwks,
    },
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    sendResetPassword: async ({ user, url }) => {
      await resend.emails.send({
        from: process.env.EMAIL_FROM || "onboarding@resend.dev",
        to: user.email,
        subject: "Reset your password",
        html: `
          <h1>Reset your password</h1>
          <p>Click the link below to reset your password:</p>
          <a href="${url}">Reset Password</a>
          <p>If you didn't request this, you can safely ignore this email.</p>
        `,
      });
    },
  },
  session: {
    expiresIn: 7 * 24 * 60 * 60, // Session expiry: 7 days
    updateAge: 24 * 60 * 60, // Update session every 24 hours
  },
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins: process.env.TRUSTED_ORIGINS?.split(",") || [
    "http://localhost:4000"
  ],
  plugins: [
    // Bearer plugin: allows clients to use Authorization: Bearer <session_token>
    bearer(),
    // JWT plugin: provides /token endpoint for short-lived JWTs that microservices can validate locally
    jwt({
      jwt: {
        expirationTime: "15m", // Short-lived JWT for microservices
        definePayload: async ({ user, session }) => ({
          sub: user.id,
          email: user.email,
          name: user.name,
          emailVerified: user.emailVerified,
          sessionId: session.id,
        }),
      },
      jwks: {
        keyPairConfig: {
          alg: "RS256", // RSA for better library support
        },
      },
    }),
  ],
});

export type Auth = typeof auth;
