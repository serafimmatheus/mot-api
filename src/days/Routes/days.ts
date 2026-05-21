import type { FastifyPluginAsync } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";

import { requireSessionUser } from "../../lib/requireSessionUser.js";
import { sendDomainRouteError } from "../../lib/sendDomainRouteError.js";
import { ErrorSchema } from "../../schemas/ErrorSchema.js";
import {
  CreateTaskBodySchema,
  CreateWorkDayBodySchema,
  ListWorkDaysResponseSchema,
  OkResponseSchema,
  TaskIdParamsSchema,
  TaskResponseSchema,
  UpdateTaskBodySchema,
  UpdateWorkDayBodySchema,
  WorkDayIdParamsSchema,
  WorkDayResponseSchema,
} from "../schemas.js";
import type {
  CreateTask,
  CreateWorkDay,
  DeleteTask,
  DeleteWorkDay,
  GetWorkDay,
  ListWorkDays,
  UpdateTask,
  UpdateWorkDay,
} from "../UseCases/WorkDayCrud.js";

const err = {
  400: ErrorSchema,
  401: ErrorSchema,
  404: ErrorSchema,
  409: ErrorSchema,
  500: ErrorSchema,
} as const;

export type DayRouteDeps = {
  listWorkDays: ListWorkDays;
  createWorkDay: CreateWorkDay;
  getWorkDay: GetWorkDay;
  updateWorkDay: UpdateWorkDay;
  deleteWorkDay: DeleteWorkDay;
  createTask: CreateTask;
  updateTask: UpdateTask;
  deleteTask: DeleteTask;
};

export const dayRoutes: FastifyPluginAsync<DayRouteDeps> = async (app, deps) => {
  app.addHook("preHandler", requireSessionUser);

  app.withTypeProvider<ZodTypeProvider>().route({
    method: "GET",
    url: "/",
    schema: {
      operationId: "listWorkDays",
      tags: ["Dias"],
      response: { 200: ListWorkDaysResponseSchema, ...err },
    },
    handler: async (request, reply) => {
      try {
        const days = await deps.listWorkDays.execute(request.sessionUser!.id);
        return reply.send({ days });
      } catch (error) {
        return sendDomainRouteError(app.log, reply, error);
      }
    },
  });

  app.withTypeProvider<ZodTypeProvider>().route({
    method: "POST",
    url: "/",
    schema: {
      operationId: "createWorkDay",
      tags: ["Dias"],
      body: CreateWorkDayBodySchema,
      response: { 201: WorkDayResponseSchema, ...err },
    },
    handler: async (request, reply) => {
      try {
        const day = await deps.createWorkDay.execute(
          request.sessionUser!.id,
          request.body,
        );
        return reply.status(201).send({ day });
      } catch (error) {
        if (
          error instanceof Error &&
          "code" in error &&
          (error as { code: string }).code === "P2002"
        ) {
          return reply.status(409).send({
            message: "Já existe um dia com essa data",
            code: "CONFLICT",
          });
        }
        return sendDomainRouteError(app.log, reply, error);
      }
    },
  });

  app.withTypeProvider<ZodTypeProvider>().route({
    method: "GET",
    url: "/:dayId",
    schema: {
      operationId: "getWorkDay",
      tags: ["Dias"],
      params: WorkDayIdParamsSchema,
      response: { 200: WorkDayResponseSchema, ...err },
    },
    handler: async (request, reply) => {
      try {
        const day = await deps.getWorkDay.execute(
          request.sessionUser!.id,
          request.params.dayId,
        );
        if (!day) {
          return reply.status(404).send({
            message: "Dia não encontrado",
            code: "NOT_FOUND",
          });
        }
        return reply.send({ day });
      } catch (error) {
        return sendDomainRouteError(app.log, reply, error);
      }
    },
  });

  app.withTypeProvider<ZodTypeProvider>().route({
    method: "PATCH",
    url: "/:dayId",
    schema: {
      operationId: "updateWorkDay",
      tags: ["Dias"],
      params: WorkDayIdParamsSchema,
      body: UpdateWorkDayBodySchema,
      response: { 200: WorkDayResponseSchema, ...err },
    },
    handler: async (request, reply) => {
      try {
        const day = await deps.updateWorkDay.execute(
          request.sessionUser!.id,
          request.params.dayId,
          request.body,
        );
        if (!day) {
          return reply.status(404).send({
            message: "Dia não encontrado",
            code: "NOT_FOUND",
          });
        }
        return reply.send({ day });
      } catch (error) {
        if (
          error instanceof Error &&
          "code" in error &&
          (error as { code: string }).code === "P2002"
        ) {
          return reply.status(409).send({
            message: "Já existe um dia com essa data",
            code: "CONFLICT",
          });
        }
        return sendDomainRouteError(app.log, reply, error);
      }
    },
  });

  app.withTypeProvider<ZodTypeProvider>().route({
    method: "DELETE",
    url: "/:dayId",
    schema: {
      operationId: "deleteWorkDay",
      tags: ["Dias"],
      params: WorkDayIdParamsSchema,
      response: { 200: OkResponseSchema, ...err },
    },
    handler: async (request, reply) => {
      try {
        const ok = await deps.deleteWorkDay.execute(
          request.sessionUser!.id,
          request.params.dayId,
        );
        if (!ok) {
          return reply.status(404).send({
            message: "Dia não encontrado",
            code: "NOT_FOUND",
          });
        }
        return reply.send({ ok: true as const });
      } catch (error) {
        return sendDomainRouteError(app.log, reply, error);
      }
    },
  });

  app.withTypeProvider<ZodTypeProvider>().route({
    method: "POST",
    url: "/:dayId/tasks",
    schema: {
      operationId: "createTask",
      tags: ["Tarefas"],
      params: WorkDayIdParamsSchema,
      body: CreateTaskBodySchema,
      response: { 201: TaskResponseSchema, ...err },
    },
    handler: async (request, reply) => {
      try {
        const task = await deps.createTask.execute(
          request.sessionUser!.id,
          request.params.dayId,
          request.body,
        );
        if (!task) {
          return reply.status(404).send({
            message: "Dia não encontrado",
            code: "NOT_FOUND",
          });
        }
        return reply.status(201).send({ task });
      } catch (error) {
        return sendDomainRouteError(app.log, reply, error);
      }
    },
  });

  app.withTypeProvider<ZodTypeProvider>().route({
    method: "PATCH",
    url: "/tasks/:taskId",
    schema: {
      operationId: "updateTask",
      tags: ["Tarefas"],
      params: TaskIdParamsSchema,
      body: UpdateTaskBodySchema,
      response: { 200: TaskResponseSchema, ...err },
    },
    handler: async (request, reply) => {
      try {
        const task = await deps.updateTask.execute(
          request.sessionUser!.id,
          request.params.taskId,
          request.body,
        );
        if (!task) {
          return reply.status(404).send({
            message: "Tarefa não encontrada",
            code: "NOT_FOUND",
          });
        }
        return reply.send({ task });
      } catch (error) {
        return sendDomainRouteError(app.log, reply, error);
      }
    },
  });

  app.withTypeProvider<ZodTypeProvider>().route({
    method: "DELETE",
    url: "/tasks/:taskId",
    schema: {
      operationId: "deleteTask",
      tags: ["Tarefas"],
      params: TaskIdParamsSchema,
      response: { 200: OkResponseSchema, ...err },
    },
    handler: async (request, reply) => {
      try {
        const ok = await deps.deleteTask.execute(
          request.sessionUser!.id,
          request.params.taskId,
        );
        if (!ok) {
          return reply.status(404).send({
            message: "Tarefa não encontrada",
            code: "NOT_FOUND",
          });
        }
        return reply.send({ ok: true as const });
      } catch (error) {
        return sendDomainRouteError(app.log, reply, error);
      }
    },
  });
};
