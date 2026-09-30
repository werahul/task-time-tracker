import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { requestContext } from "../lib/request-context";

export const REQUEST_ID_HEADER = "X-Request-ID";

// Accept an upstream id (e.g. from a load balancer) only if it's short and safe
// to echo into logs and headers; otherwise mint our own.
const SAFE_REQUEST_ID = /^[A-Za-z0-9._-]{8,128}$/;

export function requestId(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.get(REQUEST_ID_HEADER);
  const id = incoming && SAFE_REQUEST_ID.test(incoming) ? incoming : randomUUID();

  res.setHeader(REQUEST_ID_HEADER, id);
  res.locals.requestId = id;
  requestContext.run({ requestId: id }, next);
}
