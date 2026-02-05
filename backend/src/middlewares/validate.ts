import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { ZodTypeAny } from "zod";
import { ZodError } from "zod";
import { AppError } from "../errors/AppError";

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

function validatePart(
  part: "body" | "query" | "params",
  schema: ZodTypeAny,
): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    const parsed = schema.safeParse(req[part]);
    if (!parsed.success) {
      throw AppError.validation(zodDetails(parsed.error));
    }

    // Replace with parsed (typed) data for downstream handlers.
    // Express 5 exposes `req.query` as a getter-only property, so avoid reassigning it.
    if (part === "query") {
      // Prefer overriding the accessor with a concrete value so downstream code sees coerced numbers.
      // If Express' `req.query` is non-configurable, fall back to mutating the returned object.
      try {
        Object.defineProperty(req, "query", {
          value: parsed.data,
          writable: true,
          configurable: true,
        });
      } catch {
        if (req.query && typeof req.query === "object") {
          Object.assign(req.query as Record<string, unknown>, parsed.data);
        }
      }
    } else {
      (req as any)[part] = parsed.data;
    }
    next();
  };
}

export function validateBody(schema: ZodTypeAny) {
  return validatePart("body", schema);
}

export function validateQuery(schema: ZodTypeAny) {
  return validatePart("query", schema);
}

export function validateParams(schema: ZodTypeAny) {
  return validatePart("params", schema);
}
