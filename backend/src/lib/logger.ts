import type { Request } from "express";
import pino from "pino";

export type LogLevel = "fatal" | "error" | "warn" | "info" | "debug" | "trace";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  messageKey: "message",
  base: null,
  timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
  formatters: {
    level(label) {
      return { level: label };
    },
  },
});

export function logWithReq(
  req: Request,
  level: LogLevel,
  message: string,
  extra: Record<string, unknown> = {}
) {
  const requestId = req.requestId ?? "unknown";
  const userId = req.user?.id ?? null;

  logger[level]({ requestId, userId, ...extra }, message);
}
