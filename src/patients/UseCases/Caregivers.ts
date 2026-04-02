import { ErrorBadRequest } from "../../errors/ErrorBadRequest.js";
import { ErrorConflict } from "../../errors/ErrorConflict.js";
import { ErrorNotFound } from "../../errors/ErrorNotFound.js";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { assertPatientCaregiverAccess } from "../../lib/assertPatientCaregiverAccess.js";
import {
  createActivityLog,
  formatUserLabel,
} from "../../lib/createActivityLog.js";
import {
  buildCaregiverInviteUrl,
  caregiverInviteExpiresAt,
  generateCaregiverInviteToken,
} from "../../lib/caregiver-invite-token.js";

export class ListPatientCaregivers {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(userId: string, patientId: string) {
    await assertPatientCaregiverAccess(this.prisma, { userId, patientId });
    const rows = await this.prisma.patientCaregiver.findMany({
      where: { patientId },
      include: {
        user: { select: { id: true, email: true, name: true, image: true } },
      },
      orderBy: { createdAt: "asc" },
    });
    return {
      caregivers: rows.map((r) => ({
        userId: r.userId,
        email: r.user.email,
        name: r.user.name,
        image: r.user.image,
        linkedAt: r.createdAt.toISOString(),
      })),
    };
  }
}

export class AddPatientCaregiver {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(userId: string, patientId: string, email: string) {
    await assertPatientCaregiverAccess(this.prisma, { userId, patientId });
    const normalized = email.trim().toLowerCase();
    const target = await this.prisma.user.findUnique({
      where: { email: normalized },
    });
    if (target) {
      const existing = await this.prisma.patientCaregiver.findUnique({
        where: {
          patientId_userId: { patientId, userId: target.id },
        },
      });
      if (existing) {
        throw new ErrorConflict("Este usuário já é cuidador deste paciente");
      }
      await this.prisma.$transaction(async (tx) => {
        await tx.patientCaregiver.create({
          data: { patientId, userId: target.id },
        });
        await tx.patientCaregiverInvite.deleteMany({
          where: { patientId, email: normalized },
        });
      });
      const [actor, patient] = await Promise.all([
        this.prisma.user.findUnique({
          where: { id: userId },
          select: { name: true, email: true },
        }),
        this.prisma.patient.findUnique({
          where: { id: patientId },
          select: { name: true },
        }),
      ]);
      await createActivityLog(this.prisma, {
        patientId,
        actorUserId: userId,
        action: "CAREGIVER_LINKED",
        summary: `${formatUserLabel(actor)} vinculou ${formatUserLabel(target)} como cuidador do paciente «${patient?.name ?? ""}».`,
        metadata: { linkedUserId: target.id, email: target.email },
      });
      return {
        status: "linked" as const,
        userId: target.id,
        email: target.email,
        name: target.name,
      };
    }

    const token = generateCaregiverInviteToken();
    const expiresAt = caregiverInviteExpiresAt();
    await this.prisma.patientCaregiverInvite.upsert({
      where: {
        patientId_email: { patientId, email: normalized },
      },
      create: { patientId, email: normalized, token, expiresAt },
      update: { token, expiresAt },
    });
    const [actor, patient] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { name: true, email: true },
      }),
      this.prisma.patient.findUnique({
        where: { id: patientId },
        select: { name: true },
      }),
    ]);
    await createActivityLog(this.prisma, {
      patientId,
      actorUserId: userId,
      action: "CAREGIVER_INVITE_SENT",
      summary: `${formatUserLabel(actor)} enviou (ou renovou) convite de cuidador para ${normalized} no paciente «${patient?.name ?? ""}».`,
      metadata: { email: normalized },
    });
    return {
      status: "pending_invite" as const,
      email: normalized,
      inviteUrl: buildCaregiverInviteUrl(token),
    };
  }
}

export class RemovePatientCaregiver {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(
    requesterUserId: string,
    patientId: string,
    caregiverUserId: string,
  ) {
    await assertPatientCaregiverAccess(this.prisma, {
      userId: requesterUserId,
      patientId,
    });
    const count = await this.prisma.patientCaregiver.count({
      where: { patientId },
    });
    if (count <= 1) {
      const [requester, patient] = await Promise.all([
        this.prisma.user.findUnique({
          where: { id: requesterUserId },
          select: { name: true, email: true },
        }),
        this.prisma.patient.findUnique({
          where: { id: patientId },
          select: { name: true },
        }),
      ]);
      await createActivityLog(this.prisma, {
        patientId,
        actorUserId: requesterUserId,
        action: "CAREGIVER_REMOVE_DENIED_LAST",
        summary: `${formatUserLabel(requester)} tentou desvincular um cuidador do paciente «${patient?.name ?? ""}», mas não é possível remover o último cuidador.`,
      });
      throw new ErrorBadRequest(
        "Não é possível remover o último cuidador do paciente",
      );
    }
    const link = await this.prisma.patientCaregiver.findUnique({
      where: {
        patientId_userId: { patientId, userId: caregiverUserId },
      },
    });
    if (!link) {
      throw new ErrorNotFound("Cuidador não vinculado a este paciente");
    }
    const [targetUser, requester, patient] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: caregiverUserId },
        select: { name: true, email: true },
      }),
      this.prisma.user.findUnique({
        where: { id: requesterUserId },
        select: { name: true, email: true },
      }),
      this.prisma.patient.findUnique({
        where: { id: patientId },
        select: { name: true },
      }),
    ]);
    await this.prisma.patientCaregiver.delete({
      where: {
        patientId_userId: { patientId, userId: caregiverUserId },
      },
    });
    await createActivityLog(this.prisma, {
      patientId,
      actorUserId: requesterUserId,
      action: "CAREGIVER_REMOVED",
      summary: `${formatUserLabel(requester)} desvinculou ${formatUserLabel(targetUser)} do paciente «${patient?.name ?? ""}».`,
      metadata: { removedUserId: caregiverUserId },
    });
  }
}

export class RevokePatientCaregiverInvite {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(userId: string, patientId: string, inviteId: string) {
    await assertPatientCaregiverAccess(this.prisma, { userId, patientId });
    const row = await this.prisma.patientCaregiverInvite.findFirst({
      where: { id: inviteId, patientId },
    });
    if (!row) {
      throw new ErrorNotFound("Convite não encontrado");
    }
    const actor = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true },
    });
    const patient = await this.prisma.patient.findUnique({
      where: { id: patientId },
      select: { name: true },
    });
    await this.prisma.patientCaregiverInvite.delete({
      where: { id: inviteId },
    });
    await createActivityLog(this.prisma, {
      patientId,
      actorUserId: userId,
      action: "CAREGIVER_INVITE_REVOKED",
      summary: `${formatUserLabel(actor)} revogou o convite enviado para ${row.email} (paciente «${patient?.name ?? ""}»).`,
      metadata: { inviteId, email: row.email },
    });
  }
}

export class ListPatientCaregiverInvites {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(userId: string, patientId: string) {
    await assertPatientCaregiverAccess(this.prisma, { userId, patientId });
    const rows = await this.prisma.patientCaregiverInvite.findMany({
      where: { patientId },
      orderBy: { createdAt: "desc" },
    });
    const now = new Date();
    return {
      invites: rows.map((r) => ({
        id: r.id,
        email: r.email,
        expiresAt: r.expiresAt.toISOString(),
        createdAt: r.createdAt.toISOString(),
        inviteUrl: buildCaregiverInviteUrl(r.token),
        status: r.expiresAt < now ? ("expired" as const) : ("pending" as const),
      })),
    };
  }
}

export class RefreshPatientCaregiverInvite {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(userId: string, patientId: string, inviteId: string) {
    await assertPatientCaregiverAccess(this.prisma, { userId, patientId });
    const row = await this.prisma.patientCaregiverInvite.findFirst({
      where: { id: inviteId, patientId },
    });
    if (!row) {
      throw new ErrorNotFound("Convite não encontrado");
    }
    const token = generateCaregiverInviteToken();
    const expiresAt = caregiverInviteExpiresAt();
    const updated = await this.prisma.patientCaregiverInvite.update({
      where: { id: inviteId },
      data: { token, expiresAt },
    });
    const actor = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true },
    });
    const patient = await this.prisma.patient.findUnique({
      where: { id: patientId },
      select: { name: true },
    });
    await createActivityLog(this.prisma, {
      patientId,
      actorUserId: userId,
      action: "CAREGIVER_INVITE_REFRESHED",
      summary: `${formatUserLabel(actor)} gerou um novo link de convite para ${updated.email} (paciente «${patient?.name ?? ""}»).`,
    });
    return {
      id: updated.id,
      email: updated.email,
      expiresAt: updated.expiresAt.toISOString(),
      inviteUrl: buildCaregiverInviteUrl(updated.token),
    };
  }
}
