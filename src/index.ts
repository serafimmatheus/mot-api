import "dotenv/config";

import fastifyCors from "@fastify/cors";
import fastifySwagger from "@fastify/swagger";
import fastifyApiReference from "@scalar/fastify-api-reference";
import Fastify from "fastify";
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
  ZodTypeProvider,
} from "fastify-type-provider-zod";

import { ListCareEvents } from "./care-events/UseCases/ListCareEvents.js";
import { auth } from "./lib/auth.js";
import { prisma } from "./lib/db.js";
import {
  ApplyMedication,
  CreateMedication,
  DeleteMedication,
  ListMedications,
  UpdateMedication,
} from "./medications/UseCases/MedicationCrud.js";
import { patientRoutes } from "./patients/Routes/patients.js";
import {
  AddPatientCaregiver,
  ListPatientCaregivers,
  RemovePatientCaregiver,
} from "./patients/UseCases/Caregivers.js";
import {
  CreatePatient,
  DeletePatient,
  GetPatient,
  ListPatients,
  UpdatePatient,
} from "./patients/UseCases/PatientCrud.js";
import { suppliesRoutes } from "./supplies/Routes/supplies.js";
import { ConsumeSupply } from "./supplies/UseCases/ConsumeSupply.js";
import {
  CreateSupply,
  DeleteSupply,
  ListSupplies,
  UpdateSupply,
} from "./supplies/UseCases/SupplyCrud.js";

const app = Fastify({
  logger: true,
});

app.setValidatorCompiler(validatorCompiler);
app.setSerializerCompiler(serializerCompiler);

await app.register(fastifySwagger, {
  openapi: {
    info: {
      title: "Cuidar Juntos API",
      description:
        "API de gestão de cuidados familiares (pacientes, insumos, medicamentos).",
      version: "1.0.0",
    },
    servers: [
      {
        description: "Localhost",
        url: `http://localhost:${process.env.PORT || 5555}`,
      },
    ],
  },
  transform: jsonSchemaTransform,
});

await app.register(fastifyCors, {
  origin: [
    `http://localhost:${process.env.PORT || 5555}`,
    process.env.BETTER_AUTH_TRUSTED_ORIGIN || "http://localhost:3000",
    "http://localhost:3000",
  ],
  credentials: true,
});

await app.register(fastifyApiReference, {
  routePrefix: "/api",
  configuration: {
    sources: [
      {
        title: "Cuidar Juntos API",
        slug: "cuidar-juntos-api",
        url: "/swagger.json",
      },
      {
        title: "Auth API",
        slug: "auth-api",
        url: "/api/auth/open-api/generate-schema",
      },
    ],
  },
});

const care = {
  listPatients: new ListPatients(prisma),
  createPatient: new CreatePatient(prisma),
  getPatient: new GetPatient(prisma),
  updatePatient: new UpdatePatient(prisma),
  deletePatient: new DeletePatient(prisma),
  listPatientCaregivers: new ListPatientCaregivers(prisma),
  addPatientCaregiver: new AddPatientCaregiver(prisma),
  removePatientCaregiver: new RemovePatientCaregiver(prisma),
  listSupplies: new ListSupplies(prisma),
  createSupply: new CreateSupply(prisma),
  updateSupply: new UpdateSupply(prisma),
  deleteSupply: new DeleteSupply(prisma),
  listMedications: new ListMedications(prisma),
  createMedication: new CreateMedication(prisma),
  updateMedication: new UpdateMedication(prisma),
  deleteMedication: new DeleteMedication(prisma),
  applyMedication: new ApplyMedication(prisma),
  listCareEvents: new ListCareEvents(prisma),
};

const consumeSupply = new ConsumeSupply(prisma);

await app.register(patientRoutes, {
  prefix: "/patients",
  care,
});

await app.register(suppliesRoutes, {
  prefix: "/supplies",
  consumeSupply,
});

app.withTypeProvider<ZodTypeProvider>().route({
  method: "GET",
  url: "/swagger.json",
  schema: {
    operationId: "getSwaggerJson",
    hide: true,
  },
  handler: async () => {
    return app.swagger();
  },
});

app.route({
  method: ["GET", "POST"],
  url: "/api/auth/*",
  schema: {
    hide: true,
  },
  async handler(request, reply) {
    try {
      const url = new URL(request.url, `http://${request.headers.host}`);

      const headers = new Headers();
      Object.entries(request.headers).forEach(([key, value]) => {
        if (value) headers.append(key, value.toString());
      });
      const req = new Request(url.toString(), {
        method: request.method,
        headers,
        ...(request.body ? { body: JSON.stringify(request.body) } : {}),
      });
      const response = await auth.handler(req);
      reply.status(response.status);
      response.headers.forEach((value, key) => reply.header(key, value));
      reply.send(response.body ? await response.text() : null);
    } catch (error) {
      app.log.error(error);
      reply.status(500).send({
        error: "Internal authentication error.",
        code: "AUTH_FAILURE",
      });
    }
  },
});

try {
  await app.listen({ port: Number(process.env.PORT) || 3000 });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
