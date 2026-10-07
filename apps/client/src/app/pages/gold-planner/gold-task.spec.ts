import { goldTasks } from './gold-tasks';
import { Gate, pickDefaultRunningMode, shouldAutoPickRunningMode } from './gold-task';
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
