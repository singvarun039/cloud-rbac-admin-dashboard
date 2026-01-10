import type { NextFunction, Request, Response } from "express";
import { logWithReq } from "../lib/logger";

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = process.hrtime.bigint();

  logWithReq(req, "info", "request_start", {
    method: req.method,
    path: req.originalUrl || req.url,
  });

  res.on("finish", () => {
    const end = process.hrtime.bigint();
    const durationMs = Number(end - start) / 1_000_000;

    logWithReq(req, "info", "request_finish", {
      method: req.method,
      path: req.originalUrl || req.url,
      statusCode: res.statusCode,
      durationMs: Math.round(durationMs * 100) / 100,
    });
  });

  next();
}
