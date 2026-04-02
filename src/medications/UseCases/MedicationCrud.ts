import { ErrorNotFound } from "../../errors/ErrorNotFound.js";
import { Prisma, type PrismaClient } from "../../generated/prisma/client.js";
import { CareEventType } from "../../generated/prisma/enums.js";
import { assertPatientCaregiverAccess } from "../../lib/assertPatientCaregiverAccess.js";
import {
  createActivityLog,
  formatUserLabel,
} from "../../lib/createActivityLog.js";

function toMedicationDto(m: {
  id: string;
  patientId: string;
  name: string;
  dosage: string;
  schedule: Prisma.JsonValue;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: m.id,
    patientId: m.patientId,
    name: m.name,
    dosage: m.dosage,
    schedule: m.schedule,
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
  };
}

export class ListMedications {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(userId: string, patientId: string) {
    await assertPatientCaregiverAccess(this.prisma, { userId, patientId });
    const medications = await this.prisma.medication.findMany({
      where: { patientId },
      orderBy: { name: "asc" },
    });
    return { medications: medications.map(toMedicationDto) };
  }
}

export class CreateMedication {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(
    userId: string,
    patientId: string,
    input: { name: string; dosage: string; schedule?: unknown },
  ) {
    await assertPatientCaregiverAccess(this.prisma, { userId, patientId });
    const medication = await this.prisma.medication.create({
      data: {
        patientId,
        name: input.name.trim(),
        dosage: input.dosage.trim(),
        ...(input.schedule !== undefined && {
          schedule: input.schedule as Prisma.InputJsonValue,
        }),
      },
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
      action: "MEDICATION_CREATED",
      summary: `${formatUserLabel(actor)} cadastrou o medicamento «${medication.name}» (${medication.dosage}) no paciente «${patient?.name ?? ""}».`,
    });
    return toMedicationDto(medication);
  }
}

export class UpdateMedication {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(
    userId: string,
    patientId: string,
    medicationId: string,
    input: {
      name?: string;
      dosage?: string;
      schedule?: unknown | null;
    },
  ) {
    await assertPatientCaregiverAccess(this.prisma, { userId, patientId });
    const existing = await this.prisma.medication.findFirst({
      where: { id: medicationId, patientId },
    });
    if (!existing) {
      throw new ErrorNotFound("Medicamento não encontrado para este paciente");
    }
    const data: Prisma.MedicationUpdateInput = {};
    if (input.name !== undefined) data.name = input.name.trim();
    if (input.dosage !== undefined) data.dosage = input.dosage.trim();
    if (input.schedule !== undefined) {
      data.schedule =
        input.schedule === null ? Prisma.DbNull : input.schedule;
    }
    const medication = await this.prisma.medication.update({
      where: { id: medicationId },
      data,
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
      action: "MEDICATION_UPDATED",
      summary: `${formatUserLabel(actor)} atualizou o medicamento «${medication.name}» no paciente «${patient?.name ?? ""}».`,
    });
    return toMedicationDto(medication);
  }
}

export class DeleteMedication {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(userId: string, patientId: string, medicationId: string) {
    await assertPatientCaregiverAccess(this.prisma, { userId, patientId });
    const existing = await this.prisma.medication.findFirst({
      where: { id: medicationId, patientId },
    });
    if (!existing) {
      throw new ErrorNotFound("Medicamento não encontrado para este paciente");
    }
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
      action: "MEDICATION_DELETED",
      summary: `${formatUserLabel(actor)} excluiu o medicamento «${existing.name}» do paciente «${patient?.name ?? ""}».`,
    });
    await this.prisma.medication.delete({ where: { id: medicationId } });
  }
}

export class ApplyMedication {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(
    userId: string,
    patientId: string,
    medicationId: string,
    input: { quantity?: number; notes?: string },
  ) {
    await assertPatientCaregiverAccess(this.prisma, { userId, patientId });
    const medication = await this.prisma.medication.findFirst({
      where: { id: medicationId, patientId },
    });
    if (!medication) {
      throw new ErrorNotFound("Medicamento não encontrado para este paciente");
    }
    const event = await this.prisma.careEvent.create({
      data: {
        patientId,
        type: CareEventType.MEDICATION_APPLIED,
        quantity: input.quantity,
        notes: input.notes,
        medicationId: medication.id,
        performedByUserId: userId,
      },
    });
    const actor = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true },
    });
    const patient = await this.prisma.patient.findUnique({
      where: { id: patientId },
      select: { name: true },
    });
    const qty =
      input.quantity != null ? ` (${input.quantity})` : "";
    await createActivityLog(this.prisma, {
      patientId,
      actorUserId: userId,
      action: "MEDICATION_APPLIED",
      summary: `${formatUserLabel(actor)} registrou aplicação do medicamento «${medication.name}»${qty} no paciente «${patient?.name ?? ""}».`,
    });
    return {
      careEventId: event.id,
      medicationId: medication.id,
      occurredAt: event.occurredAt.toISOString(),
    };
  }
}
