import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import { AppError } from "../errors/AppError";
import { fail } from "../utils/apiResponse";
import { logWithReq } from "../lib/logger";

function zodDetails(error: ZodError) {
  return {
    issues: error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
      code: issue.code,
    })),
    fieldErrors: error.flatten().fieldErrors,
    formErrors: error.flatten().formErrors,
  };
}

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (res.headersSent) return;

  // 0) Prisma validation errors (bad inputs / bad selects)
  if (err instanceof Prisma.PrismaClientValidationError) {
    logWithReq(req, "warn", "prisma_validation_error", {
      message: err.message,
    });
    return fail(res, req, 400, "BAD_REQUEST", "Bad request");
  }

  // 1) Zod validation errors
  if (err instanceof ZodError) {
    return fail(
      res,
      req,
      400,
      "VALIDATION_ERROR",
      "Validation failed",
      zodDetails(err),
    );
  }

  // 2) Our explicit application errors
  if (err instanceof AppError) {
    if (err.status >= 500) {
      logWithReq(req, "error", "request_error", {
        code: err.code,
        message: err.message,
        details: err.details,
      });
    } else {
      logWithReq(req, "warn", "request_error", {
        code: err.code,
        message: err.message,
        details: err.details,
      });
    }

    return fail(res, req, err.status, err.code, err.message, err.details);
  }

  // 3) Prisma known errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      logWithReq(req, "warn", "prisma_error", {
        code: err.code,
        meta: err.meta,
      });
      return fail(res, req, 409, "CONFLICT", "Conflict", {
        target: (err.meta as any)?.target,
      });
    }

    if (err.code === "P2025") {
      logWithReq(req, "warn", "prisma_error", {
        code: err.code,
        meta: err.meta,
      });
      return fail(res, req, 404, "NOT_FOUND", "Not found");
    }

    if (err.code === "P2003") {
      logWithReq(req, "warn", "prisma_error", {
        code: err.code,
        meta: err.meta,
      });
      return fail(res, req, 409, "CONFLICT", "Conflict", {
        fieldName: (err.meta as any)?.field_name,
      });
    }

    logWithReq(req, "error", "prisma_error", {
      code: err.code,
      meta: err.meta,
    });
    return fail(res, req, 500, "INTERNAL", "Internal server error");
  }

  // 4) Unknown/unexpected
  const unknownError = err as {
    message?: string;
    stack?: string;
    name?: string;
  };

  logWithReq(req, "error", "request_error", {
    errorName: unknownError?.name,
    errorMessage: unknownError?.message,
    stack: unknownError?.stack,
  });

  return fail(res, req, 500, "INTERNAL", "Internal server error");
}
