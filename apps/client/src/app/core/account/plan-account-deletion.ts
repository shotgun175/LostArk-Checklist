import { FIRESTORE_BATCH_LIMIT } from "../import/plan-import-writes";

/** The collections that hold one document per user, keyed by uid. */
export const ACCOUNT_COLLECTIONS = ["roster", "settings", "completion", "energy", "users"] as const;

export interface DeletionTarget {
  collection: "tasks" | typeof ACCOUNT_COLLECTIONS[number];
  id: string;
}

/** Lists every document of one user, split into write batches of at most `limit` deletes. */
export function planAccountDeletion(uid: string, taskIds: string[], limit = FIRESTORE_BATCH_LIMIT): DeletionTarget[][] {
  const targets: DeletionTarget[] = [
    ...taskIds.map(id => ({ collection: "tasks" as const, id })),
    ...ACCOUNT_COLLECTIONS.map(collection => ({ collection, id: uid }))
  ];
  const batches: DeletionTarget[][] = [];
  for (let start = 0; start < targets.length; start += limit) {
    batches.push(targets.slice(start, start + limit));
  }
  return batches;
}
