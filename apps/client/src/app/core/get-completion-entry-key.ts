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

/**
 * Moves completion or rest bonus entries saved under a character's name (older data) to its id key,
 * in place. A name shared by several characters (the same name on NA and EU) is copied to each of
 * them, an id key that already exists is kept, and the name key is removed. Keys of characters
 * without an id, and of names that are also a character's id, are left as they are.
 *
 * Args:
 *   data: the completion or energy `data` map, changed in place.
 *   characters: the characters whose name keys to move.
 *
 * Returns:
 *   Whether anything changed.
 */
export function moveNameKeysToIds(data: Record<string, unknown>, characters: { id?: number, name: string }[]): boolean {
  const ids = new Set(characters.filter(c => c.id).map(c => String(c.id)));
  const idsByName = new Map<string, string[]>();
  characters
    .filter(c => c.id && typeof c.name === "string" && c.name !== "" && !ids.has(c.name))
    .forEach(c => idsByName.set(c.name, [...(idsByName.get(c.name) ?? []), String(c.id)]));
  // Longest name first, so "A:B:task" belongs to a character named "A:B" rather than "A"
  const names = [...idsByName.keys()].sort((a, b) => b.length - a.length);
  let changed = false;
  Object.keys(data).forEach(key => {
    const name = names.find(n => key.startsWith(`${n}:`));
    if (name === undefined) {
      return;
    }
    const suffix = key.slice(name.length + 1);
    idsByName.get(name)?.forEach(id => {
      if (data[`${id}:${suffix}`] === undefined) {
        data[`${id}:${suffix}`] = data[key];
      }
    });
    delete data[key];
    changed = true;
  });
  return changed;
}
