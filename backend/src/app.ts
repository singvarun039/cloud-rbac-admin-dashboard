import express from "express";
import cors from "cors";
import helmet from "helmet";
import healthRoutes from "./routes/health";
import { authRouter } from "./modules/auth/auth.routes";
import { usersRouter } from "./modules/users/users.routes";
import { rolesRouter } from "./modules/roles/roles.routes";
import { permissionsRouter } from "./modules/permissions/permissions.routes";
import { projectsRouter } from "./modules/projects/projects.routes";
import { requestId } from "./middlewares/requestId";
import { requestLogger } from "./middlewares/requestLogger";
import { errorHandler } from "./middlewares/errorHandler";
import { AppError } from "./errors/AppError";
import { auditLogsRouter } from "./modules/auditLogs/auditLogs.routes";

export function createApp() {
  const app = express();

  // Must run before everything (including 404s) so all responses have X-Request-Id.
  app.use(requestId);
  app.use(requestLogger);

  app.use(helmet());
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json({ limit: "1mb" }));

  app.use("/api", healthRoutes);
  app.use("/api/auth", authRouter);
  app.use("/api/users", usersRouter);
  app.use("/api/roles", rolesRouter);
  app.use("/api/permissions", permissionsRouter);
  app.use("/api/projects", projectsRouter);
  app.use("/api/audit-logs", auditLogsRouter);

  // Back-compat / convenience aliases (optional):
  app.use("/users", usersRouter);
  app.use("/roles", rolesRouter);

  // 404 handler (must be after routes, before error handler)
  app.use((req) => {
    throw AppError.notFound(`Route not found: ${req.method} ${req.path}`);
  });

  // Centralized error handler (must be last)
  app.use(errorHandler);

  return app;
}
