/** Gold of one week after chests: chests are paid from bound gold first, then from tradable. */
export interface SettledGold {
  tradable: number;
  bound: number;
  chests: number;
  fromBound: number;
  fromTradable: number;
}

/** One planned gate of a character: gold it pays (0 when not taking gold), its chest cost (0 when not taking the chest), done this week. */
export interface GoldCell {
  tradable: number;
  bound: number;
  chest: number;
  done: boolean;
}

/** A character's (or the roster's) week: what is possible, what is earned so far, and the whole plan, each after chests. */
export interface GoldSummary {
  /** Gross gold (tradable + bound) of every planned gold gate, before chests, plus Chaos and Other entries above zero. */
  possible: number;
  /** Gross gold of the gates done this week, before chests, plus Chaos and Other entries. */
  earnedGross: number;
  /** Earned gold after the chests paid so far: earned tradable + earned bound. */
  net: number;
  /** earnedGross out of possible, rounded down and never below 0; 0 when nothing is possible. */
  percent: number;
  earned: SettledGold;
  plan: SettledGold;
}

/** Pays chests from bound gold first and the rest from tradable; bound never goes below zero, tradable can. */
export function settleChests(gold: { tradable: number, bound: number, chests: number }): SettledGold {
  const fromBound = Math.max(0, Math.min(gold.bound, gold.chests));
  const fromTradable = gold.chests - fromBound;
  return { tradable: gold.tradable - fromTradable, bound: gold.bound - fromBound, chests: gold.chests, fromBound, fromTradable };
}

function percentOf(part: number, whole: number): number {
  // A negative Other entry (a bus cost) can push the earned gold below zero; the percentage stops at 0
  return whole > 0 ? Math.max(0, Math.floor(part / whole * 100)) : 0;
}

/**
 * Sums a character's planned gates into its week.
 *
 * Args:
 *   cells: every planned gate of the character, done or not.
 *   manual: the character's Chaos Dungeons and Other sources entries; they count as earned tradable,
 *     and an entry above zero also adds to possible (a negative one, such as a bus cost, only lowers earned).
 */
export function summarizeCharacterGold(cells: GoldCell[], manual: number[]): GoldSummary {
  const manualTotal = manual.reduce((sum, amount) => sum + amount, 0);
  const manualPossible = manual.reduce((sum, amount) => sum + Math.max(0, amount), 0);
  const add = (list: GoldCell[]) => list.reduce((sum, cell) => ({
    tradable: sum.tradable + cell.tradable,
    bound: sum.bound + cell.bound,
    chests: sum.chests + cell.chest
  }), { tradable: manualTotal, bound: 0, chests: 0 });
  const all = add(cells);
  const done = add(cells.filter(cell => cell.done));
  const possible = all.tradable - manualTotal + all.bound + manualPossible;
  const earnedGross = done.tradable + done.bound;
  const earned = settleChests(done);
  return {
    possible,
    earnedGross,
    net: earned.tradable + earned.bound,
    percent: percentOf(earnedGross, possible),
    earned,
    plan: settleChests(all)
  };
}

function addSettled(a: SettledGold, b: SettledGold): SettledGold {
  return {
    tradable: a.tradable + b.tradable,
    bound: a.bound + b.bound,
    chests: a.chests + b.chests,
    fromBound: a.fromBound + b.fromBound,
    fromTradable: a.fromTradable + b.fromTradable
  };
}

/** The roster's week: each character settled on its own, then added up (one character's bound never pays another's chests). */
export function sumGoldSummaries(summaries: GoldSummary[]): GoldSummary {
  const none: SettledGold = { tradable: 0, bound: 0, chests: 0, fromBound: 0, fromTradable: 0 };
  const sum = summaries.reduce((acc, summary) => ({
    possible: acc.possible + summary.possible,
    earnedGross: acc.earnedGross + summary.earnedGross,
    net: acc.net + summary.net,
    percent: 0,
    earned: addSettled(acc.earned, summary.earned),
    plan: addSettled(acc.plan, summary.plan)
  }), { possible: 0, earnedGross: 0, net: 0, percent: 0, earned: none, plan: none });
  return { ...sum, percent: percentOf(sum.earnedGross, sum.possible) };
}

export interface GoldBarSegment {
  kind: 'tradable' | 'bound' | 'chests' | 'rest';
  /** Percent of the bar's width. */
  width: number;
}

/**
 * The stacked bar of a week: earned tradable, earned bound, chests paid so far and not earned yet.
 * The segments fill the possible gold; when chests cost more than the gold earned, they are scaled to fit.
 */
export function getGoldBar(summary: GoldSummary): GoldBarSegment[] {
  const amounts: [GoldBarSegment['kind'], number][] = [
    ['tradable', Math.max(0, summary.earned.tradable)],
    ['bound', summary.earned.bound],
    ['chests', summary.earned.chests],
    ['rest', Math.max(0, summary.possible - summary.earnedGross)]
  ];
  const total = amounts.reduce((sum, [, amount]) => sum + amount, 0);
  return amounts.map(([kind, amount]) => ({ kind, width: total > 0 ? amount / total * 100 : 0 }));
}

/** Short gold for the character list: 69360 as 69.4k, 152000 as 152k, small numbers as they are. */
export function formatCompactGold(amount: number): string {
  const sign = amount < 0 ? '-' : '';
  const value = Math.abs(amount);
  if (value < 1000) {
    return `${sign}${Math.round(value)}`;
  }
  const thousands = (value / 1000).toFixed(value >= 100000 ? 0 : 1).replace(/\.0$/, '');
  return `${sign}${thousands}k`;
}

/** Checklist completion of a raid or gate for one character: done, to do, or how many of its gates are done. */
export function completionLabel(doneGates: number, gates: number): string | undefined {
  if (gates === 0) {
    return undefined;
  }
  if (doneGates >= gates) {
    return 'done';
  }
  return doneGates === 0 ? 'to do' : `${doneGates} of ${gates} done`;
}
