import { Completion } from "../../model/completion";
import { LostarkExport, StoredDoc } from "./lostark-export";

/** Firestore's maximum number of writes in one batch. */
export const FIRESTORE_BATCH_LIMIT = 500;

export type ImportWrite =
  | { op: "delete"; collection: "tasks"; id: string }
  | { op: "set"; collection: "tasks" | "roster" | "settings" | "completion" | "energy"; id: string; data: Record<string, unknown> };

export function importedCompletion(data: LostarkExport): StoredDoc<Completion> {
  return data.completion ?? { data: {} };
}

/**
 * Lists the writes that replace the current user's data with an export.
 *
 * The current user's tasks that the file does not contain are deleted: the app creates
 * default tasks with fresh ids on first load, and its duplicate cleanup would otherwise
 * delete imported originals at random. Tasks keep their original ids so completion, energy,
 * tracking and lazy-flag keys stay valid.
 */
export function planImportWrites(uid: string, existingTaskIds: string[], data: LostarkExport): ImportWrite[] {
  const importedIds = new Set(data.tasks.map(task => task.$key));
  const deletes: ImportWrite[] = existingTaskIds
    .filter(id => !importedIds.has(id))
    .map(id => ({ op: "delete", collection: "tasks", id }));
  const taskSets: ImportWrite[] = data.tasks.map(({ $key, ...task }) => ({
    op: "set",
    collection: "tasks",
    id: $key,
    data: { ...task, authorId: uid }
  }));
  const docSets: ImportWrite[] = [
    { op: "set", collection: "roster", id: uid, data: { ...data.roster } },
    { op: "set", collection: "settings", id: uid, data: { ...data.settings } },
    { op: "set", collection: "completion", id: uid, data: { ...importedCompletion(data) } },
    { op: "set", collection: "energy", id: uid, data: { ...(data.energy ?? { data: {}, updated: 0 }) } }
  ];
  return [...deletes, ...taskSets, ...docSets];
}
