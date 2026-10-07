import { Character } from "../../model/character/character";
import { LostarkTask } from "../../model/lostark-task";
import { isTaskInIlvlRange, isTaskTracked } from "../../core/task-tracking";
import { raidReleaseOrder } from "../../core/tasks";
import { goldTasks } from "./gold-tasks";
import { GoldTask, MAX_GOLD_RAIDS } from "./gold-task";

/** The raids unticked for one character by capGoldTracking. */
export interface GoldCapUntick {
  characterName: string;
  raids: string[];
}

/** Position of a raid in raidReleaseOrder (0 is the newest); raids not listed sort as oldest. */
function releaseIndex(gTask: GoldTask): number {
  const labels = [gTask.taskName, ...gTask.gates.map(gate => gate.taskName)].filter((label): label is string => !!label);
  const indexes = labels
    .map(label => raidReleaseOrder.findIndex(raid => raid.includes(label)))
    .filter(index => index >= 0);
  return indexes.length ? Math.min(...indexes) : Infinity;
}

/**
 * Keeps each Weekly Gold character to MAX_GOLD_RAIDS raids taking gold. A gate counts the way the
 * Gold Planner counts it: Taking Gold ticked on a gate whose task is enabled, tracked and in the
 * character's item level range. When more raids count, the ones paying the most gold for the
 * selected modes stay (ties go to the newer raid) and Taking Gold is unticked on every gate of the rest.
 * Without the task list nothing is capped, since tracking and item level ranges are unknown then.
 *
 * Args:
 *   characters: every character of the roster.
 *   tracking: settings.goldPlannerConfiguration.
 *   raidModes: settings.raidModesForGoldPlanner.
 *   tasks: the full task list.
 *   trackedTasks: roster.trackedTasks.
 *   gTasks: the gold raids, goldTasks by default.
 *
 * Returns:
 *   The capped tracking (the same object when nothing changed) and the raids unticked per character.
 */
export function capGoldTracking(characters: Character[], tracking: Record<string, boolean>, raidModes: Record<string, string> | undefined,
                                tasks: LostarkTask[], trackedTasks: Record<string, boolean | undefined> | undefined,
                                gTasks: GoldTask[] = goldTasks): { tracking: Record<string, boolean>, unticked: GoldCapUntick[] } {
  const unticked: GoldCapUntick[] = [];
  if (tasks.length === 0 || !tracking) {
    return { tracking, unticked };
  }
  let capped = tracking;
  characters.filter(character => character.weeklyGold).forEach(character => {
    const goldRaids = gTasks
      .map(gTask => {
        let gold = 0;
        let takingGold = false;
        gTask.gates.forEach(gate => {
          const task = tasks.find(t => t.label === (gate.taskName || gTask.taskName) && !t.custom);
          const counted = !task || (task.enabled && isTaskInIlvlRange(character, task) && isTaskTracked(trackedTasks, character, task, tasks));
          if (!counted || tracking[`${character.name}:gold:taking:${gate.name}`] !== true) {
            return;
          }
          takingGold = true;
          const mode = gate.modes.find(m => m.name === raidModes?.[`${character.name}:runningMode:${gate.name}`]);
          gold += mode && mode.goldILvlLimit > character.ilvl ? mode.unboundGoldReward + mode.boundGoldReward : 0;
        });
        return { gTask, gold, takingGold, releaseIndex: releaseIndex(gTask) };
      })
      .filter(raid => raid.takingGold);
    if (goldRaids.length <= MAX_GOLD_RAIDS) {
      return;
    }
    const dropped = [...goldRaids]
      .sort((a, b) => b.gold - a.gold || a.releaseIndex - b.releaseIndex)
      .slice(MAX_GOLD_RAIDS);
    if (capped === tracking) {
      capped = { ...tracking };
    }
    dropped.forEach(({ gTask }) => gTask.gates.forEach(gate => {
      const key = `${character.name}:gold:taking:${gate.name}`;
      if (capped[key]) {
        capped[key] = false;
      }
    }));
    unticked.push({ characterName: character.name, raids: dropped.map(raid => raid.gTask.name) });
  });
  return { tracking: capped, unticked };
}

/** The message shown after unticking, for example "Valtist: gold limit is 3 raids, unticked Echidna". */
export function formatGoldCapMessage(unticked: GoldCapUntick[]): string {
  return unticked
    .map(({ characterName, raids }) => `${characterName}: gold limit is ${MAX_GOLD_RAIDS} raids, unticked ${raids.join(", ")}`)
    .join(". ");
}
