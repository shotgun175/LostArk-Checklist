import { LostarkTask } from "../model/lostark-task";
import { TaskScope } from "../model/task-scope";
import { Character } from "../model/character/character";
import { FieldWrite } from "./database/write-coalescer";

export function getCompletionEntryKey(character: { id?: number, name: string }, task: LostarkTask, forceName = false): string {
  if (task.scope === TaskScope.ROSTER) {
    return task.$key;
  }
  if (!forceName && character.id) {
    return `${character.id}:${task.$key}`;
  }
  return `${character.name}:${task.$key}`;
}

export function getCompletionEntry<T>(data: Record<string, T>, character: Character, task: LostarkTask, skipFallback = false): T {
  const baseKey = getCompletionEntryKey(character, task);
  if(!data){
    return {} as T;
  }
  if (data[baseKey] !== undefined || skipFallback) {
    return data[baseKey];
  }
  return data[getCompletionEntryKey(character, task, true)];
}

export function setCompletionEntry<T>(data: Record<string, T>, character: Character, task: LostarkTask, entry: T): void {
  const key = getCompletionEntryKey(character, task);
  data[key] = entry;
  const fullNameKey = getCompletionEntryKey(character, task, true);
  if (key !== fullNameKey && data[fullNameKey]) {
    delete data[fullNameKey];
  }
}

/**
 * The field changes that save one character's entry for a task under `field`: the entry under its
 * current key, plus removal of the older name-based key that setCompletionEntry replaces.
 */
export function completionEntryFieldWrites<T>(field: string, data: Record<string, T>, character: Character, task: LostarkTask): FieldWrite[] {
  const key = getCompletionEntryKey(character, task);
  const writes: FieldWrite[] = [{ path: [field, key], value: data[key] }];
  const fullNameKey = getCompletionEntryKey(character, task, true);
  if (key !== fullNameKey) {
    writes.push({ path: [field, fullNameKey], delete: true });
  }
  return writes;
}
