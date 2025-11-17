import { ObjectId } from "mongodb";
import type { AnalyticsDocument, LogDocument } from "../types";
import type { AnalyticsPayload } from "@skylive/shared";
import { getDb } from "../db/connection";
import { COLLECTIONS } from "../db/collections";

export async function recordAnalytics(payload: AnalyticsPayload): Promise<void> {
  const db = await getDb();
  const analytics = db.collection<AnalyticsDocument>(COLLECTIONS.ANALYTICS);
  await analytics.insertOne({
    _id: new ObjectId(),
    ...payload,
    timestamp: new Date()
  } as unknown as AnalyticsDocument);
}

export async function recordLog(log: Omit<LogDocument, "_id" | "createdAt">): Promise<void> {
  const db = await getDb();
  const logs = db.collection<LogDocument>(COLLECTIONS.LOGS);
  await logs.insertOne({
    _id: new ObjectId(),
    ...log,
    createdAt: new Date()
  } as unknown as LogDocument);
}
