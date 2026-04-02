import { randomBytes } from "node:crypto";

const DEFAULT_TTL_DAYS = 7;

export function generateCaregiverInviteToken(): string {
  return randomBytes(32).toString("base64url");
}

export function caregiverInviteExpiresAt(): Date {
  const days = Number(process.env.CAREGIVER_INVITE_TTL_DAYS ?? DEFAULT_TTL_DAYS);
  const safe = Number.isFinite(days) && days > 0 ? days : DEFAULT_TTL_DAYS;
  return new Date(Date.now() + safe * 86_400_000);
}

export function buildCaregiverInviteUrl(token: string): string {
  const base = (
    process.env.FRONTEND_PUBLIC_URL ||
    process.env.BETTER_AUTH_TRUSTED_ORIGIN ||
    "http://localhost:3000"
  ).replace(/\/$/, "");
  return `${base}/convite/${encodeURIComponent(token)}`;
}
