import { fromNodeHeaders } from "better-auth/node";
import type { FastifyRequest } from "fastify";

import { ErrorConflict } from "../../errors/ErrorConflict.js";
import { ErrorNotFound } from "../../errors/ErrorNotFound.js";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { auth } from "../../lib/auth.js";
import {
  createActivityLog,
  formatUserLabel,
} from "../../lib/createActivityLog.js";

function collectSetCookieHeaders(source: Headers): string[] {
  const extended = source as Headers & { getSetCookie?: () => string[] };
  if (typeof extended.getSetCookie === "function") {
    return extended.getSetCookie();
  }
  const list: string[] = [];
  source.forEach((value, key) => {
    if (key.toLowerCase() === "set-cookie") {
      list.push(value);
    }
  });
  return list;
}

export class GetCaregiverInvitePreview {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(token: string) {
    const row = await this.prisma.patientCaregiverInvite.findUnique({
      where: { token },
      include: { patient: { select: { name: true } } },
    });
    if (!row || row.expiresAt < new Date()) {
      throw new ErrorNotFound("Convite inválido ou expirado");
    }
    return {
      email: row.email,
      patientName: row.patient.name,
      expiresAt: row.expiresAt.toISOString(),
    };
  }
}

export class AcceptCaregiverInvite {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(
    token: string,
    name: string,
    password: string,
    request: FastifyRequest,
  ): Promise<Response> {
    const invite = await this.prisma.patientCaregiverInvite.findUnique({
      where: { token },
    });
    if (!invite || invite.expiresAt < new Date()) {
      throw new ErrorNotFound("Convite inválido ou expirado");
    }

    const existing = await this.prisma.user.findUnique({
      where: { email: invite.email },
    });
    if (existing) {
      throw new ErrorConflict(
        "Já existe uma conta com este e-mail. Entre com sua senha em Entrar.",
      );
    }

    const signUpResponse = await auth.api.signUpEmail({
      body: {
        name: name.trim(),
        email: invite.email,
        password,
      },
      headers: fromNodeHeaders(request.headers),
      asResponse: true,
    });

    const setCookies = collectSetCookieHeaders(signUpResponse.headers);

    if (!signUpResponse.ok) {
      return signUpResponse;
    }

    let userId: string;
    try {
      const payload = (await signUpResponse.json()) as {
        user?: { id: string };
      };
      userId = payload.user?.id ?? "";
      if (!userId) {
        throw new Error("missing user id");
      }
    } catch {
      return new Response(
        JSON.stringify({
          message: "Não foi possível concluir o cadastro. Tente novamente.",
        }),
        { status: 500, headers: { "content-type": "application/json" } },
      );
    }

    try {
      await this.prisma.$transaction([
        this.prisma.patientCaregiver.create({
          data: { patientId: invite.patientId, userId },
        }),
        this.prisma.patientCaregiverInvite.delete({
          where: { id: invite.id },
        }),
      ]);
    } catch {
      return new Response(
        JSON.stringify({
          message:
            "Sua conta foi criada, mas o vínculo com o paciente falhou. Entre em contato com quem convidou ou com o suporte.",
        }),
        { status: 500, headers: { "content-type": "application/json" } },
      );
    }

    const [newUser, patient] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { name: true, email: true },
      }),
      this.prisma.patient.findUnique({
        where: { id: invite.patientId },
        select: { name: true },
      }),
    ]);
    await createActivityLog(this.prisma, {
      patientId: invite.patientId,
      actorUserId: userId,
      action: "CAREGIVER_INVITE_ACCEPTED",
      summary: `${formatUserLabel(newUser)} aceitou o convite de cuidador para o paciente «${patient?.name ?? ""}».`,
      metadata: { email: invite.email },
    });

    const headers = new Headers();
    headers.set("content-type", "application/json");
    for (const c of setCookies) {
      headers.append("Set-Cookie", c);
    }

    return new Response(
      JSON.stringify({
        ok: true as const,
        userId,
        email: invite.email,
        patientId: invite.patientId,
      }),
      { status: 200, headers },
    );
  }
}
