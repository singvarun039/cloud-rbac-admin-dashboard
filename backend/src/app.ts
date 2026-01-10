import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import healthRoutes from "./routes/health";
import { authRouter } from "./modules/auth/auth.routes";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json({ limit: "1mb" }));
  app.use(morgan("dev"));

  app.use("/api", healthRoutes);
  app.use("/api/auth", authRouter);

  return app;
}
