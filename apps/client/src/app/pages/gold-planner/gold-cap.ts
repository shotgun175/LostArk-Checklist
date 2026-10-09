import { Character } from "../../model/character/character";
import { LostarkTask } from "../../model/lostark-task";
import { isTaskInIlvlRange, isTaskTracked } from "../../core/task-tracking";
import { raidReleaseOrder } from "../../core/tasks";
import { goldTasks } from "./gold-tasks";
import { getCountedRunningMode, GoldTask, MAX_GOLD_RAIDS } from "./gold-task";
import { characterFlagKey, readCharacterFlag } from "../../core/character-keys";

/** The raids unticked for one character by capGoldTracking, and the ones it kept. */
export interface GoldCapUntick {
  characterName: string;
  raids: string[];
  kept: string[];
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
 * A saved Hard or Nightmare the character's item level cannot run is ranked by the mode it counts as (getCountedRunningMode).
 * Without the task list nothing is capped, since tracking and item level ranges are unknown then.
 * When two characters share a name (the same name on NA and EU), each one's item level is added to its name in the result.
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
          if (!counted || readCharacterFlag(tracking, character, `gold:taking:${gate.name}`) !== true) {
            return;
          }
          takingGold = true;
          const countedMode = getCountedRunningMode(gate, character, readCharacterFlag(raidModes, character, `runningMode:${gate.name}`)).mode;
          const mode = gate.modes.find(m => m.name === countedMode);
          gold += mode && mode.goldILvlLimit > character.ilvl ? mode.unboundGoldReward + mode.boundGoldReward : 0;
        });
        return { gTask, gold, takingGold, releaseIndex: releaseIndex(gTask) };
      })
      .filter(raid => raid.takingGold);
    if (goldRaids.length <= MAX_GOLD_RAIDS) {
      return;
    }
    const ranked = [...goldRaids].sort((a, b) => b.gold - a.gold || a.releaseIndex - b.releaseIndex);
    const dropped = ranked.slice(MAX_GOLD_RAIDS);
    if (capped === tracking) {
      capped = { ...tracking };
    }
    dropped.forEach(({ gTask }) => gTask.gates.forEach(gate => {
      if (readCharacterFlag(capped, character, `gold:taking:${gate.name}`)) {
        capped[characterFlagKey(character, `gold:taking:${gate.name}`)] = false;
      }
    }));
    unticked.push({
      characterName: characters.some(other => other !== character && other.name === character.name)
        ? `${character.name} (${character.ilvl})`
        : character.name,
      raids: dropped.map(raid => raid.gTask.name),
      kept: ranked.slice(0, MAX_GOLD_RAIDS).map(raid => raid.gTask.name)
    });
  });
  return { tracking: capped, unticked };
}

/** The message shown after unticking, for example "Brakka can take gold from 3 raids a week. Kept Kazeros, Serca, Horizon Cathedral; unticked Armoche." */
export function formatGoldCapMessage(unticked: GoldCapUntick[]): string {
  return unticked
    .map(({ characterName, raids, kept }) =>
      `${characterName} can take gold from ${MAX_GOLD_RAIDS} raids a week. Kept ${kept.join(", ")}; unticked ${raids.join(", ")}.`)
    .join(" ");
}
