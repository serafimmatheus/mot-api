import type { FastifyPluginAsync } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";

import { requireSessionUser } from "../../lib/requireSessionUser.js";
import { sendDomainRouteError } from "../../lib/sendDomainRouteError.js";
import { ErrorSchema } from "../../schemas/ErrorSchema.js";
import type { ListActivityLog } from "../UseCases/ListActivityLog.js";

const ActivityLogItemSchema = z.object({
  id: z.string(),
  patientId: z.string(),
  patientName: z.string(),
  actorUserId: z.string(),
  actorLabel: z.string(),
  action: z.string(),
  summary: z.string(),
  createdAt: z.string(),
});

const ListActivityLogResponseSchema = z.object({
  items: z.array(ActivityLogItemSchema),
  page: z.number(),
  pageSize: z.number(),
  total: z.number(),
});

const ListActivityLogQuerySchema = z.object({
  patientId: z.string().optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(50).optional(),
});

const err = {
  401: ErrorSchema,
  403: ErrorSchema,
  500: ErrorSchema,
} as const;

type Options = {
  listActivityLog: ListActivityLog;
};

export const activityLogRoutes: FastifyPluginAsync<Options> = async (
  app,
  { listActivityLog },
) => {
  const zod = app.withTypeProvider<ZodTypeProvider>();
  zod.addHook("preHandler", requireSessionUser);

  zod.route({
    method: "GET",
    url: "/",
    schema: {
      operationId: "listActivityLog",
      tags: ["ActivityLog"],
      summary: "Listar registro de atividades (pacientes com acesso)",
      querystring: ListActivityLogQuerySchema,
      response: { 200: ListActivityLogResponseSchema, ...err },
    },
    handler: async (request, reply) => {
      const user = request.sessionUser!;
      try {
        const q = request.query;
        const result = await listActivityLog.execute(user.id, {
          patientId: q.patientId,
          page: q.page,
          pageSize: q.pageSize,
        });
        return reply.status(200).send(result);
      } catch (error) {
        return sendDomainRouteError(app.log, reply, error);
      }
    },
  });
};
