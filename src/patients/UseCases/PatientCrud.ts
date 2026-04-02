import { ErrorNotFound } from "../../errors/ErrorNotFound.js";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { assertPatientCaregiverAccess } from "../../lib/assertPatientCaregiverAccess.js";
import {
  createActivityLog,
  formatUserLabel,
} from "../../lib/createActivityLog.js";

function toPatientDto(p: {
  id: string;
  name: string;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: p.id,
    name: p.name,
    notes: p.notes,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

export class ListPatients {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(userId: string) {
    const links = await this.prisma.patientCaregiver.findMany({
      where: { userId },
      include: { patient: true },
      orderBy: { patient: { name: "asc" } },
    });
    return { patients: links.map((l) => toPatientDto(l.patient)) };
  }
}

export class CreatePatient {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(userId: string, input: { name: string; notes?: string }) {
    const dto = await this.prisma.$transaction(async (tx) => {
      const patient = await tx.patient.create({
        data: {
          name: input.name.trim(),
          notes: input.notes?.trim() || null,
        },
      });
      await tx.patientCaregiver.create({
        data: { patientId: patient.id, userId },
      });
      return toPatientDto(patient);
    });
    const actor = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true },
    });
    await createActivityLog(this.prisma, {
      patientId: dto.id,
      actorUserId: userId,
      action: "PATIENT_CREATED",
      summary: `${formatUserLabel(actor)} cadastrou o paciente «${dto.name}».`,
    });
    return dto;
  }
}

export class GetPatient {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(userId: string, patientId: string) {
    await assertPatientCaregiverAccess(this.prisma, { userId, patientId });
    const patient = await this.prisma.patient.findUnique({
      where: { id: patientId },
    });
    if (!patient) throw new ErrorNotFound("Paciente não encontrado");
    return toPatientDto(patient);
  }
}

export class UpdatePatient {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(
    userId: string,
    patientId: string,
    input: { name?: string; notes?: string | null },
  ) {
    await assertPatientCaregiverAccess(this.prisma, { userId, patientId });
    const patient = await this.prisma.patient.update({
      where: { id: patientId },
      data: {
        ...(input.name !== undefined && { name: input.name.trim() }),
        ...(input.notes !== undefined && {
          notes:
            input.notes === null
              ? null
              : String(input.notes).trim() || null,
        }),
      },
    });
    const actor = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true },
    });
    await createActivityLog(this.prisma, {
      patientId,
      actorUserId: userId,
      action: "PATIENT_UPDATED",
      summary: `${formatUserLabel(actor)} atualizou os dados do paciente «${patient.name}».`,
    });
    return toPatientDto(patient);
  }
}

export class DeletePatient {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(userId: string, patientId: string) {
    await assertPatientCaregiverAccess(this.prisma, { userId, patientId });
    const existing = await this.prisma.patient.findUnique({
      where: { id: patientId },
      select: { name: true },
    });
    const actor = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true },
    });
    await createActivityLog(this.prisma, {
      patientId,
      actorUserId: userId,
      action: "PATIENT_DELETED",
      summary: `${formatUserLabel(actor)} excluiu o paciente «${existing?.name ?? patientId}».`,
    });
    await this.prisma.patient.delete({ where: { id: patientId } });
  }
}
