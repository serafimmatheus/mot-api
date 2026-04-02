import type { Prisma } from "../generated/prisma/client.js";
import type { PrismaClient } from "../generated/prisma/client.js";

export type ActivityLogDb = Pick<PrismaClient, "activityLog">;

export function formatUserLabel(
  u: { name: string | null; email: string } | null | undefined,
): string {
  if (!u) return "Usuário";
  const n = u.name?.trim();
  return n || u.email;
}

export async function createActivityLog(
  db: ActivityLogDb,
  input: {
    patientId: string;
    actorUserId: string;
    action: string;
    summary: string;
    metadata?: Prisma.InputJsonValue;
  },
): Promise<void> {
  try {
    await db.activityLog.create({
      data: {
        patientId: input.patientId,
        actorUserId: input.actorUserId,
        action: input.action,
        summary: input.summary,
        ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
      },
    });
  } catch (err) {
    console.error("[activityLog] falha ao gravar:", err);
  }
}
