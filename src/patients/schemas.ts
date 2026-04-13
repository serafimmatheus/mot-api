import z from "zod";

import { CareEventType } from "../generated/prisma/enums.js";

const careEventTypeEnum = z.enum([
  CareEventType.SUPPLY_CONSUMED,
  CareEventType.MEDICATION_APPLIED,
]);

export const PatientIdParamsSchema = z.object({
  patientId: z.string().cuid(),
});

export const PatientSupplyParamsSchema = z.object({
  patientId: z.string().cuid(),
  supplyId: z.string().cuid(),
});

export const PatientMedicationParamsSchema = z.object({
  patientId: z.string().cuid(),
  medicationId: z.string().cuid(),
});

export const RemoveCaregiverParamsSchema = z.object({
  patientId: z.string().cuid(),
  userId: z.string(),
});

export const PatientDtoSchema = z.object({
  id: z.string().cuid(),
  name: z.string(),
  notes: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const ListPatientsResponseSchema = z.object({
  patients: z.array(PatientDtoSchema),
});

export const CreatePatientBodySchema = z.object({
  name: z.string().trim().min(1, "Nome é obrigatório"),
  notes: z.string().max(5000).optional(),
});

export const UpdatePatientBodySchema = z.object({
  name: z.string().trim().min(1).optional(),
  notes: z.string().max(5000).nullable().optional(),
});

export const CaregiverDtoSchema = z.object({
  userId: z.string(),
  email: z.string().email(),
  name: z.string().nullable(),
  image: z.string().nullable().optional(),
  linkedAt: z.string().datetime(),
});

export const ListCaregiversResponseSchema = z.object({
  caregivers: z.array(CaregiverDtoSchema),
});

export const AddCaregiverBodySchema = z.object({
  email: z.string().trim().email(),
});

export const AddCaregiverResponseSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("linked"),
    userId: z.string(),
    email: z.string(),
    name: z.string().nullable(),
  }),
  z.object({
    status: z.literal("pending_invite"),
    email: z.string(),
    inviteUrl: z.string().url(),
  }),
]);

export const PatientInviteIdParamsSchema = z.object({
  patientId: z.string().cuid(),
  inviteId: z.string().cuid(),
});

export const CaregiverInviteDtoSchema = z.object({
  id: z.string().cuid(),
  email: z.string().email(),
  expiresAt: z.string().datetime(),
  createdAt: z.string().datetime(),
  inviteUrl: z.string().url(),
  status: z.enum(["pending", "expired"]),
});

export const ListCaregiverInvitesResponseSchema = z.object({
  invites: z.array(CaregiverInviteDtoSchema),
});

export const RefreshCaregiverInviteResponseSchema = z.object({
  id: z.string().cuid(),
  email: z.string().email(),
  expiresAt: z.string().datetime(),
  inviteUrl: z.string().url(),
});

export const SupplyDtoSchema = z.object({
  id: z.string().cuid(),
  patientId: z.string().cuid(),
  name: z.string(),
  currentQuantity: z.number().int(),
  minQuantity: z.number().int(),
  unit: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const ListSuppliesResponseSchema = z.object({
  supplies: z.array(SupplyDtoSchema),
});

export const CreateSupplyBodySchema = z.object({
  name: z.string().trim().min(1),
  currentQuantity: z.coerce.number().int().min(0).optional(),
  minQuantity: z.coerce.number().int().min(0).optional(),
  unit: z.string().trim().min(1),
});

export const UpdateSupplyBodySchema = z.object({
  name: z.string().trim().min(1).optional(),
  currentQuantity: z.coerce.number().int().min(0).optional(),
  minQuantity: z.coerce.number().int().min(0).optional(),
  unit: z.string().trim().min(1).optional(),
});

export const MedicationDtoSchema = z.object({
  id: z.string().cuid(),
  patientId: z.string().cuid(),
  name: z.string(),
  dosage: z.string(),
  schedule: z.unknown().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const ListMedicationsResponseSchema = z.object({
  medications: z.array(MedicationDtoSchema),
});

const medicationTimeHhmm = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:mm em 24h");

export const MedicationScheduleSlotSchema = z.object({
  time: medicationTimeHhmm,
  label: z.string().trim().max(40).optional(),
});

export const MedicationScheduleBodySchema = z
  .object({
    times: z.array(medicationTimeHhmm).max(48).optional(),
    slots: z.array(MedicationScheduleSlotSchema).max(48).optional(),
    administrationRoute: z.enum(["ORAL", "SUBCUTANEOUS"]).optional(),
    observations: z.string().max(2000).optional(),
    form: z.string().max(120).optional(),
    frequencyLabel: z.string().max(120).optional(),
    reminderNote: z.string().max(2000).optional(),
    instructions: z
      .object({
        food: z.string().max(2000).optional(),
        ingestion: z.string().max(2000).optional(),
      })
      .optional(),
  })
  .passthrough();

export const CreateMedicationStockBodySchema = z.object({
  currentQuantity: z.coerce.number().int().min(0),
  minQuantity: z.coerce.number().int().min(0),
  unit: z.string().trim().min(1).max(32),
});

export const CreateMedicationBodySchema = z.object({
  name: z.string().trim().min(1),
  dosage: z.string().trim().min(1),
  schedule: MedicationScheduleBodySchema.optional(),
  stock: CreateMedicationStockBodySchema.optional(),
});

export const UpdateMedicationBodySchema = z.object({
  name: z.string().trim().min(1).optional(),
  dosage: z.string().trim().min(1).optional(),
  schedule: MedicationScheduleBodySchema.nullable().optional(),
});

export const ApplyMedicationBodySchema = z.object({
  quantity: z.coerce.number().int().positive().optional(),
  notes: z.string().max(2000).optional(),
});

export const ApplyMedicationResponseSchema = z.object({
  careEventId: z.string().cuid(),
  medicationId: z.string().cuid(),
  occurredAt: z.string().datetime(),
});

export const CareEventPerformedBySchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  email: z.string(),
});

export const CareEventDtoSchema = z.object({
  id: z.string().cuid(),
  patientId: z.string().cuid(),
  type: careEventTypeEnum,
  quantity: z.number().int().nullable(),
  notes: z.string().nullable(),
  supplyId: z.string().cuid().nullable(),
  medicationId: z.string().cuid().nullable(),
  performedByUserId: z.string(),
  performedBy: CareEventPerformedBySchema,
  occurredAt: z.string().datetime(),
  createdAt: z.string().datetime(),
});

export const ListCareEventsQuerySchema = z.object({
  type: careEventTypeEnum.optional(),
  medicationId: z.string().cuid().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
});

export const ListCareEventsResponseSchema = z.object({
  careEvents: z.array(CareEventDtoSchema),
});

export const OkResponseSchema = z.object({ ok: z.literal(true) });
