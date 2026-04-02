import { ErrorForbidden } from "../../errors/ErrorForbidden.js";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { formatUserLabel } from "../../lib/createActivityLog.js";

export class ListActivityLog {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(
    userId: string,
    options: { patientId?: string; page?: number; pageSize?: number },
  ) {
    const page = Math.max(1, options.page ?? 1);
    const pageSize = Math.min(50, Math.max(1, options.pageSize ?? 20));

    const links = await this.prisma.patientCaregiver.findMany({
      where: { userId },
      select: { patientId: true },
    });
    const allowed = new Set(links.map((l) => l.patientId));

    if (options.patientId) {
      if (!allowed.has(options.patientId)) {
        throw new ErrorForbidden("Sem acesso a este paciente");
      }
    }

    if (!options.patientId && allowed.size === 0) {
      return {
        items: [] as Array<{
          id: string;
          patientId: string;
          patientName: string;
          actorUserId: string;
          actorLabel: string;
          action: string;
          summary: string;
          createdAt: string;
        }>,
        page,
        pageSize,
        total: 0,
      };
    }

    const where =
      options.patientId !== undefined
        ? { patientId: options.patientId }
        : { patientId: { in: [...allowed] } };

    const [total, rows] = await Promise.all([
      this.prisma.activityLog.count({ where }),
      this.prisma.activityLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          patient: { select: { name: true } },
          actor: { select: { name: true, email: true } },
        },
      }),
    ]);

    return {
      items: rows.map((r) => ({
        id: r.id,
        patientId: r.patientId,
        patientName: r.patient.name,
        actorUserId: r.actorUserId,
        actorLabel: formatUserLabel(r.actor),
        action: r.action,
        summary: r.summary,
        createdAt: r.createdAt.toISOString(),
      })),
      page,
      pageSize,
      total,
    };
  }
}
