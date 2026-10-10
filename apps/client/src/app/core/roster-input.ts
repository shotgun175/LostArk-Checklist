import { Character } from "../model/character/character";
import { LostarkClass } from "../model/character/lostark-class";

/** Lost Ark character names are at most 16 characters long. */
export const MAX_CHARACTER_NAME_LENGTH = 16;

/**
 * The highest item level the Roster accepts: the highest item level in the Global game right now.
 * Raise it when the game raises it (the patch notes sync checks it).
 */
export const MAX_CHARACTER_ILVL = 1805;

// Control characters plus zero-width and other invisible format characters (soft hyphen, joiners, direction marks, BOM)
const INVISIBLE = /[\p{Cc}\p{Cf}]/gu;

/** A name as it is saved: invisible characters removed, trimmed and cut to 16 characters. */
export function cleanCharacterName(raw: unknown): string {
  if (typeof raw !== "string") {
    return "";
  }
  return [...raw.replace(INVISIBLE, "").trim()].slice(0, MAX_CHARACTER_NAME_LENGTH).join("").trim();
}

/**
 * Why a cleaned name cannot be saved, or null when it can: only an empty name is refused. Two
 * characters may share a name (names are unique only per region, NA or EU); every per-character
 * choice is keyed by the character id, so they stay apart.
 */
export function characterNameError(name: string): string | null {
  return name === "" ? "A character name cannot be empty." : null;
}

/** The id for a new character: one more than the highest id, compared as numbers. Ids start at 1, since 0 counts as no id. */
export function nextCharacterId(characters: Pick<Character, "id">[]): number {
  const ids = characters.map(c => Number(c.id)).filter(id => Number.isFinite(id));
  return Math.max(0, ...ids) + 1;
}

/**
 * Gives every character whose id was already used by an earlier one a new id, so saving one
 * character can never overwrite another. Returns whether anything changed.
 */
export function fixDuplicateCharacterIds(characters: Pick<Character, "id">[]): boolean {
  const seen = new Set<number>();
  let changed = false;
  characters.forEach(c => {
    if (c.id && seen.has(c.id)) {
      c.id = nextCharacterId(characters);
      changed = true;
    }
    if (c.id) {
      seen.add(c.id);
    }
  });
  return changed;
}

/** A stored class as a LostarkClass number: null stays null, a numeric string becomes its number, anything else is undefined. */
export function toClassNumber(value: unknown): LostarkClass | null | undefined {
  if (value === null) {
    return null;
  }
  const number = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  return typeof number === "number" && Number.isInteger(number) && LostarkClass[number] !== undefined ? number : undefined;
}

function toNumber(value: unknown): number | undefined {
  const number = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  return typeof number === "number" && Number.isFinite(number) ? number : undefined;
}

export interface RosterImportResult {
  ok: boolean;
  errors: string[];
  characters: Character[];
}

const NOT_A_ROSTER = "That does not look like an exported roster.";

/**
 * Reads the text pasted into Import roster. Each character must be an object with an id, a name,
 * a numeric item level and a known class (or none), as Settings > Restore backup requires.
 * Names are cleaned, numbers and classes are stored as numbers, and an id used twice in the file
 * is replaced. Nothing is returned unless every character is valid.
 */
export function parseRosterImport(text: string): RosterImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, errors: [NOT_A_ROSTER], characters: [] };
  }
  const list = typeof parsed === "object" && parsed !== null ? (parsed as { characters?: unknown }).characters : undefined;
  if (!Array.isArray(list)) {
    return { ok: false, errors: [NOT_A_ROSTER], characters: [] };
  }
  if (list.length === 0) {
    return { ok: false, errors: ["No characters found."], characters: [] };
  }
  const errors: string[] = [];
  const characters: Character[] = [];
  list.forEach((entry: unknown, index) => {
    const label = `Character ${index + 1}`;
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      errors.push(`${label} is not a character.`);
      return;
    }
    const raw = entry as Record<string, unknown>;
    const name = cleanCharacterName(raw["name"]);
    const shown = name ? ` (${name})` : "";
    const problems: string[] = [];
    const id = toNumber(raw["id"]);
    if (!id) {
      problems.push("has no id");
    }
    if (!name) {
      problems.push("has no name");
    }
    const ilvl = toNumber(raw["ilvl"]);
    if (ilvl === undefined) {
      problems.push("has no numeric item level");
    }
    const characterClass = raw["class"] === undefined ? null : toClassNumber(raw["class"]);
    if (characterClass === undefined) {
      problems.push("has an unknown class");
    }
    if (problems.length > 0) {
      errors.push(`${label}${shown} ${problems.join(", ")}.`);
      return;
    }
    characters.push({ ...raw, id, name, ilvl, class: characterClass } as Character);
  });
  if (errors.length > 0) {
    return { ok: false, errors, characters: [] };
  }
  fixDuplicateCharacterIds(characters);
  return { ok: true, errors, characters };
}
