import { Character } from "../../model/character/character";

export interface Gate {
  name: string,
  taskName?: string,
  completionId: string,
  chestId?: string;
  modes: {
    name: string,
    HMThreashold?: number,
    NightmareThreashold?: number,
    goldILvlLimit: number,
    unboundGoldReward: number,
    boundGoldReward: number,
    chestPrice: number,
  }[],
  reset?: resetType
}

export interface GoldTask {
  name: string;
  taskName: string;
  gates: Gate[]
}


export enum resetType {
  weekly,
  biWeekly,
  biWeeklyOffset
}

export function canRunHardModeForGateAndCharacter(gate: Gate, character: Character): boolean {
  const normalMode = gate.modes.find(mode => mode.name === 'NM')
  return normalMode?.HMThreashold ? normalMode.HMThreashold <= character.ilvl : true
}

export function canRunNightmareModeForGateAndCharacter(gate: Gate, character: Character): boolean {
  const hardMode = gate.modes.find(mode => mode.name === 'HM')
  return hardMode?.NightmareThreashold ? hardMode.NightmareThreashold <= character.ilvl : true
}

export function getHigherModeForGate(gate: Gate, selectedMode: string, character: Character): string | undefined {
  if (selectedMode === 'NM') {
    if (gate.modes.some(mode => mode.name === 'Nightmare') && canRunNightmareModeForGateAndCharacter(gate, character)) {
      return 'Nightmare'
    }
    if (gate.modes.some(mode => mode.name === 'HM') && canRunHardModeForGateAndCharacter(gate, character)) {
      return 'HM'
    }
  } else if (selectedMode === 'HM' && gate.modes.some(mode => mode.name === 'Nightmare') && canRunNightmareModeForGateAndCharacter(gate, character)) {
    return 'Nightmare'
  }

  return undefined;
}

/** Mode set when gold is first ticked for a gate: the highest of Nightmare, Hard and Normal the character can run, never Solo. */
export function pickDefaultRunningMode(gate: Gate, character: Character): string | undefined {
  return getHigherModeForGate(gate, 'NM', character)
    ?? (gate.modes.some(mode => mode.name === 'NM') ? 'NM' : undefined)
}

const MODE_LABELS: Record<string, string> = { Solo: 'Solo', NM: 'Normal', HM: 'Hard', Nightmare: 'Nightmare' };

/** A mode as the planner's buttons name it: NM is Normal, HM is Hard. */
export function getModeLabel(mode: string): string {
  return MODE_LABELS[mode] ?? mode;
}

/** The mode a gate counts as for gold, chests and the gold cap, and the item level the saved mode needs when it cannot count. */
export interface CountedMode {
  mode: string | undefined;
  /** Set only when the saved Hard or Nightmare cannot count: the item level that mode needs. */
  needsIlvl?: number;
}

/**
 * The mode a gate counts as: the saved mode, unless it is Hard or Nightmare and the character's item level
 * cannot run it; then the mode pickDefaultRunningMode would pick. The saved mode itself is not changed.
 */
export function getCountedRunningMode(gate: Gate, character: Character, savedMode: string | undefined): CountedMode {
  if (savedMode === 'HM' && !canRunHardModeForGateAndCharacter(gate, character)) {
    return { mode: pickDefaultRunningMode(gate, character), needsIlvl: gate.modes.find(mode => mode.name === 'NM')?.HMThreashold };
  }
  if (savedMode === 'Nightmare' && !canRunNightmareModeForGateAndCharacter(gate, character)) {
    return { mode: pickDefaultRunningMode(gate, character), needsIlvl: gate.modes.find(mode => mode.name === 'HM')?.NightmareThreashold };
  }
  return { mode: savedMode };
}

/** The tag shown next to a raid whose saved mode the character cannot run, for example "Hard needs 1730, counted as Normal". */
export function getCountedModeNote(savedMode: string | undefined, counted: CountedMode): string | undefined {
  if (!savedMode || counted.mode === savedMode) {
    return undefined;
  }
  const needs = counted.needsIlvl !== undefined && Number.isFinite(counted.needsIlvl) ? `needs ${counted.needsIlvl}` : 'is not available';
  return `${getModeLabel(savedMode)} ${needs}, counted as ${counted.mode ? getModeLabel(counted.mode) : 'no mode'}`;
}

/** Auto-pick only when gold is being ticked and the gate has no running mode yet (any set mode, Solo included, is kept). */
export function shouldAutoPickRunningMode(takingGold: boolean, currentMode: string | undefined): boolean {
  return takingGold && !currentMode
}

/** A character without Weekly Gold cannot tick Taking Gold, so ticking Taking Chest on a gate with no running mode picks it instead. */
export function shouldAutoPickModeOnChest(weeklyGold: boolean | undefined, takingChest: boolean, currentMode: string | undefined): boolean {
  return !weeklyGold && shouldAutoPickRunningMode(takingChest, currentMode)
}

/** A character can take gold from at most this many raids per week. */
export const MAX_GOLD_RAIDS = 3;

/** One gate cell of a character: its raid, whether Taking Gold is ticked, and whether it counts (not hidden by tracking). */
export interface GoldGateState {
  raidName: string;
  takingGold: boolean;
  counted: boolean;
}

/**
 * Whether a character's cell counts toward the gold cap: a gate line, shown by tracking, that the character's item level allows.
 * Gates already done this week still count, matching the game's weekly gold limit.
 */
export function isGateCountedForGoldCap(cell: { hiddenByTracking: boolean; isGateLine: boolean; meetsGateIlvl: boolean }): boolean {
  return !cell.hiddenByTracking && cell.isGateLine && cell.meetsGateIlvl;
}

/** Raids the character takes gold from: gold ticked on at least one counted gate. A raid counts once. */
export function getGoldRaids(gates: GoldGateState[]): Set<string> {
  return new Set(gates.filter(gate => gate.takingGold && gate.counted).map(gate => gate.raidName));
}

/** Taking Gold is disabled on a raid not yet taking gold once the character already takes gold from the maximum. */
export function isGoldTakingDisabled(goldRaids: Set<string>, raidName: string): boolean {
  return goldRaids.size >= MAX_GOLD_RAIDS && !goldRaids.has(raidName);
}

/** Gold counts only when Taking Gold is ticked and the character is one of the roster's weekly gold characters. */
export function earnsGold(takingGold: boolean | undefined, weeklyGold: boolean | undefined): boolean {
  return !!takingGold && !!weeklyGold;
}

/**
 * Why Taking Gold is disabled for a character's raid, used as the tooltip; undefined when it is enabled.
 *
 * Args:
 *   weeklyGold: whether the character has Weekly Gold on (Roster page).
 *   goldRaids: the raids the character already takes gold from (getGoldRaids).
 *   raidName: the raid of the checkbox.
 */
export function getGoldTakingDisabledReason(weeklyGold: boolean | undefined, goldRaids: Set<string>, raidName: string): string | undefined {
  if (!weeklyGold) {
    return 'Not a weekly gold character (6 per roster). Change on the Roster page.';
  }
  return isGoldTakingDisabled(goldRaids, raidName) ? `Already earning gold from ${MAX_GOLD_RAIDS} raids. Untick one to choose this raid.` : undefined;
}

/** Indexes of the planner's characters: gold earners (Weekly Gold on) and the others, each in roster order. */
export function groupPlannerCharacters(characters: { weeklyGold?: boolean }[]): { goldEarners: number[], others: number[] } {
  const indexes = characters.map((_, i) => i);
  return {
    goldEarners: indexes.filter(i => characters[i].weeklyGold),
    others: indexes.filter(i => !characters[i].weeklyGold)
  };
}

export interface GoldTotal {
  unboundGold: number;
  boundGold: number;
}

/**
 * The roster's week: every character's total summed (each already settled, so bound is never below zero),
 * and how many of the characters are gold earners.
 */
export function getRosterSummary(totals: GoldTotal[], characters: { weeklyGold?: boolean }[]): GoldTotal & { goldEarners: number } {
  const sum = totals.reduce((acc, total) => {
    acc.unboundGold += total.unboundGold;
    acc.boundGold += total.boundGold;
    return acc;
  }, { unboundGold: 0, boundGold: 0 });
  return { ...sum, goldEarners: groupPlannerCharacters(characters).goldEarners.length };
}
