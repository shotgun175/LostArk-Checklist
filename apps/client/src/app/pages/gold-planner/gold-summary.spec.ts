import { completionLabel, formatCompactGold, getGoldBar, settleChests, summarizeCharacterGold, sumGoldSummaries } from './gold-summary';

describe('settleChests', () => {
  it('pays chests from bound first when bound covers them', () => {
    expect(settleChests({ tradable: 102000, bound: 50000, chests: 48640 }))
      .toEqual({ tradable: 102000, bound: 1360, chests: 48640, fromBound: 48640, fromTradable: 0 });
  });

  it('pays the rest from tradable once bound runs out, and bound never goes negative', () => {
    expect(settleChests({ tradable: 92000, bound: 40000, chests: 42240 }))
      .toEqual({ tradable: 89760, bound: 0, chests: 42240, fromBound: 40000, fromTradable: 2240 });
  });

  it('pays everything from tradable when there is no bound gold (the Valhuggin case)', () => {
    expect(settleChests({ tradable: 102000, bound: 0, chests: 32640 }))
      .toEqual({ tradable: 69360, bound: 0, chests: 32640, fromBound: 0, fromTradable: 32640 });
  });

  it('lets tradable go below zero when chests cost more than all the gold', () => {
    expect(settleChests({ tradable: 0, bound: 0, chests: 2530 }))
      .toEqual({ tradable: -2530, bound: 0, chests: 2530, fromBound: 0, fromTradable: 2530 });
  });

  it('changes nothing without chests', () => {
    expect(settleChests({ tradable: 500, bound: 300, chests: 0 }))
      .toEqual({ tradable: 500, bound: 300, chests: 0, fromBound: 0, fromTradable: 0 });
  });
});

describe('summarizeCharacterGold', () => {
  // Kazeros HM and Serca Nightmare done, Horizon Cathedral Nightmare (all bound) to do; chests on all three
  const cells = [
    { tradable: 16000, bound: 0, chest: 5120, done: true },
    { tradable: 32000, bound: 0, chest: 10240, done: true },
    { tradable: 21000, bound: 0, chest: 6720, done: true },
    { tradable: 33000, bound: 0, chest: 10560, done: true },
    { tradable: 0, bound: 20000, chest: 6400, done: false },
    { tradable: 0, bound: 30000, chest: 9600, done: false }
  ];

  it('possible is the gross gold of every planned cell, before chests', () => {
    expect(summarizeCharacterGold(cells, []).possible).toBe(152000);
  });

  it('earned counts only done cells, with chests paid so far settled bound first', () => {
    const summary = summarizeCharacterGold(cells, []);
    expect(summary.earnedGross).toBe(102000);
    expect(summary.earned).toEqual({ tradable: 69360, bound: 0, chests: 32640, fromBound: 0, fromTradable: 32640 });
    expect(summary.net).toBe(69360);
    expect(summary.percent).toBe(67);
  });

  it('plan settles every planned cell, done or not', () => {
    expect(summarizeCharacterGold(cells, []).plan).toEqual({ tradable: 102000, bound: 1360, chests: 48640, fromBound: 48640, fromTradable: 0 });
  });

  it('counts Chaos and Other entries as earned tradable and adds them to possible', () => {
    const summary = summarizeCharacterGold([{ tradable: 0, bound: 16000, chest: 5120, done: true }, { tradable: 0, bound: 24000, chest: 7680, done: false }], [2000, 0]);
    expect(summary.possible).toBe(42000);
    expect(summary.earnedGross).toBe(18000);
    expect(summary.earned).toEqual({ tradable: 2000, bound: 10880, chests: 5120, fromBound: 5120, fromTradable: 0 });
    expect(summary.net).toBe(12880);
    // 42.9% is shown as 42: rounded down, so 100% means everything possible is earned
    expect(summary.percent).toBe(42);
  });

  it('a negative Other entry (a bus cost) lowers earned tradable but not possible', () => {
    const summary = summarizeCharacterGold([{ tradable: 1000, bound: 0, chest: 0, done: true }], [0, -300]);
    expect(summary.possible).toBe(1000);
    expect(summary.earned.tradable).toBe(700);
    expect(summary.net).toBe(700);
  });

  it('a character with only chests has nothing possible, 0% earned and a negative net', () => {
    const summary = summarizeCharacterGold([{ tradable: 0, bound: 0, chest: 2530, done: true }], []);
    expect(summary.possible).toBe(0);
    expect(summary.percent).toBe(0);
    expect(summary.net).toBe(-2530);
  });

  it('a character with nothing planned is all zeros', () => {
    expect(summarizeCharacterGold([], [0, 0])).toEqual({
      possible: 0,
      earnedGross: 0,
      net: 0,
      percent: 0,
      earned: { tradable: 0, bound: 0, chests: 0, fromBound: 0, fromTradable: 0 },
      plan: { tradable: 0, bound: 0, chests: 0, fromBound: 0, fromTradable: 0 }
    });
  });
});

describe('sumGoldSummaries', () => {
  it('adds the settled numbers of each character, so one character\'s bound never pays another\'s chests', () => {
    const noBound = summarizeCharacterGold([{ tradable: 102000, bound: 0, chest: 32640, done: true }], []);
    const boundOnly = summarizeCharacterGold([{ tradable: 0, bound: 50000, chest: 0, done: true }], []);
    const roster = sumGoldSummaries([noBound, boundOnly]);
    expect(roster.earned).toEqual({ tradable: 69360, bound: 50000, chests: 32640, fromBound: 0, fromTradable: 32640 });
    expect(roster.net).toBe(119360);
    expect(roster.possible).toBe(152000);
    expect(roster.earnedGross).toBe(152000);
    expect(roster.percent).toBe(100);
  });

  it('is all zeros for an empty roster', () => {
    expect(sumGoldSummaries([]).percent).toBe(0);
    expect(sumGoldSummaries([]).net).toBe(0);
  });
});

describe('getGoldBar', () => {
  const widths = (bar: ReturnType<typeof getGoldBar>) => bar.map(segment => Math.round(segment.width * 10) / 10);

  it('splits the possible width into earned tradable, earned bound, chests paid and not earned yet', () => {
    const summary = summarizeCharacterGold([
      { tradable: 0, bound: 16000, chest: 5120, done: true },
      { tradable: 0, bound: 24000, chest: 7680, done: false }
    ], []);
    expect(getGoldBar(summary).map(segment => segment.kind)).toEqual(['tradable', 'bound', 'chests', 'rest']);
    expect(widths(getGoldBar(summary))).toEqual([0, 27.2, 12.8, 60]);
  });

  it('shows a full chests bar for a character that only pays chests', () => {
    expect(widths(getGoldBar(summarizeCharacterGold([{ tradable: 0, bound: 0, chest: 2530, done: true }], [])))).toEqual([0, 0, 100, 0]);
  });

  it('is empty when there is nothing at all', () => {
    expect(widths(getGoldBar(summarizeCharacterGold([], [])))).toEqual([0, 0, 0, 0]);
  });
});

describe('formatCompactGold', () => {
  it('shortens thousands to k with one decimal below 100k and none above', () => {
    expect(formatCompactGold(69360)).toBe('69.4k');
    expect(formatCompactGold(152000)).toBe('152k');
    expect(formatCompactGold(102000)).toBe('102k');
    expect(formatCompactGold(1360)).toBe('1.4k');
    expect(formatCompactGold(74000)).toBe('74k');
  });

  it('keeps small numbers and the sign', () => {
    expect(formatCompactGold(0)).toBe('0');
    expect(formatCompactGold(850)).toBe('850');
    expect(formatCompactGold(-2530)).toBe('-2.5k');
  });
});

describe('completionLabel', () => {
  it('says done, to do, or how many gates are done', () => {
    expect(completionLabel(2, 2)).toBe('done');
    expect(completionLabel(0, 2)).toBe('to do');
    expect(completionLabel(1, 2)).toBe('1 of 2 done');
  });

  it('has no label when the character has no gate there', () => {
    expect(completionLabel(0, 0)).toBeUndefined();
  });
});
