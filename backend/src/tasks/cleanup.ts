import { cleanupStaleRoomArtifacts } from "../services/roomService";

const CLEANUP_INTERVAL_MS = 15 * 60 * 1000;

export function scheduleMaintenanceJobs(): NodeJS.Timeout {
  const runCleanup = async () => {
    try {
      const result = await cleanupStaleRoomArtifacts();
      if (result.rooms || result.sessions || result.shares || result.tokens) {
        console.info("Cleanup run completed", result);
      }
    } catch (error) {
      console.error("Cleanup job failed", error);
    }
  };

  void runCleanup();

  return setInterval(() => {
    void runCleanup();
  }, CLEANUP_INTERVAL_MS);
}
