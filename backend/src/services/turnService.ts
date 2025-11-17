import { env } from "../config/env";

export async function releaseTurnAllocation(roomId: string): Promise<void> {
  if (!env.TURN_ENDPOINT) {
    return;
  }

  if (!env.TURN_RELEASE_WEBHOOK) {
    return;
  }

  try {
    await fetch(env.TURN_RELEASE_WEBHOOK, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({ roomId })
    });
  } catch (error) {
    console.warn("Failed to release TURN allocation", { roomId, error });
  }
}
