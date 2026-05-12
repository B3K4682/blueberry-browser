import { openDB, type IDBPDatabase, type DBSchema } from "idb";
import type {
  WorkflowEvent,
  Ritual,
  DismissalRecord,
} from "@shared/ritual-types";

const DB_NAME = "blueberry-ritual";
const DB_VERSION = 1;

const EVENTS_STORE = "events";
const RITUALS_STORE = "rituals";
const DISMISSALS_STORE = "dismissals";

// 30 days in milliseconds
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

interface BlueberryRitualDB extends DBSchema {
  [EVENTS_STORE]: {
    key: string;
    value: WorkflowEvent;
    indexes: {
      "by-session-timestamp": [string, number];
      "by-domain": string;
      "by-timestamp": number;
    };
  };
  [RITUALS_STORE]: {
    key: string;
    value: Ritual;
    indexes: {
      "by-createdAt": number;
    };
  };
  [DISMISSALS_STORE]: {
    key: string;
    value: DismissalRecord;
  };
}

let dbPromise: Promise<IDBPDatabase<BlueberryRitualDB>> | null = null;

// Opens (or returns the cached) IndexedDB connection.
function getDB(): Promise<IDBPDatabase<BlueberryRitualDB>> {
  if (!dbPromise) {
    dbPromise = openDB<BlueberryRitualDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(EVENTS_STORE)) {
          const events = db.createObjectStore(EVENTS_STORE, { keyPath: "id" });
          events.createIndex("by-session-timestamp", [
            "sessionId",
            "timestamp",
          ]);
          events.createIndex("by-domain", "domain");
          events.createIndex("by-timestamp", "timestamp");
        }

        if (!db.objectStoreNames.contains(RITUALS_STORE)) {
          const rituals = db.createObjectStore(RITUALS_STORE, {
            keyPath: "id",
          });
          rituals.createIndex("by-createdAt", "createdAt");
        }

        if (!db.objectStoreNames.contains(DISMISSALS_STORE)) {
          db.createObjectStore(DISMISSALS_STORE, { keyPath: "key" });
        }
      },
    }).then(async (db) => {
      // Delete old events older than 30 days
      void pruneOldEvents(db).catch((err) =>
        console.warn("[ritual] event pruning failed:", err)
      );
      return db;
    });
  }
  return dbPromise;
}

// Async background cleanup of events older than 30 days.
async function pruneOldEvents(
  db: IDBPDatabase<BlueberryRitualDB>
): Promise<void> {
  const cutoff = Date.now() - THIRTY_DAYS_MS;
  const tx = db.transaction(EVENTS_STORE, "readwrite");
  const index = tx.store.index("by-timestamp");
  let deleted = 0;
  for await (const cursor of index.iterate(IDBKeyRange.upperBound(cutoff))) {
    await cursor.delete();
    deleted++;
  }
  await tx.done;
  if (deleted > 0) {
    console.log(`[ritual] pruned ${deleted} stale event(s) older than 30d`);
  }
}

// Stable dismissal key: joined domain sequence.
function dismissalKeyFor(domainSequence: string[]): string {
  return domainSequence.join(" > ");
}

// Persists a single normalized event.
export async function saveEvent(event: WorkflowEvent): Promise<void> {
  const db = await getDB();
  await db.put(EVENTS_STORE, event);
}

// Returns the most recent `limit` events across all sessions, newest first.
export async function getRecentEvents(
  limit: number
): Promise<WorkflowEvent[]> {
  const db = await getDB();
  const index = db
    .transaction(EVENTS_STORE, "readonly")
    .store.index("by-timestamp");

  const out: WorkflowEvent[] = [];
  let cursor = await index.openCursor(null, "prev");
  while (cursor && out.length < limit) {
    out.push(cursor.value);
    cursor = await cursor.continue();
  }
  return out;
}

// Returns all events tied to a given browser session.
export async function getEventsBySession(
  sessionId: string
): Promise<WorkflowEvent[]> {
  const db = await getDB();
  const index = db
    .transaction(EVENTS_STORE, "readonly")
    .store.index("by-session-timestamp");

  const range = IDBKeyRange.bound(
    [sessionId, -Infinity],
    [sessionId, Infinity]
  );
  return index.getAll(range);
}

// Returns every event matching one of the given domains.
export async function getEventsByDomains(
  domains: string[]
): Promise<WorkflowEvent[]> {
  if (domains.length === 0) return [];
  const db = await getDB();
  const index = db
    .transaction(EVENTS_STORE, "readonly")
    .store.index("by-domain");

  const buckets = await Promise.all(
    domains.map((domain) => index.getAll(domain))
  );
  return buckets.flat();
}

// Persists a confirmed Ritual.
export async function saveRitual(ritual: Ritual): Promise<void> {
  const db = await getDB();
  await db.put(RITUALS_STORE, ritual);
}

// Returns every saved Ritual, newest first.
export async function getRituals(): Promise<Ritual[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex(RITUALS_STORE, "by-createdAt");
  return all.reverse();
}

// Looks up a single Ritual by id, or `null` if missing.
export async function getRitualById(id: string): Promise<Ritual | null> {
  const db = await getDB();
  const ritual = await db.get(RITUALS_STORE, id);
  return ritual ?? null;
}

// Applies a shallow patch to an existing Ritual.
export async function updateRitual(
  id: string,
  patch: Partial<Ritual>
): Promise<void> {
  const db = await getDB();
  const existing = await db.get(RITUALS_STORE, id);
  if (!existing) return;
  await db.put(RITUALS_STORE, { ...existing, ...patch, id });
}

// Removes a saved Ritual permanently.
export async function deleteRitual(id: string): Promise<void> {
  const db = await getDB();
  await db.delete(RITUALS_STORE, id);
}

// Records that the user dismissed a candidate.
// ? Might remove this later and update directly in ritual store.
export async function saveDismissal(domainSequence: string[]): Promise<void> {
  const db = await getDB();
  await db.put(DISMISSALS_STORE, {
    key: dismissalKeyFor(domainSequence),
    domainSequence,
    dismissedAt: Date.now(),
  });
}

// Returns true if the exact domain sequence has been dismissed.
export async function isDismissed(domainSequence: string[]): Promise<boolean> {
  const db = await getDB();
  const hit = await db.get(DISMISSALS_STORE, dismissalKeyFor(domainSequence));
  return hit !== undefined;
}

// Test/seed-only helper: nukes every store.
export async function resetAllStores(): Promise<void> {
  const db = await getDB();
  await Promise.all([
    db.clear(EVENTS_STORE),
    db.clear(RITUALS_STORE),
    db.clear(DISMISSALS_STORE),
  ]);
}
