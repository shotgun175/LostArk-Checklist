/** Rest bonus values move in steps of 10, from 0 up to 200 for Chaos Dungeon and 100 for the other tasks. */
export const REST_BONUS_STEP = 10;

/** The highest rest bonus a task can hold. */
export function restBonusMax(taskLabel: string | undefined): number {
  return taskLabel === "Chaos Dungeon" ? 200 : 100;
}

/**
 * The rest bonus to save for what was typed in a cell: a cleared or unreadable value becomes 0,
 * and anything else is rounded to the nearest step of 10 and kept between 0 and the task's maximum.
 */
export function normalizeRestBonus(value: unknown, max: number): number {
  const amount = typeof value === "number" ? value : Number(value);
  if (value === null || value === undefined || value === "" || !Number.isFinite(amount)) {
    return 0;
  }
  const rounded = Math.round(amount / REST_BONUS_STEP) * REST_BONUS_STEP;
  return Math.max(Math.min(rounded, max), 0);
}
