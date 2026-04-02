import type { FastifyPluginAsync } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";

import type { ListCareEvents } from "../../care-events/UseCases/ListCareEvents.js";
import { requireSessionUser } from "../../lib/requireSessionUser.js";
import { sendDomainRouteError } from "../../lib/sendDomainRouteError.js";
import type {
  ApplyMedication,
  CreateMedication,
  DeleteMedication,
  ListMedications,
  UpdateMedication,
} from "../../medications/UseCases/MedicationCrud.js";
import { ErrorSchema } from "../../schemas/ErrorSchema.js";
import type {
  CreateSupply,
  DeleteSupply,
  ListSupplies,
  UpdateSupply,
} from "../../supplies/UseCases/SupplyCrud.js";
import {
  AddCaregiverBodySchema,
  AddCaregiverResponseSchema,
  ApplyMedicationBodySchema,
  ApplyMedicationResponseSchema,
  CreateMedicationBodySchema,
  CreatePatientBodySchema,
  CreateSupplyBodySchema,
  ListCareEventsQuerySchema,
  ListCareEventsResponseSchema,
  ListCaregiverInvitesResponseSchema,
  ListCaregiversResponseSchema,
  ListMedicationsResponseSchema,
  ListPatientsResponseSchema,
  ListSuppliesResponseSchema,
  MedicationDtoSchema,
  OkResponseSchema,
  PatientDtoSchema,
  PatientIdParamsSchema,
  PatientInviteIdParamsSchema,
  PatientMedicationParamsSchema,
  PatientSupplyParamsSchema,
  RefreshCaregiverInviteResponseSchema,
  RemoveCaregiverParamsSchema,
  SupplyDtoSchema,
  UpdateMedicationBodySchema,
  UpdatePatientBodySchema,
  UpdateSupplyBodySchema,
} from "../schemas.js";
import type {
  AddPatientCaregiver,
  ListPatientCaregiverInvites,
  ListPatientCaregivers,
  RefreshPatientCaregiverInvite,
  RemovePatientCaregiver,
  RevokePatientCaregiverInvite,
} from "../UseCases/Caregivers.js";
import type {
  CreatePatient,
  DeletePatient,
  GetPatient,
  ListPatients,
  UpdatePatient,
} from "../UseCases/PatientCrud.js";

const err = {
  400: ErrorSchema,
  401: ErrorSchema,
  403: ErrorSchema,
  404: ErrorSchema,
  409: ErrorSchema,
  500: ErrorSchema,
} as const;

export type CareRouteDeps = {
  listPatients: ListPatients;
  createPatient: CreatePatient;
  getPatient: GetPatient;
  updatePatient: UpdatePatient;
  deletePatient: DeletePatient;
  listPatientCaregivers: ListPatientCaregivers;
  addPatientCaregiver: AddPatientCaregiver;
  removePatientCaregiver: RemovePatientCaregiver;
  listPatientCaregiverInvites: ListPatientCaregiverInvites;
  refreshPatientCaregiverInvite: RefreshPatientCaregiverInvite;
  revokePatientCaregiverInvite: RevokePatientCaregiverInvite;
  listSupplies: ListSupplies;
  createSupply: CreateSupply;
  updateSupply: UpdateSupply;
  deleteSupply: DeleteSupply;
  listMedications: ListMedications;
  createMedication: CreateMedication;
  updateMedication: UpdateMedication;
  deleteMedication: DeleteMedication;
  applyMedication: ApplyMedication;
  listCareEvents: ListCareEvents;
};

interface PatientRoutesOptions {
  care: CareRouteDeps;
}

export const patientRoutes: FastifyPluginAsync<PatientRoutesOptions> = async (
  app,
  { care: c },
) => {
  const z = app.withTypeProvider<ZodTypeProvider>();
  z.addHook("preHandler", requireSessionUser);

  z.route({
    method: "GET",
    url: "/",
    schema: {
      operationId: "listPatients",
      tags: ["Patients"],
      summary: "Listar pacientes do usuário",
      response: { 200: ListPatientsResponseSchema, 401: ErrorSchema, 500: ErrorSchema },
    },
    handler: async (request, reply) => {
      const user = request.sessionUser!;
      try {
        const result = await c.listPatients.execute(user.id);
        return reply.status(200).send(result);
      } catch (error) {
        return sendDomainRouteError(app.log, reply, error);
      }
    },
  });

  z.route({
    method: "POST",
    url: "/",
    schema: {
      operationId: "createPatient",
      tags: ["Patients"],
      summary: "Criar paciente e vincular como cuidador",
      body: CreatePatientBodySchema,
      response: { 201: PatientDtoSchema, 401: ErrorSchema, 500: ErrorSchema },
    },
    handler: async (request, reply) => {
      const user = request.sessionUser!;
      try {
        const result = await c.createPatient.execute(user.id, request.body);
        return reply.status(201).send(result);
      } catch (error) {
        return sendDomainRouteError(app.log, reply, error);
      }
    },
  });

  z.route({
    method: "GET",
    url: "/:patientId/caregivers",
    schema: {
      operationId: "listPatientCaregivers",
      tags: ["Patients", "Caregivers"],
      params: PatientIdParamsSchema,
      response: { 200: ListCaregiversResponseSchema, ...err },
    },
    handler: async (request, reply) => {
      const user = request.sessionUser!;
      try {
        const result = await c.listPatientCaregivers.execute(
          user.id,
          request.params.patientId,
        );
        return reply.status(200).send(result);
      } catch (error) {
        return sendDomainRouteError(app.log, reply, error);
      }
    },
  });

  z.route({
    method: "POST",
    url: "/:patientId/caregivers",
    schema: {
      operationId: "addPatientCaregiver",
      tags: ["Patients", "Caregivers"],
      params: PatientIdParamsSchema,
      body: AddCaregiverBodySchema,
      response: { 201: AddCaregiverResponseSchema, ...err },
    },
    handler: async (request, reply) => {
      const user = request.sessionUser!;
      try {
        const result = await c.addPatientCaregiver.execute(
          user.id,
          request.params.patientId,
          request.body.email,
        );
        return reply.status(201).send(result);
      } catch (error) {
        return sendDomainRouteError(app.log, reply, error);
      }
    },
  });

  z.route({
    method: "DELETE",
    url: "/:patientId/caregivers/:userId",
    schema: {
      operationId: "removePatientCaregiver",
      tags: ["Patients", "Caregivers"],
      params: RemoveCaregiverParamsSchema,
      response: { 200: OkResponseSchema, ...err },
    },
    handler: async (request, reply) => {
      const user = request.sessionUser!;
      try {
        await c.removePatientCaregiver.execute(
          user.id,
          request.params.patientId,
          request.params.userId,
        );
        return reply.status(200).send({ ok: true as const });
      } catch (error) {
        return sendDomainRouteError(app.log, reply, error);
      }
    },
  });

  z.route({
    method: "GET",
    url: "/:patientId/caregiver-invites",
    schema: {
      operationId: "listPatientCaregiverInvites",
      tags: ["Patients", "Caregivers"],
      params: PatientIdParamsSchema,
      response: { 200: ListCaregiverInvitesResponseSchema, ...err },
    },
    handler: async (request, reply) => {
      const user = request.sessionUser!;
      try {
        const result = await c.listPatientCaregiverInvites.execute(
          user.id,
          request.params.patientId,
        );
        return reply.status(200).send(result);
      } catch (error) {
        return sendDomainRouteError(app.log, reply, error);
      }
    },
  });

  z.route({
    method: "POST",
    url: "/:patientId/caregiver-invites/:inviteId/refresh",
    schema: {
      operationId: "refreshPatientCaregiverInvite",
      tags: ["Patients", "Caregivers"],
      params: PatientInviteIdParamsSchema,
      response: { 200: RefreshCaregiverInviteResponseSchema, ...err },
    },
    handler: async (request, reply) => {
      const user = request.sessionUser!;
      try {
        const result = await c.refreshPatientCaregiverInvite.execute(
          user.id,
          request.params.patientId,
          request.params.inviteId,
        );
        return reply.status(200).send(result);
      } catch (error) {
        return sendDomainRouteError(app.log, reply, error);
      }
    },
  });

  z.route({
    method: "DELETE",
    url: "/:patientId/caregiver-invites/:inviteId",
    schema: {
      operationId: "revokePatientCaregiverInvite",
      tags: ["Patients", "Caregivers"],
      params: PatientInviteIdParamsSchema,
      response: { 200: OkResponseSchema, ...err },
    },
    handler: async (request, reply) => {
      const user = request.sessionUser!;
      try {
        await c.revokePatientCaregiverInvite.execute(
          user.id,
          request.params.patientId,
          request.params.inviteId,
        );
        return reply.status(200).send({ ok: true as const });
      } catch (error) {
        return sendDomainRouteError(app.log, reply, error);
      }
    },
  });

  z.route({
    method: "GET",
    url: "/:patientId/supplies",
    schema: {
      operationId: "listSupplies",
      tags: ["Patients", "Supplies"],
      params: PatientIdParamsSchema,
      response: { 200: ListSuppliesResponseSchema, ...err },
    },
    handler: async (request, reply) => {
      const user = request.sessionUser!;
      try {
        const result = await c.listSupplies.execute(
          user.id,
          request.params.patientId,
        );
        return reply.status(200).send(result);
      } catch (error) {
        return sendDomainRouteError(app.log, reply, error);
      }
    },
  });

  z.route({
    method: "POST",
    url: "/:patientId/supplies",
    schema: {
      operationId: "createSupply",
      tags: ["Patients", "Supplies"],
      params: PatientIdParamsSchema,
      body: CreateSupplyBodySchema,
      response: { 201: SupplyDtoSchema, ...err },
    },
    handler: async (request, reply) => {
      const user = request.sessionUser!;
      try {
        const result = await c.createSupply.execute(
          user.id,
          request.params.patientId,
          request.body,
        );
        return reply.status(201).send(result);
      } catch (error) {
        return sendDomainRouteError(app.log, reply, error);
      }
    },
  });

  z.route({
    method: "PATCH",
    url: "/:patientId/supplies/:supplyId",
    schema: {
      operationId: "updateSupply",
      tags: ["Patients", "Supplies"],
      params: PatientSupplyParamsSchema,
      body: UpdateSupplyBodySchema,
      response: { 200: SupplyDtoSchema, ...err },
    },
    handler: async (request, reply) => {
      const user = request.sessionUser!;
      try {
        const result = await c.updateSupply.execute(
          user.id,
          request.params.patientId,
          request.params.supplyId,
          request.body,
        );
        return reply.status(200).send(result);
      } catch (error) {
        return sendDomainRouteError(app.log, reply, error);
      }
    },
  });

  z.route({
    method: "DELETE",
    url: "/:patientId/supplies/:supplyId",
    schema: {
      operationId: "deleteSupply",
      tags: ["Patients", "Supplies"],
      params: PatientSupplyParamsSchema,
      response: { 200: OkResponseSchema, ...err },
    },
    handler: async (request, reply) => {
      const user = request.sessionUser!;
      try {
        await c.deleteSupply.execute(
          user.id,
          request.params.patientId,
          request.params.supplyId,
        );
        return reply.status(200).send({ ok: true as const });
      } catch (error) {
        return sendDomainRouteError(app.log, reply, error);
      }
    },
  });

  z.route({
    method: "GET",
    url: "/:patientId/medications",
    schema: {
      operationId: "listMedications",
      tags: ["Patients", "Medications"],
      params: PatientIdParamsSchema,
      response: { 200: ListMedicationsResponseSchema, ...err },
    },
    handler: async (request, reply) => {
      const user = request.sessionUser!;
      try {
        const result = await c.listMedications.execute(
          user.id,
          request.params.patientId,
        );
        return reply.status(200).send(result);
      } catch (error) {
        return sendDomainRouteError(app.log, reply, error);
      }
    },
  });

  z.route({
    method: "POST",
    url: "/:patientId/medications",
    schema: {
      operationId: "createMedication",
      tags: ["Patients", "Medications"],
      params: PatientIdParamsSchema,
      body: CreateMedicationBodySchema,
      response: { 201: MedicationDtoSchema, ...err },
    },
    handler: async (request, reply) => {
      const user = request.sessionUser!;
      try {
        const result = await c.createMedication.execute(
          user.id,
          request.params.patientId,
          request.body,
        );
        return reply.status(201).send(result);
      } catch (error) {
        return sendDomainRouteError(app.log, reply, error);
      }
    },
  });

  z.route({
    method: "PATCH",
    url: "/:patientId/medications/:medicationId",
    schema: {
      operationId: "updateMedication",
      tags: ["Patients", "Medications"],
      params: PatientMedicationParamsSchema,
      body: UpdateMedicationBodySchema,
      response: { 200: MedicationDtoSchema, ...err },
    },
    handler: async (request, reply) => {
      const user = request.sessionUser!;
      try {
        const result = await c.updateMedication.execute(
          user.id,
          request.params.patientId,
          request.params.medicationId,
          request.body,
        );
        return reply.status(200).send(result);
      } catch (error) {
        return sendDomainRouteError(app.log, reply, error);
      }
    },
  });

  z.route({
    method: "DELETE",
    url: "/:patientId/medications/:medicationId",
    schema: {
      operationId: "deleteMedication",
      tags: ["Patients", "Medications"],
      params: PatientMedicationParamsSchema,
      response: { 200: OkResponseSchema, ...err },
    },
    handler: async (request, reply) => {
      const user = request.sessionUser!;
      try {
        await c.deleteMedication.execute(
          user.id,
          request.params.patientId,
          request.params.medicationId,
        );
        return reply.status(200).send({ ok: true as const });
      } catch (error) {
        return sendDomainRouteError(app.log, reply, error);
      }
    },
  });

  z.route({
    method: "POST",
    url: "/:patientId/medications/:medicationId/apply",
    schema: {
      operationId: "applyMedication",
      tags: ["Patients", "Medications"],
      params: PatientMedicationParamsSchema,
      body: ApplyMedicationBodySchema,
      response: { 201: ApplyMedicationResponseSchema, ...err },
    },
    handler: async (request, reply) => {
      const user = request.sessionUser!;
      try {
        const result = await c.applyMedication.execute(
          user.id,
          request.params.patientId,
          request.params.medicationId,
          request.body,
        );
        return reply.status(201).send(result);
      } catch (error) {
        return sendDomainRouteError(app.log, reply, error);
      }
    },
  });

  z.route({
    method: "GET",
    url: "/:patientId/care-events",
    schema: {
      operationId: "listCareEvents",
      tags: ["Patients", "CareEvents"],
      params: PatientIdParamsSchema,
      querystring: ListCareEventsQuerySchema,
      response: { 200: ListCareEventsResponseSchema, ...err },
    },
    handler: async (request, reply) => {
      const user = request.sessionUser!;
      try {
        const result = await c.listCareEvents.execute(
          user.id,
          request.params.patientId,
          request.query,
        );
        return reply.status(200).send(result);
      } catch (error) {
        return sendDomainRouteError(app.log, reply, error);
      }
    },
  });

  z.route({
    method: "GET",
    url: "/:patientId",
    schema: {
      operationId: "getPatient",
      tags: ["Patients"],
      params: PatientIdParamsSchema,
      response: { 200: PatientDtoSchema, ...err },
    },
    handler: async (request, reply) => {
      const user = request.sessionUser!;
      try {
        const result = await c.getPatient.execute(
          user.id,
          request.params.patientId,
        );
        return reply.status(200).send(result);
      } catch (error) {
        return sendDomainRouteError(app.log, reply, error);
      }
    },
  });

  z.route({
    method: "PATCH",
    url: "/:patientId",
    schema: {
      operationId: "updatePatient",
      tags: ["Patients"],
      params: PatientIdParamsSchema,
      body: UpdatePatientBodySchema,
      response: { 200: PatientDtoSchema, ...err },
    },
    handler: async (request, reply) => {
      const user = request.sessionUser!;
      try {
        const result = await c.updatePatient.execute(
          user.id,
          request.params.patientId,
          request.body,
        );
        return reply.status(200).send(result);
      } catch (error) {
        return sendDomainRouteError(app.log, reply, error);
      }
    },
  });

  z.route({
    method: "DELETE",
    url: "/:patientId",
    schema: {
      operationId: "deletePatient",
      tags: ["Patients"],
      params: PatientIdParamsSchema,
      response: { 200: OkResponseSchema, ...err },
    },
    handler: async (request, reply) => {
      const user = request.sessionUser!;
      try {
        await c.deletePatient.execute(user.id, request.params.patientId);
        return reply.status(200).send({ ok: true as const });
      } catch (error) {
        return sendDomainRouteError(app.log, reply, error);
      }
    },
  });
};
