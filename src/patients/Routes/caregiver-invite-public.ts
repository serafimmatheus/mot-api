import type { FastifyPluginAsync } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";

import { sendDomainRouteError } from "../../lib/sendDomainRouteError.js";
import { ErrorSchema } from "../../schemas/ErrorSchema.js";
import type {
  AcceptCaregiverInvite,
  GetCaregiverInvitePreview,
} from "../UseCases/CaregiverInvitePublic.js";

const TokenParamsSchema = z.object({
  token: z.string().min(20),
});

const PreviewResponseSchema = z.object({
  email: z.string().email(),
  patientName: z.string(),
  expiresAt: z.string().datetime(),
});

const AcceptBodySchema = z.object({
  name: z.string().trim().min(1, "Informe seu nome"),
  password: z.string().min(8, "A senha deve ter pelo menos 8 caracteres"),
});

export const caregiverInvitePublicRoutes: FastifyPluginAsync<{
  getPreview: GetCaregiverInvitePreview;
  acceptInvite: AcceptCaregiverInvite;
}> = async (app, { getPreview, acceptInvite }) => {
  const zApp = app.withTypeProvider<ZodTypeProvider>();

  zApp.route({
    method: "GET",
    url: "/:token",
    schema: {
      operationId: "getCaregiverInvitePreview",
      tags: ["Caregiver invites"],
      params: TokenParamsSchema,
      response: {
        200: PreviewResponseSchema,
        400: ErrorSchema,
        403: ErrorSchema,
        404: ErrorSchema,
        409: ErrorSchema,
        500: ErrorSchema,
      },
    },
    handler: async (request, reply) => {
      try {
        const data = await getPreview.execute(request.params.token);
        return reply.status(200).send(data);
      } catch (error) {
        return sendDomainRouteError(app.log, reply, error);
      }
    },
  });

  zApp.route({
    method: "POST",
    url: "/:token/accept",
    schema: {
      operationId: "acceptCaregiverInvite",
      tags: ["Caregiver invites"],
      params: TokenParamsSchema,
      body: AcceptBodySchema,
      hide: true,
    },
    handler: async (request, reply) => {
      try {
        const res = await acceptInvite.execute(
          request.params.token,
          request.body.name,
          request.body.password,
          request,
        );

        reply.status(res.status);
        const cookies =
          typeof (res.headers as Headers & { getSetCookie?: () => string[] })
            .getSetCookie === "function"
            ? (res.headers as Headers & { getSetCookie: () => string[] }).getSetCookie()
            : (() => {
                const list: string[] = [];
                res.headers.forEach((value, key) => {
                  if (key.toLowerCase() === "set-cookie") list.push(value);
                });
                return list;
              })();
        for (const cookie of cookies) {
          reply.raw.appendHeader("Set-Cookie", cookie);
        }

        const text = await res.text();
        const ct = res.headers.get("content-type") ?? "application/json";
        reply.header("content-type", ct);

        if (!text.trim()) {
          return reply.send();
        }
        try {
          return reply.send(JSON.parse(text) as unknown);
        } catch {
          return reply.send(text);
        }
      } catch (error) {
        return sendDomainRouteError(app.log, reply, error);
      }
    },
  });
};
