/** A roster can have Weekly Gold on at most this many characters, as in the game. */
export const MAX_WEEKLY_GOLD_CHARACTERS = 6;

interface WeeklyGoldCharacter {
  weeklyGold?: boolean;
}

/** How many characters have Weekly Gold on. */
export function countWeeklyGoldCharacters(characters: WeeklyGoldCharacter[]): number {
  return characters.filter(character => character.weeklyGold === true).length;
}

/** The Weekly Gold tick is disabled on a character without it once the roster already has the maximum. */
export function isWeeklyGoldTickDisabled(characters: WeeklyGoldCharacter[], character: WeeklyGoldCharacter): boolean {
  return !character.weeklyGold && countWeeklyGoldCharacters(characters) >= MAX_WEEKLY_GOLD_CHARACTERS;
}

/** Weekly Gold for a character being added: on while the roster has fewer than the maximum. */
export function newCharacterWeeklyGold(characters: WeeklyGoldCharacter[]): boolean {
  return countWeeklyGoldCharacters(characters) < MAX_WEEKLY_GOLD_CHARACTERS;
}

/** Warning for data already over the maximum (for example imported); ticks are never removed automatically. */
export function getWeeklyGoldLimitWarning(weeklyGoldCount: number): string | undefined {
  return weeklyGoldCount > MAX_WEEKLY_GOLD_CHARACTERS ? `Weekly gold on ${weeklyGoldCount} characters, max is ${MAX_WEEKLY_GOLD_CHARACTERS}` : undefined;
}

/**
 * Fills a missing weeklyGold, in roster order, with true while the roster has fewer than the maximum.
 * Characters that already have a value keep it. Mutates the characters.
 *
 * Returns:
 *   Whether any character was changed.
 */
export function applyWeeklyGoldDefaults(characters: WeeklyGoldCharacter[]): boolean {
  let count = countWeeklyGoldCharacters(characters);
  let changed = false;
  characters.forEach(character => {
    if (character.weeklyGold === undefined) {
      changed = true;
      character.weeklyGold = count < MAX_WEEKLY_GOLD_CHARACTERS;
      if (character.weeklyGold) {
        count++;
      }
    }
  });
  return changed;
}
