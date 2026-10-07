import { LostarkTask } from "../model/lostark-task";
import { Character } from "../model/character/character";
import { raidReleaseOrder } from "./tasks";
import { getCompletionEntry } from "./get-completion-entry-key";

/** How many of the newest enterable raids a character tracks by default. */
export const DEFAULT_TRACKED_RAIDS = 3;

const raidIndexByLabel = new Map<string, number>(
  raidReleaseOrder.flatMap((labels, index) => labels.map(label => [label.toLowerCase(), index] as [string, number]))
);

function raidIndex(task: LostarkTask): number | undefined {
  return task.custom ? undefined : raidIndexByLabel.get(task.label?.toLowerCase());
}

/**
 * Lowercase labels of the raid tasks a character tracks by default: every task of the
 * 3 newest raids (by raidReleaseOrder) that have an enabled task the character can enter.
 */
export function getDefaultTrackedRaidLabels(character: Pick<Character, "ilvl">, tasks: LostarkTask[]): Set<string> {
  const enterable = new Set<number>();
  tasks.forEach(task => {
    const index = raidIndex(task);
    if (index !== undefined && task.enabled
      && character.ilvl >= (task.minIlvl || 0) && character.ilvl < (task.maxIlvl || Infinity)) {
      enterable.add(index);
    }
  });
  const newest = [...enterable].sort((a, b) => a - b).slice(0, DEFAULT_TRACKED_RAIDS);
  return new Set(newest.flatMap(index => raidReleaseOrder[index].map(label => label.toLowerCase())));
}

/** The user's explicit tracking choice for this cell, or undefined when it follows the default. */
export function getTrackedTaskOverride(trackedTasks: Record<string, boolean | undefined> | undefined, character: Character, task: LostarkTask): boolean | undefined {
  const entry = trackedTasks ? getCompletionEntry(trackedTasks, character, task, true) : undefined;
  return typeof entry === "boolean" ? entry : undefined;
}

/**
 * Whether a character tracks a task: the explicit choice from Settings > Task tracking when set,
 * otherwise raid tasks are tracked only for the character's newest raids and other tasks are tracked.
 *
 * Args:
 *   trackedTasks: roster.trackedTasks (explicit choices).
 *   character: the character of the cell.
 *   task: the task of the cell.
 *   tasks: the full task list, used to find the newest raids the character can enter.
 */
export function isTaskTracked(trackedTasks: Record<string, boolean | undefined> | undefined, character: Character, task: LostarkTask, tasks: LostarkTask[]): boolean {
  const override = getTrackedTaskOverride(trackedTasks, character, task);
  if (override !== undefined) {
    return override;
  }
  if (raidIndex(task) === undefined) {
    return true;
  }
  return getDefaultTrackedRaidLabels(character, tasks).has(task.label.toLowerCase());
}

/** Whether the character's item level lets it do the task: at least minIlvl and below maxIlvl. */
export function isTaskInIlvlRange(character: Pick<Character, "ilvl">, task: Pick<LostarkTask, "minIlvl" | "maxIlvl">): boolean {
  return character.ilvl >= (task.minIlvl || 0) && character.ilvl < (task.maxIlvl || Infinity);
}

/** Every key of roster.trackedTasks that holds an explicit choice (a boolean). */
export function getExplicitTrackingKeys(trackedTasks: Record<string, boolean | undefined> | undefined): string[] {
  return Object.keys(trackedTasks || {}).filter(key => typeof trackedTasks?.[key] === "boolean");
}

/**
 * The explicit-choice keys of one character: keys stored under its id and legacy keys stored under its name.
 *
 * Args:
 *   trackedTasks: roster.trackedTasks (explicit choices).
 *   character: the character whose keys to list.
 */
export function getExplicitTrackingKeysForCharacter(trackedTasks: Record<string, boolean | undefined> | undefined, character: Pick<Character, "id" | "name">): string[] {
  const prefixes = [`${character.name}:`];
  if (character.id) {
    prefixes.push(`${character.id}:`);
  }
  return getExplicitTrackingKeys(trackedTasks).filter(key => prefixes.some(prefix => key.startsWith(prefix)));
}
