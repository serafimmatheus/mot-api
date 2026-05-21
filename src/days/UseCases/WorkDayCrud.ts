import type { PrismaClient, Task, WorkDay } from "../../generated/prisma/client.js";
import type { TaskDto, WorkDayDto, WorkDayWithTasksDto } from "../schemas.js";

export function toWorkDayDto(day: WorkDay): WorkDayDto {
  return {
    id: day.id,
    date: day.date.toISOString().slice(0, 10),
    label: day.label,
    createdAt: day.createdAt.toISOString(),
    updatedAt: day.updatedAt.toISOString(),
  };
}

export function toTaskDto(task: Task): TaskDto {
  return {
    id: task.id,
    workDayId: task.workDayId,
    title: task.title,
    description: task.description,
    status: task.status,
    sortOrder: task.sortOrder,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  };
}

export function toWorkDayWithTasks(
  day: WorkDay & { tasks: Task[] },
): WorkDayWithTasksDto {
  return {
    ...toWorkDayDto(day),
    tasks: day.tasks
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.getTime() - b.createdAt.getTime())
      .map(toTaskDto),
  };
}

export class ListWorkDays {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(userId: string): Promise<WorkDayWithTasksDto[]> {
    const days = await this.prisma.workDay.findMany({
      where: { userId },
      include: { tasks: true },
      orderBy: { date: "desc" },
    });
    return days.map(toWorkDayWithTasks);
  }
}

export class CreateWorkDay {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(
    userId: string,
    input: { date: string; label?: string },
  ): Promise<WorkDayWithTasksDto> {
    const date = new Date(`${input.date}T12:00:00.000Z`);

    const day = await this.prisma.workDay.create({
      data: {
        userId,
        date,
        label: input.label ?? null,
      },
      include: { tasks: true },
    });

    return toWorkDayWithTasks(day);
  }
}

export class GetWorkDay {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(userId: string, dayId: string): Promise<WorkDayWithTasksDto | null> {
    const day = await this.prisma.workDay.findFirst({
      where: { id: dayId, userId },
      include: { tasks: true },
    });
    if (!day) return null;
    return toWorkDayWithTasks(day);
  }
}

export class UpdateWorkDay {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(
    userId: string,
    dayId: string,
    input: { date?: string; label?: string | null },
  ): Promise<WorkDayWithTasksDto | null> {
    const existing = await this.prisma.workDay.findFirst({
      where: { id: dayId, userId },
    });
    if (!existing) return null;

    const day = await this.prisma.workDay.update({
      where: { id: dayId },
      data: {
        ...(input.date !== undefined
          ? { date: new Date(`${input.date}T12:00:00.000Z`) }
          : {}),
        ...(input.label !== undefined ? { label: input.label } : {}),
      },
      include: { tasks: true },
    });

    return toWorkDayWithTasks(day);
  }
}

export class DeleteWorkDay {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(userId: string, dayId: string): Promise<boolean> {
    const existing = await this.prisma.workDay.findFirst({
      where: { id: dayId, userId },
    });
    if (!existing) return false;

    await this.prisma.workDay.delete({ where: { id: dayId } });
    return true;
  }
}

export class CreateTask {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(
    userId: string,
    dayId: string,
    input: { title: string; description?: string },
  ): Promise<TaskDto | null> {
    const day = await this.prisma.workDay.findFirst({
      where: { id: dayId, userId },
      include: { tasks: { select: { sortOrder: true } } },
    });
    if (!day) return null;

    const maxOrder = day.tasks.reduce((max, t) => Math.max(max, t.sortOrder), -1);

    const task = await this.prisma.task.create({
      data: {
        userId,
        workDayId: dayId,
        title: input.title,
        description: input.description?.trim() || null,
        sortOrder: maxOrder + 1,
      },
    });

    return toTaskDto(task);
  }
}

export class UpdateTask {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(
    userId: string,
    taskId: string,
    input: {
      title?: string;
      description?: string | null;
      status?: Task["status"];
      sortOrder?: number;
    },
  ): Promise<TaskDto | null> {
    const existing = await this.prisma.task.findFirst({
      where: { id: taskId, userId },
    });
    if (!existing) return null;

    const task = await this.prisma.task.update({
      where: { id: taskId },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined
          ? { description: input.description }
          : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
      },
    });

    return toTaskDto(task);
  }
}

export class DeleteTask {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(userId: string, taskId: string): Promise<boolean> {
    const existing = await this.prisma.task.findFirst({
      where: { id: taskId, userId },
    });
    if (!existing) return false;

    await this.prisma.task.delete({ where: { id: taskId } });
    return true;
  }
}
