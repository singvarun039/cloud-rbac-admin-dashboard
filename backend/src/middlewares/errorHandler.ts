import type { NextFunction, Request, Response } from "express";
import { fail } from "../utils/apiResponse";
import { logWithReq } from "../lib/logger";

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  const error = err as { message?: string; stack?: string; name?: string };

  logWithReq(req, "error", "request_error", {
    errorName: error?.name,
    errorMessage: error?.message,
    stack: error?.stack,
  });

  if (res.headersSent) return;

  return fail(res, 500, "INTERNAL_SERVER_ERROR", "Internal server error");
}
