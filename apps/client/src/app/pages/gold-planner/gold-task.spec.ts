import { goldTasks } from './gold-tasks';
import { earnsGold, Gate, getGoldCapWarning, getGoldTakingDisabledReason, getRosterSummary, shouldAutoPickModeOnChest, groupPlannerCharacters, getGoldRaids, GoldGateState, isGateCountedForGoldCap, isGoldTakingDisabled, MAX_GOLD_RAIDS, pickDefaultRunningMode, shouldAutoPickRunningMode } from './gold-task';
import { Character } from '../../model/character/character';

const gate = (name: string): Gate => goldTasks.flatMap(t => t.gates).find(g => g.name === name) as Gate;
const character = (ilvl: number): Character => ({ name: 'Test', ilvl } as Character);

describe('pickDefaultRunningMode', () => {
  it('picks the highest mode the item level allows on Serca', () => {
    expect(pickDefaultRunningMode(gate('Serca Gate 1'), character(1720))).toBe('NM');
    expect(pickDefaultRunningMode(gate('Serca Gate 1'), character(1730))).toBe('HM');
    expect(pickDefaultRunningMode(gate('Serca Gate 2'), character(1740))).toBe('Nightmare');
  });

  it('picks Hard when the raid has no Nightmare', () => {
    expect(pickDefaultRunningMode(gate('Kazeros Gate 1'), character(1725))).toBe('NM');
    expect(pickDefaultRunningMode(gate('Kazeros Gate 1'), character(1730))).toBe('HM');
  });

  it('picks Normal for a raid with only Normal', () => {
    expect(pickDefaultRunningMode(gate('Argos Gate 1'), character(1400))).toBe('NM');
  });

  it('never picks Solo', () => {
    expect(pickDefaultRunningMode(gate('Valtan Gate 1'), character(1415))).not.toBe('Solo');
    expect(pickDefaultRunningMode(gate('Serca Gate 1'), character(1710))).toBe('NM');
  });
});

describe('shouldAutoPickRunningMode', () => {
  it('only picks when ticking and no mode is set yet', () => {
    expect(shouldAutoPickRunningMode(true, undefined)).toBe(true);
    expect(shouldAutoPickRunningMode(true, '')).toBe(true);
    expect(shouldAutoPickRunningMode(false, undefined)).toBe(false);
  });

  it('leaves any existing mode alone, Solo included', () => {
    ['NM', 'HM', 'Nightmare', 'Solo'].forEach(mode => expect(shouldAutoPickRunningMode(true, mode)).toBe(false));
  });
});

describe('gold raid cap', () => {
  const gold = (raidName: string, takingGold = true, counted = true): GoldGateState => ({ raidName, takingGold, counted });

  it('allows gold from 3 raids', () => {
    expect(MAX_GOLD_RAIDS).toBe(3);
  });

  it('counts a raid once however many of its gates take gold', () => {
    const raids = getGoldRaids([gold('Serca'), gold('Serca'), gold('Kazeros'), gold('Kazeros', false)]);
    expect([...raids].sort()).toEqual(['Kazeros', 'Serca']);
  });

  it('counts a raid when gold is ticked on any one of its gates', () => {
    expect([...getGoldRaids([gold('Serca', false), gold('Serca', true)])]).toEqual(['Serca']);
  });

  it('does not count gates that are not ticked or not counted (hidden by tracking)', () => {
    const raids = getGoldRaids([gold('Serca', false), gold('Armoche', true, false), gold('Kazeros')]);
    expect([...raids]).toEqual(['Kazeros']);
  });

  it('disables only the other raids once 3 raids take gold', () => {
    const raids = getGoldRaids([gold('Serca'), gold('Kazeros'), gold('Armoche')]);
    expect(isGoldTakingDisabled(raids, 'Horizon Cathedral')).toBe(true);
    ['Serca', 'Kazeros', 'Armoche'].forEach(raid => expect(isGoldTakingDisabled(raids, raid)).toBe(false));
  });

  it('disables nothing under 3 raids', () => {
    const raids = getGoldRaids([gold('Serca'), gold('Kazeros'), gold('Armoche', true, false)]);
    expect(isGoldTakingDisabled(raids, 'Horizon Cathedral')).toBe(false);
  });

  it('counts a cell only when it is a gate shown by tracking and the character meets the gate item level', () => {
    expect(isGateCountedForGoldCap({ hiddenByTracking: false, isGateLine: true, meetsGateIlvl: true })).toBe(true);
    expect(isGateCountedForGoldCap({ hiddenByTracking: true, isGateLine: true, meetsGateIlvl: true })).toBe(false);
    expect(isGateCountedForGoldCap({ hiddenByTracking: false, isGateLine: false, meetsGateIlvl: true })).toBe(false);
    expect(isGateCountedForGoldCap({ hiddenByTracking: false, isGateLine: true, meetsGateIlvl: false })).toBe(false);
  });

  it('warns only when more than 3 raids take gold', () => {
    expect(getGoldCapWarning(3)).toBeUndefined();
    expect(getGoldCapWarning(4)).toBe('Gold from 4 raids, max is 3');
  });
});

describe('non-gold characters', () => {
  const raids = (...names: string[]) => new Set(names);

  it('earns gold only when Taking Gold is ticked on a weekly gold character', () => {
    expect(earnsGold(true, true)).toBe(true);
    expect(earnsGold(true, false)).toBe(false);
    expect(earnsGold(false, true)).toBe(false);
    expect(earnsGold(undefined, true)).toBe(false);
  });

  it('disables Taking Gold on a character without Weekly Gold, with the Roster page tooltip', () => {
    expect(getGoldTakingDisabledReason(false, raids(), 'Serca')).toBe('Not a weekly gold character (6 per roster). Change on the Roster page.');
  });

  it('uses the gold cap tooltip on a weekly gold character at 3 raids, and none otherwise', () => {
    expect(getGoldTakingDisabledReason(true, raids('Serca', 'Kazeros', 'Armoche'), 'Horizon Cathedral'))
      .toBe('Already earning gold from 3 raids. Untick one to choose this raid.');
    expect(getGoldTakingDisabledReason(true, raids('Serca', 'Kazeros', 'Armoche'), 'Serca')).toBeUndefined();
    expect(getGoldTakingDisabledReason(true, raids('Serca'), 'Kazeros')).toBeUndefined();
  });
});

describe('shouldAutoPickModeOnChest', () => {
  it('picks a mode when a character without Weekly Gold ticks Taking Chest on a gate with no mode', () => {
    expect(shouldAutoPickModeOnChest(false, true, undefined)).toBe(true);
    expect(shouldAutoPickModeOnChest(false, true, '')).toBe(true);
  });

  it('never picks for weekly gold characters (they pick on Taking Gold), on untick, or over a set mode', () => {
    expect(shouldAutoPickModeOnChest(true, true, undefined)).toBe(false);
    expect(shouldAutoPickModeOnChest(false, false, undefined)).toBe(false);
    expect(shouldAutoPickModeOnChest(false, true, 'Solo')).toBe(false);
  });
});

describe('planner character list', () => {
  const roster = [
    { name: 'A', weeklyGold: false },
    { name: 'B', weeklyGold: true },
    { name: 'C', weeklyGold: false },
    { name: 'D', weeklyGold: true }
  ];

  it('lists gold earners first and other characters after, each in roster order, by index', () => {
    expect(groupPlannerCharacters(roster)).toEqual({ goldEarners: [1, 3], others: [0, 2] });
  });

  it('sums every character into the roster total and counts gold earners', () => {
    const totals = [
      { unboundGold: 0, boundGold: -300 },
      { unboundGold: 1000, boundGold: 500 },
      { unboundGold: 200, boundGold: 0 },
      { unboundGold: 2000, boundGold: 100 }
    ];
    expect(getRosterSummary(totals, roster)).toEqual({ unboundGold: 3200, boundGold: 300, goldEarners: 2 });
  });

  it('takes bound below zero out of tradable in the roster total', () => {
    const totals = [{ unboundGold: 1000, boundGold: -1500 }, { unboundGold: 500, boundGold: 200 }];
    expect(getRosterSummary(totals, [{ weeklyGold: true }, { weeklyGold: true }])).toEqual({ unboundGold: 200, boundGold: 0, goldEarners: 2 });
  });
});
