import type { NextFunction, Request, RequestHandler, Response } from "express";

// Wraps async Express handlers and forwards rejected promises to next().
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => unknown,
): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
