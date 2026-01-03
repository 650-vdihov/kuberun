import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { bearer, jwt } from "better-auth/plugins";
import { Resend } from "resend";
import { db } from "./db/index.js";
import * as schema from "./db/schema.js";
import { config } from "./config.js";

const resend = new Resend(config.resendApiKey);

export const auth = betterAuth({
  baseURL: config.betterAuthUrl,
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
      if (!config.resendApiKey) {
        throw new Error("RESEND_API_KEY is not set");
      }
      await resend.emails.send({
        from: config.emailFrom,
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
    expiresIn: config.sessionExpiresInSeconds,
    updateAge: config.sessionUpdateAgeSeconds,
  },
  secret: config.betterAuthSecret,
  trustedOrigins: config.trustedOrigins,
  plugins: [
    // Bearer plugin: allows clients to use Authorization: Bearer <session_token>
    bearer(),
    // JWT plugin: provides /token endpoint for short-lived JWTs that microservices can validate locally
    jwt({
      jwt: {
        expirationTime: config.jwtExpirationTime,
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
