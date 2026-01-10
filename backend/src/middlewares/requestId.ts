import type { NextFunction, Request, Response } from "express";
import crypto from "node:crypto";

function generateRequestId(): string {
  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  // Fallback for older Node versions.
  return crypto.randomBytes(16).toString("hex");
}

export function requestId(req: Request, res: Response, next: NextFunction) {
  const id = generateRequestId();
  req.requestId = id;
  res.setHeader("X-Request-Id", id);
  next();
}
