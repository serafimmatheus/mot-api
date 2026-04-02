import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { openAPI } from "better-auth/plugins";

import { prisma } from "./db.js";

const trustedOrigins = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  process.env.BETTER_AUTH_TRUSTED_ORIGIN,
].filter((o): o is string => Boolean(o));

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:5555",
  trustedOrigins,
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    },
  },
  emailAndPassword: {
    enabled: true,
  },
  plugins: [openAPI()],
});
