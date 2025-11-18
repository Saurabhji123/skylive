import { ObjectId } from "mongodb";
import type { MessageDocument } from "../types";
import { COLLECTIONS } from "../db/collections";
import { getDb } from "../db/connection";
import { ChatMessage } from "@skylive/shared";

export async function persistMessage(message: ChatMessage): Promise<void> {
  const db = await getDb();
  const messages = db.collection<MessageDocument>(COLLECTIONS.MESSAGES);
  await messages.insertOne({
    _id: new ObjectId(),
    ...message
  } as unknown as MessageDocument);
}

export async function getRecentMessages(roomId: string, limit = 50): Promise<ChatMessage[]> {
  const db = await getDb();
  const messages = db.collection<MessageDocument>(COLLECTIONS.MESSAGES);
  const docs = await messages
    .find({ roomId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();

  return docs.reverse();
}
