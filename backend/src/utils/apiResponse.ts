import type { Request, Response } from 'express';

export type ApiSuccessEnvelope<T> = {
  ok: true;
  data: T;
  meta?: Record<string, unknown>;
  requestId: string;
};

export type ApiErrorEnvelope = {
  ok: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  requestId: string;
};

type Meta = Record<string, unknown>;

// Sends a standardized success envelope for API responses.
export function ok<T>(
  res: Response,
  req: Request,
  data: T,
  statusOrMeta?: number | Meta,
  meta?: Meta
) {
  const requestId = req.requestId ?? 'unknown';

  const status = typeof statusOrMeta === 'number' ? statusOrMeta : 200;
  const resolvedMeta = typeof statusOrMeta === 'object' && statusOrMeta ? statusOrMeta : meta;

  const payload: ApiSuccessEnvelope<T> = {
    ok: true,
    data,
    requestId,
    ...(resolvedMeta ? { meta: resolvedMeta } : {}),
  };

  return res.status(status).json(payload);
}

// Sends a standardized error envelope for API responses.
export function fail(
  res: Response,
  req: Request,
  status: number,
  code: string,
  message: string,
  details?: unknown
) {
  const requestId = req.requestId ?? 'unknown';

  const payload: ApiErrorEnvelope = {
    ok: false,
    error: {
      code,
      message,
      ...(typeof details === 'undefined' ? {} : { details }),
    },
    requestId,
  };

  return res.status(status).json(payload);
}
