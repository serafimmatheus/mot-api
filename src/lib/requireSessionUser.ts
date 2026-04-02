import type { FastifyReply, FastifyRequest } from "fastify";

import { getSessionUser, type SessionUser } from "./getSessionUser.js";

declare module "fastify" {
  interface FastifyRequest {
    sessionUser?: SessionUser;
  }
}

export async function requireSessionUser(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const user = await getSessionUser(request);
  if (!user) {
    await reply.status(401).send({
      message: "Não autorizado",
      code: "UNAUTHORIZED",
    });
    return;
  }
  request.sessionUser = user;
}
