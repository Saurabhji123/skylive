import { Router } from "express";
import { authRouter } from "./authRoutes";
import { roomRouter } from "./roomRoutes";
import { stateRouter } from "./stateRoutes";
import { rtcRouter } from "./rtcRoutes";
import { analyticsRouter } from "./analyticsRoutes";
import { userRouter } from "./userRoutes";

export function createApiRouter(): Router {
  const router = Router();

  router.use("/auth", authRouter);
  router.use("/rooms", roomRouter);
  router.use("/state", stateRouter);
  router.use("/rtc", rtcRouter);
  router.use("/analytics", analyticsRouter);
  router.use("/user", userRouter);

  return router;
}
