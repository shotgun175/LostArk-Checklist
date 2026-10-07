import { goldTasks } from './gold-tasks';
import { Gate, getGoldCapWarning, getGoldRaids, GoldGateState, isGoldTakingDisabled, MAX_GOLD_RAIDS, pickDefaultRunningMode, shouldAutoPickRunningMode } from './gold-task';
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

  it('warns only when more than 3 raids take gold', () => {
    expect(getGoldCapWarning(3)).toBeUndefined();
    expect(getGoldCapWarning(4)).toBe('Gold from 4 raids, max is 3');
  });
});
