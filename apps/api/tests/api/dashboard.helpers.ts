import request from "supertest";
import type { Application } from "express";
import { expect, vi } from "vitest";
import { prisma } from "../../src/lib/prisma";
import type { AuthedUser } from "../helpers";

export const V1 = "/api/v1";
export const HOUR = 3600;

export const at = (iso: string) => new Date(iso);

/** Pins the server clock (Date only — real timers keep Prisma/HTTP working). */
export function setNow(iso: string) {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(at(iso));
}

export async function newTask(app: Application, user: AuthedUser, title: string): Promise<string> {
  const res = await request(app).post(`${V1}/tasks`).set("Cookie", user.cookie).send({ title });
  expect(res.status).toBe(201);
  return res.body.data.task.id as string;
}

export const setStatus = (app: Application, user: AuthedUser, taskId: string, status: string) =>
  request(app).patch(`${V1}/tasks/${taskId}`).set("Cookie", user.cookie).send({ status });

/** Inserts a session directly; `stoppedAt: null` makes it the running timer. */
export async function seedLog(
  user: AuthedUser,
  taskId: string,
  startedAt: string,
  stoppedAt: string | null,
) {
  const start = at(startedAt);
  const stop = stoppedAt ? at(stoppedAt) : null;
  await prisma.timeLog.create({
    data: {
      userId: user.id,
      taskId,
      startedAt: start,
      stoppedAt: stop,
      durationSeconds: stop ? Math.floor((stop.getTime() - start.getTime()) / 1000) : 0,
    },
  });
}
