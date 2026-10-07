import { LostarkTask } from "../model/lostark-task";
import { Character } from "../model/character/character";
import { TaskScope } from "../model/task-scope";
import { raidReleaseOrder } from "./tasks";
import { getCompletionEntry, getCompletionEntryKey } from "./get-completion-entry-key";

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
    if (index !== undefined && task.enabled && isTaskInIlvlRange(character, task)) {
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
 * The explicit-choice keys of one character that the grid reads: keys under its id, or under its
 * name when it has no id. Legacy name keys of a character with an id are left to Reset all.
 *
 * Args:
 *   trackedTasks: roster.trackedTasks (explicit choices).
 *   character: the character whose keys to list.
 */
export function getExplicitTrackingKeysForCharacter(trackedTasks: Record<string, boolean | undefined> | undefined, character: Pick<Character, "id" | "name">): string[] {
  const prefix = character.id ? `${character.id}:` : `${character.name}:`;
  return getExplicitTrackingKeys(trackedTasks).filter(key => key.startsWith(prefix));
}

/**
 * How many explicit choices one character has among the tasks the grid shows. Keys left behind by
 * deleted tasks or tasks moved to roster scope are not counted, since no switch shows them.
 *
 * Args:
 *   trackedTasks: roster.trackedTasks (explicit choices).
 *   character: the character whose choices to count.
 *   gridTasks: the tasks shown in the grid.
 */
export function countGridTrackingChoices(trackedTasks: Record<string, boolean | undefined> | undefined, character: Pick<Character, "id" | "name">, gridTasks: LostarkTask[]): number {
  return gridTasks.filter(task => typeof trackedTasks?.[getCompletionEntryKey(character, task)] === "boolean").length;
}

/** Whether the task is a raid or abyssal dungeon listed in raidReleaseOrder (custom tasks never are). */
export function isRaidTask(task: LostarkTask): boolean {
  return raidIndex(task) !== undefined;
}

/**
 * Whether a raid task stays in the main Task tracking list instead of the Older raids group:
 * for at least one grid character whose item level fits it, it is among the default newest raids
 * or has an explicit true. An explicit true on a character outside the item level range does not count.
 *
 * Args:
 *   trackedTasks: roster.trackedTasks (explicit choices).
 *   characters: the characters shown in the grid.
 *   task: the raid task.
 *   tasks: the full task list, used to find each character's newest raids.
 */
export function isRaidInMainList(trackedTasks: Record<string, boolean | undefined> | undefined, characters: Character[], task: LostarkTask, tasks: LostarkTask[]): boolean {
  const label = task.label.toLowerCase();
  return characters.some(c => isTaskInIlvlRange(c, task)
    && (getTrackedTaskOverride(trackedTasks, c, task) === true || getDefaultTrackedRaidLabels(c, tasks).has(label)));
}

/**
 * The tasks of the Settings > Task tracking grid, in task order, split into its sections:
 * current raids, Older raids, and every other character task. Tasks switched off in
 * Tasks Manager and roster tasks are left out.
 *
 * Args:
 *   trackedTasks: roster.trackedTasks (explicit choices).
 *   visibleCharacters: the characters that decide whether a raid is current (not hidden).
 *   tasks: the full task list.
 */
export function groupTrackingGridTasks(trackedTasks: Record<string, boolean | undefined> | undefined, visibleCharacters: Character[], tasks: LostarkTask[]): { raids: LostarkTask[], olderRaids: LostarkTask[], others: LostarkTask[] } {
  const gridTasks = tasks.filter(task => task.scope === TaskScope.CHARACTER && task.enabled !== false);
  const raidTasks = gridTasks.filter(isRaidTask);
  const isCurrent = (task: LostarkTask) => isRaidInMainList(trackedTasks, visibleCharacters, task, tasks);
  return {
    raids: raidTasks.filter(isCurrent),
    olderRaids: raidTasks.filter(task => !isCurrent(task)),
    others: gridTasks.filter(task => !isRaidTask(task))
  };
}

/** The tracking keys a "set for all" action writes: one per grid character whose item level fits the task. */
export function getSetForAllKeys(characters: Character[], task: LostarkTask): string[] {
  return characters.filter(c => isTaskInIlvlRange(c, task)).map(c => getCompletionEntryKey(c, task));
}
