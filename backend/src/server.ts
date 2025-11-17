import http from "http";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import cookieParser from "cookie-parser";
import { createApiRouter } from "./routes";
import { errorHandler } from "./middleware/errorHandler";
import { createSocketServer } from "./realtime/socketServer";
import { ensureIndexes } from "./db/collections";
import { getDb, isMongoConnected } from "./db/connection";
import { env, isProd } from "./config/env";
import { scheduleMaintenanceJobs } from "./tasks/cleanup";
import { initializeAvatarStorage, avatarStorageConfig } from "./utils/uploads";

async function bootstrap(): Promise<void> {
  const app = express();
  const server = http.createServer(app);

  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: false }));
  app.use(cookieParser());
  const allowedOrigins = env.CLIENT_ORIGIN.split(",").map((origin) => origin.trim()).filter(Boolean);

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin) {
          callback(null, true);
          return;
        }

        if (allowedOrigins.includes(origin)) {
          callback(null, true);
          return;
        }

        if (!isProd) {
          callback(null, true);
          return;
        }

        callback(new Error(`Origin ${origin} not allowed by CORS`));
      },
      credentials: true
    })
  );
  app.use(helmet({
    contentSecurityPolicy: false
  }));
  app.use(compression());

  await initializeAvatarStorage();
  app.use(avatarStorageConfig.publicPath, express.static(avatarStorageConfig.root));
  if (avatarStorageConfig.publicPath !== "/uploads/avatars") {
    app.use("/uploads/avatars", express.static(avatarStorageConfig.root));
  }

  app.get("/health", async (_req, res) => {
    const databaseHealthy = await isMongoConnected();
    const statusCode = databaseHealthy ? 200 : 503;
    res.status(statusCode).json({ status: databaseHealthy ? "ok" : "degraded", timestamp: Date.now(), database: databaseHealthy ? "connected" : "disconnected" });
  });

  app.use("/api", createApiRouter());
  app.use(errorHandler);

  await ensureIndexes(await getDb());

  createSocketServer(server);
  const maintenanceHandle = scheduleMaintenanceJobs();

  server.listen(env.PORT, () => {
    console.log(`SKYLIVE backend listening on port ${env.PORT} (${env.NODE_ENV})`);
  });

  const shutdown = () => {
    clearInterval(maintenanceHandle);
    server.close(() => {
      process.exit(0);
    });
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

bootstrap().catch((error) => {
  console.error("Failed to bootstrap backend", error);
  process.exit(1);
});
