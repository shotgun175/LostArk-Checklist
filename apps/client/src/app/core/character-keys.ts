import { Character } from "../model/character/character";
import { FieldWrite } from "./database/write-coalescer";

type CharacterRef = Pick<Character, "name"> & { id?: number };

/**
 * Per-character choices in settings (lazy flags, Gold Planner ticks and modes, manual gold) are
 * keyed by character id, so renaming a character keeps them. Older data keyed them by name: reads
 * fall back to that name key, and characterKeyMigrationWrites moves it to the id key once.
 */
export function characterKey(character: CharacterRef): string {
  return character.id ? String(character.id) : character.name;
}

/** The settings key of one character's choice, for example "5:taskKey" or "5:gold:taking:Kazeros Gate 1". */
export function characterFlagKey(character: CharacterRef, suffix: string): string {
  return `${characterKey(character)}:${suffix}`;
}

/** One character's choice: the id key, or the older name key when there is no id key yet. */
export function readCharacterFlag<T>(map: Record<string, T> | undefined, character: CharacterRef, suffix: string): T | undefined {
  if (!map) {
    return undefined;
  }
  const value = map[characterFlagKey(character, suffix)];
  return value !== undefined ? value : map[`${character.name}:${suffix}`];
}

/** The manualGoldEntries key of one character's Chaos Dungeons or Other sources amount, for example "chaos:5". */
export function manualGoldKey(type: string, character: CharacterRef): string {
  return `${type}:${characterKey(character)}`;
}

/** One character's manual gold entry, from the id key or the older name key. */
export function readManualGold<T>(map: Record<string, T> | undefined, type: string, character: CharacterRef): T | undefined {
  if (!map) {
    return undefined;
  }
  const value = map[manualGoldKey(type, character)];
  return value !== undefined ? value : map[`${type}:${character.name}`];
}

/** The field writes that replace name keys with id keys, and remove a name key's id key twin (the id key wins). */
export function nameKeyWrites(field: string, map: Record<string, unknown>, nameKey: string, idKeys: string[]): FieldWrite[] {
  const writes: FieldWrite[] = idKeys
    .filter(idKey => map[idKey] === undefined)
    .map(idKey => ({ path: [field, idKey], value: map[nameKey] }));
  return [...writes, { path: [field, nameKey], delete: true }];
}

const PREFIXED_FIELDS = ["lazytracking", "goldPlannerConfiguration", "raidModesForGoldPlanner"];
const MANUAL_GOLD_TYPES = ["chaos", "other"];

/**
 * The field writes that move per-character settings keys from the character's name to its id:
 * "Name:..." keys in lazytracking, goldPlannerConfiguration and raidModesForGoldPlanner, and
 * "chaos:Name" / "other:Name" in manualGoldEntries. A name shared by several characters goes to
 * each of them. Keys of names no character has, of characters without an id, and names that are
 * also a character's id are left as they are. After the writes are applied it returns nothing.
 *
 * Args:
 *   settings: the settings document (only the four maps are read).
 *   characters: every character of the roster.
 */
export function characterKeyMigrationWrites(settings: Record<string, unknown>, characters: CharacterRef[]): FieldWrite[] {
  const ids = new Set(characters.filter(c => c.id).map(c => String(c.id)));
  const idsByName = new Map<string, string[]>();
  characters
    .filter(c => c.id && typeof c.name === "string" && !ids.has(c.name))
    .forEach(c => idsByName.set(c.name, [...(idsByName.get(c.name) ?? []), String(c.id)]));
  const writes: FieldWrite[] = [];
  PREFIXED_FIELDS.forEach(field => {
    const map = settings[field] as Record<string, unknown> | undefined;
    Object.keys(map ?? {}).forEach(key => {
      const separator = key.indexOf(":");
      const owners = separator > 0 ? idsByName.get(key.slice(0, separator)) : undefined;
      if (map && owners) {
        const suffix = key.slice(separator + 1);
        writes.push(...nameKeyWrites(field, map, key, owners.map(id => `${id}:${suffix}`)));
      }
    });
  });
  const manualGold = settings["manualGoldEntries"] as Record<string, unknown> | undefined;
  Object.keys(manualGold ?? {}).forEach(key => {
    const separator = key.indexOf(":");
    const owners = MANUAL_GOLD_TYPES.includes(key.slice(0, separator)) ? idsByName.get(key.slice(separator + 1)) : undefined;
    if (manualGold && owners) {
      writes.push(...nameKeyWrites("manualGoldEntries", manualGold, key, owners.map(id => `${key.slice(0, separator)}:${id}`)));
    }
  });
  return writes;
}

/**
 * The field writes that delete a removed character's id keys from the four settings maps, so a
 * character added later with the same id does not take over its choices. Nothing is deleted for
 * a character without an id, or when another character still has the same id.
 *
 * Args:
 *   settings: the settings document (only the four maps are read).
 *   character: the character being removed.
 *   remaining: the characters that stay in the roster.
 */
export function removedCharacterWrites(settings: Record<string, unknown>, character: CharacterRef, remaining: CharacterRef[]): FieldWrite[] {
  if (!character.id || remaining.some(c => c.id === character.id)) {
    return [];
  }
  const id = String(character.id);
  const writes: FieldWrite[] = [];
  PREFIXED_FIELDS.forEach(field => {
    Object.keys((settings[field] as Record<string, unknown> | undefined) ?? {})
      .filter(key => key.startsWith(`${id}:`))
      .forEach(key => writes.push({ path: [field, key], delete: true }));
  });
  const manualGold = (settings["manualGoldEntries"] as Record<string, unknown> | undefined) ?? {};
  MANUAL_GOLD_TYPES
    .map(type => `${type}:${id}`)
    .filter(key => manualGold[key] !== undefined)
    .forEach(key => writes.push({ path: ["manualGoldEntries", key], delete: true }));
  return writes;
}
