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

/** Warning for data already over the cap (for example imported); ticks are never removed automatically. */
export function getGoldCapWarning(goldRaidCount: number): string | undefined {
  return goldRaidCount > MAX_GOLD_RAIDS ? `Gold from ${goldRaidCount} raids, max is ${MAX_GOLD_RAIDS}` : undefined;
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
 * The roster's week: every character's total summed, with bound below zero taken from tradable,
 * and how many of the characters are gold earners.
 */
export function getRosterSummary(totals: GoldTotal[], characters: { weeklyGold?: boolean }[]): GoldTotal & { goldEarners: number } {
  const sum = totals.reduce((acc, total) => {
    acc.unboundGold += total.unboundGold;
    acc.boundGold += total.boundGold;
    return acc;
  }, { unboundGold: 0, boundGold: 0 });
  if (sum.boundGold < 0) {
    sum.unboundGold += sum.boundGold;
    sum.boundGold = 0;
  }
  return { ...sum, goldEarners: groupPlannerCharacters(characters).goldEarners.length };
}
