/**
 * Characters that get a column: everyone when "Show your hidden characters" is on,
 * otherwise only characters without the Hide flag. Keeps roster order, so index i
 * of the result is column i.
 */
export function filterVisibleCharacters<T extends { isHide?: boolean }>(characters: T[], showHidden: boolean): T[] {
  return showHidden ? characters : characters.filter(character => !character.isHide);
}

/** Gold planner columns: visible characters (see filterVisibleCharacters) with Weekly Gold on. */
export function filterGoldPlannerCharacters<T extends { isHide?: boolean; weeklyGold: boolean }>(characters: T[], showHidden: boolean): T[] {
  return filterVisibleCharacters(characters, showHidden).filter(character => character.weeklyGold);
}
