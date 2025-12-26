import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { bearer } from "better-auth/plugins";
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
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins: process.env.TRUSTED_ORIGINS?.split(",") || [
    "http://localhost:3000"
  ],
  plugins: [bearer()],
});

export type Auth = typeof auth;
