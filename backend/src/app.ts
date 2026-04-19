import './types/register';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import healthRoutes from './routes/health';
import { authRouter } from './modules/auth/auth.routes';
import { usersRouter } from './modules/users/users.routes';
import { rolesRouter } from './modules/roles/roles.routes';
import { permissionsRouter } from './modules/permissions/permissions.routes';
import { projectsRouter } from './modules/projects/projects.routes';
import { dashboardRouter } from './modules/dashboard/dashboard.routes';
import { requestId } from './middlewares/requestId';
import { requestLogger } from './middlewares/requestLogger';
import { errorHandler } from './middlewares/errorHandler';
import { AppError } from './errors/AppError';
import { auditLogsRouter } from './modules/auditLogs/auditLogs.routes';
import { env } from './config/env';
import { ok } from './utils/apiResponse';
import { aiRouter } from './modules/ai/ai.routes';
import { aiAuditRouter } from './modules/ai/aiAudit.routes';
import { aiRolesRouter } from './modules/ai/aiRoles.routes';
import { aiPolicyRouter } from './modules/ai/aiPolicy.routes';

// Splits the configured CORS allowlist into normalized origin strings.
function parseAllowedOrigins(value: string): string[] {
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

// Creates and configures the Express application instance.
export function createApp() {
  const app = express();

  if (env.TRUST_PROXY) {
    // Allows correct req.ip when running behind a reverse proxy.
    app.set('trust proxy', 1);
  }

  // Must run before everything (including 404s) so all responses have X-Request-Id.
  app.use(requestId);
  app.use(requestLogger);

  app.use(
    helmet({
      // Keep baseline headers without breaking Vite/React dev.
      contentSecurityPolicy: false,
      frameguard: { action: 'deny' },
    })
  );

  const allowedOrigins = new Set<string>();
  if (env.NODE_ENV !== 'production') {
    allowedOrigins.add('http://localhost:5173');
  }
  for (const origin of parseAllowedOrigins(env.FRONTEND_ORIGIN)) {
    allowedOrigins.add(origin);
  }

  const corsOptions: cors.CorsOptions = {
    origin: (origin, callback) => {
      // Non-browser clients (curl, server-to-server) often omit Origin.
      if (!origin) return callback(null, true);
      if (allowedOrigins.has(origin)) return callback(null, true);
      // Disallowed origins: do not set CORS headers (browser blocks).
      return callback(null, false);
    },
    credentials: false,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', 'X-Request-Id'],
    optionsSuccessStatus: 204,
  };

  // Must be before routes so preflight OPTIONS succeeds.
  app.use(cors(corsOptions));
  app.options(/.*/, cors(corsOptions));
  app.use(express.json({ limit: '1mb' }));

  app.get('/', (req, res) => {
    return ok(
      res,
      req,
      {
        service: 'backend',
        health: '/api/health',
      },
      200
    );
  });

  app.use('/api', healthRoutes);
  app.use('/api/auth', authRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/roles', rolesRouter);
  app.use('/api/permissions', permissionsRouter);
  app.use('/api/projects', projectsRouter);
  app.use('/api/audit-logs', auditLogsRouter);
  app.use('/api/dashboard', dashboardRouter);
  app.use('/api/ai', aiRouter);
  app.use('/api/ai', aiAuditRouter);
  app.use('/api/ai', aiRolesRouter);
  app.use('/api/ai', aiPolicyRouter);

  // Back-compat / convenience aliases (optional):
  app.use('/users', usersRouter);
  app.use('/roles', rolesRouter);

  // 404 handler (must be after routes, before error handler)
  app.use((req) => {
    throw AppError.notFound(`Route not found: ${req.method} ${req.path}`);
  });

  // Centralized error handler (must be last)
  app.use(errorHandler);

  return app;
}
