import { MongoClient, Db, Collection, Document } from "mongodb";
import { env } from "../config/env";

let client: MongoClient | null = null;
let database: Db | null = null;
let clientPromise: Promise<MongoClient> | null = null;

async function delay(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function connectWithRetry(): Promise<MongoClient> {
  const maxAttemptsPerTarget = 5;
  const baseDelayMs = 1000;
  let lastError: unknown;
  const targets = [
    { uri: env.MONGO_URI, label: "primary" },
    ...(env.MONGO_FALLBACK_URI ? [{ uri: env.MONGO_FALLBACK_URI, label: "fallback" }] : [])
  ];

  for (let targetIndex = 0; targetIndex < targets.length; targetIndex++) {
    const target = targets[targetIndex];
    if (!target) {
      continue;
    }

    for (let attempt = 1; attempt <= maxAttemptsPerTarget; attempt++) {
      let candidate: MongoClient | null = null;
      try {
        candidate = new MongoClient(target.uri, {
          monitorCommands: env.NODE_ENV === "development"
        });
        await candidate.connect();
        await candidate.db(env.MONGO_DB_NAME).command({ ping: 1 });
        console.info(`[mongo] Connected to ${target.label} cluster after ${attempt} attempt${attempt > 1 ? "s" : ""}`);
        return candidate;
      } catch (error) {
        lastError = error;
        if (candidate) {
          await candidate.close().catch(() => undefined);
        }

        if (attempt < maxAttemptsPerTarget) {
          const waitMs = Math.min(baseDelayMs * attempt, 5000);
          console.warn(`[mongo] ${target.label} connection attempt ${attempt} failed; retrying in ${waitMs}ms`);
          await delay(waitMs);
        } else if (targetIndex < targets.length - 1) {
          console.warn(`[mongo] ${target.label} connection failed after ${maxAttemptsPerTarget} attempts; trying next target`);
        }
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Unable to connect to MongoDB");
}

export async function getMongoClient(): Promise<MongoClient> {
  if (client) {
    return client;
  }

  clientPromise ??= connectWithRetry()
    .then((connected) => {
      client = connected;
      clientPromise = null;
      return connected;
    })
    .catch((error) => {
      clientPromise = null;
      throw error;
    });

  return clientPromise;
}

export async function getDb(): Promise<Db> {
  if (database) {
    return database;
  }

  const connectedClient = await getMongoClient();
  database = connectedClient.db(env.MONGO_DB_NAME);
  return database;
}

export async function getCollection<T extends Document>(name: string): Promise<Collection<T>> {
  const db = await getDb();
  return db.collection<T>(name);
}

export async function disconnect(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    database = null;
  }
  clientPromise = null;
}

export async function isMongoConnected(): Promise<boolean> {
  try {
    const db = await getDb();
    await db.command({ ping: 1 });
    return true;
  } catch (error) {
    console.warn("[mongo] Ping failed", error);
    return false;
  }
}
