import type { DeviceInfoDocument } from "../types";
import { COLLECTIONS } from "../db/collections";
import { getDb } from "../db/connection";
import { DeviceInfoPayload } from "@skylive/shared";

export async function upsertDeviceInfo(payload: DeviceInfoPayload): Promise<void> {
  const db = await getDb();
  const devices = db.collection<DeviceInfoDocument>(COLLECTIONS.DEVICE_INFO);
  await devices.updateOne(
    { deviceId: payload.deviceId },
    {
      $set: {
        ...payload,
        lastUsed: payload.lastUsed
      }
    },
    { upsert: true }
  );
}
