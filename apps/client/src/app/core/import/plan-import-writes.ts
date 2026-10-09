import { Completion } from "../../model/completion";
import { LostarkTask } from "../../model/lostark-task";
import { LostarkExport, StoredDoc } from "./lostark-export";
import { isRaidTask } from "../task-tracking";

/** Firestore's maximum number of writes in one batch. */
export const FIRESTORE_BATCH_LIMIT = 500;

export type ImportWrite =
  | { op: "delete"; collection: "tasks"; id: string }
  | { op: "set"; collection: "tasks" | "roster" | "settings" | "completion" | "energy" | "users"; id: string; data: Record<string, unknown> };

export interface ImportPlan {
  writes: ImportWrite[];
  /** The completion document the plan writes, with task keys already remapped. */
  completion: StoredDoc<Completion>;
}

/**
 * Rewrites the task id at the end of a key ("taskId", "charId:taskId" or "charName:taskId").
 * Keys that do not end with an imported task id are returned unchanged.
 */
function remapKey(key: string, newIds: Map<string, string>): string {
  const separator = key.lastIndexOf(":");
  const newId = newIds.get(key.slice(separator + 1));
  return newId === undefined ? key : key.slice(0, separator + 1) + newId;
}

function remapKeys<T>(map: Record<string, T> | undefined, newIds: Map<string, string>): Record<string, T> | undefined {
  if (!map) {
    return map;
  }
  return Object.fromEntries(Object.entries(map).map(([key, value]) => [remapKey(key, newIds), value]));
}

/**
 * The file's tracking choices worth keeping: entries whose task ("taskId", "charId:taskId" or
 * "charName:taskId") is not in the file are dropped, and so are raid entries when dropRaids is set,
 * so the imported roster starts on the automatic newest raids.
 *
 * Args:
 *   trackedTasks: roster.trackedTasks from the file.
 *   tasks: the file's tasks.
 *   dropRaids: whether to drop entries of raid tasks too.
 */
export function cleanImportedTracking(trackedTasks: Record<string, boolean | undefined> | undefined, tasks: LostarkTask[], dropRaids: boolean): Record<string, boolean | undefined> | undefined {
  if (!trackedTasks) {
    return trackedTasks;
  }
  const taskByKey = new Map(tasks.map(task => [task.$key, task]));
  return Object.fromEntries(Object.entries(trackedTasks).filter(([key]) => {
    const task = taskByKey.get(key.slice(key.lastIndexOf(":") + 1));
    return task !== undefined && !(dropRaids && isRaidTask(task));
  }));
}

/**
 * Lists the writes that replace the current user's data with an export.
 *
 * Every task the current user has is deleted, and each imported task gets a fresh id from
 * `newTaskId`. Task documents live in one shared collection, so reusing the file's ids would
 * fail whenever the same file was already imported into another account. Completion, rest
 * bonus, tracking and lazy-flag keys are rewritten to the fresh ids. Tracking choices are
 * cleaned first (see cleanImportedTracking); dropRaidTracking is set for Lostark-helper files,
 * not for this app's own backups. A file with a display name (`user.name`) also sets users/{uid}.
 */
export function planImportWrites(uid: string, existingTaskIds: string[], data: LostarkExport, newTaskId: () => string, dropRaidTracking = false): ImportPlan {
  const newIds = new Map(data.tasks.map(task => [task.$key, newTaskId()]));
  const deletes: ImportWrite[] = existingTaskIds.map(id => ({ op: "delete", collection: "tasks", id }));
  const taskSets: ImportWrite[] = data.tasks.map(({ $key, ...task }) => ({
    op: "set",
    collection: "tasks",
    id: newIds.get($key) as string,
    data: { ...task, authorId: uid }
  }));
  const sourceCompletion = data.completion ?? { data: {} };
  const completion = { ...sourceCompletion, data: remapKeys(sourceCompletion.data, newIds) ?? {} };
  const sourceEnergy = data.energy ?? { data: {}, updated: 0 };
  const settings: Record<string, unknown> = { ...data.settings };
  if (data.settings.lazytracking) {
    settings["lazytracking"] = remapKeys(data.settings.lazytracking, newIds);
  }
  const docSets: ImportWrite[] = [
    { op: "set", collection: "roster", id: uid, data: { ...data.roster, trackedTasks: remapKeys(cleanImportedTracking(data.roster.trackedTasks, data.tasks, dropRaidTracking), newIds) ?? {} } },
    { op: "set", collection: "settings", id: uid, data: settings },
    { op: "set", collection: "completion", id: uid, data: { ...completion } },
    { op: "set", collection: "energy", id: uid, data: { ...sourceEnergy, data: remapKeys(sourceEnergy.data, newIds) ?? {} } }
  ];
  // A backup's display name; a file without one keeps the current name.
  if (data.user?.name) {
    docSets.push({ op: "set", collection: "users", id: uid, data: { name: data.user.name } });
  }
  return { writes: [...deletes, ...taskSets, ...docSets], completion };
}
