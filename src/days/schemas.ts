import z from "zod";

export const TaskStatusSchema = z.enum([
  "EM_DESENVOLVIMENTO",
  "ENVIADO_STG",
  "MR_ABERTA_PROD",
  "CONCLUIDA",
]);

export const WorkDayDtoSchema = z.object({
  id: z.string(),
  date: z.string(),
  label: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const TaskDtoSchema = z.object({
  id: z.string(),
  workDayId: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  status: TaskStatusSchema,
  sortOrder: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const WorkDayWithTasksDtoSchema = WorkDayDtoSchema.extend({
  tasks: z.array(TaskDtoSchema),
});

export const ListWorkDaysResponseSchema = z.object({
  days: z.array(WorkDayWithTasksDtoSchema),
});

export const WorkDayResponseSchema = z.object({
  day: WorkDayWithTasksDtoSchema,
});

export const CreateWorkDayBodySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use o formato YYYY-MM-DD"),
  label: z.string().trim().min(1).optional(),
});

export const UpdateWorkDayBodySchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use o formato YYYY-MM-DD")
    .optional(),
  label: z.string().trim().nullable().optional(),
});

export const WorkDayIdParamsSchema = z.object({
  dayId: z.string(),
});

export const TaskIdParamsSchema = z.object({
  taskId: z.string(),
});

export const CreateTaskBodySchema = z.object({
  title: z.string().trim().min(1, "Informe o nome da tarefa"),
  description: z.string().optional(),
});

export const UpdateTaskBodySchema = z.object({
  title: z.string().trim().min(1).optional(),
  description: z.string().nullable().optional(),
  status: TaskStatusSchema.optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export const TaskResponseSchema = z.object({
  task: TaskDtoSchema,
});

export const OkResponseSchema = z.object({
  ok: z.literal(true),
});

export type WorkDayDto = z.infer<typeof WorkDayDtoSchema>;
export type TaskDto = z.infer<typeof TaskDtoSchema>;
export type WorkDayWithTasksDto = z.infer<typeof WorkDayWithTasksDtoSchema>;
