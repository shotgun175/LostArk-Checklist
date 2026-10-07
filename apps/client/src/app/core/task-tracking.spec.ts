import { raidReleaseOrder, tasks as defaultTasks } from './tasks';
import { getDefaultTrackedRaidLabels, getTrackedTaskOverride, isTaskTracked } from './task-tracking';
import { LostarkTask } from '../model/lostark-task';
import { Character } from '../model/character/character';

const tasks: LostarkTask[] = defaultTasks.map(task => ({ ...task, $key: task.label }));
const task = (label: string): LostarkTask => tasks.find(t => t.label === label) as LostarkTask;
const character = (ilvl: number, id = 1): Character => ({ id, name: `Char${id}`, ilvl } as Character);
const raidIcons = ['legion_raid.png', 'abyssal-raid.webp', 'kazeros-raid.webp', 'abyssal-dungeon.webp'];

describe('raidReleaseOrder', () => {
  it('only lists labels that exist in the task list', () => {
    const labels = new Set(defaultTasks.map(t => t.label));
    expect(raidReleaseOrder.flat().filter(label => !labels.has(label))).toEqual([]);
  });

  it('lists every raid and abyssal dungeon task exactly once', () => {
    const raidTasks = defaultTasks.filter(t => raidIcons.includes(t.iconPath || '')).map(t => t.label).sort();
    expect([...raidReleaseOrder.flat()].sort()).toEqual(raidTasks);
  });
});

describe('getDefaultTrackedRaidLabels', () => {
  const tracked = (ilvl: number) => [...getDefaultTrackedRaidLabels(character(ilvl), tasks)].sort();

  it('picks Horizon Cathedral, Serca and Kazeros at 1780', () => {
    expect(tracked(1780)).toEqual(['horizon cathedral', 'kazeros', 'serca']);
  });

  it('skips raids the character cannot enter yet (1705)', () => {
    expect(tracked(1705)).toEqual(['armoche', 'horizon cathedral', 'mordum']);
  });

  it('picks Aegir, Behemoth and Echidna at 1665', () => {
    expect(tracked(1665)).toEqual(['aegir', 'behemoth', 'echidna']);
  });

  it('keeps every task label of a multi-task raid together (1620)', () => {
    expect(tracked(1620)).toEqual(['behemoth', 'echidna', 'thaemine', 'thaemine g4']);
  });

  it('counts Brelshaza Gate 1-2, 3 and 4 as one raid (1500)', () => {
    expect(tracked(1500)).toEqual(['brelshaza gate 1-2', 'brelshaza gate 3', 'brelshaza gate 4', 'kakul-saydon', 'vykas']);
  });

  it('respects the max item level of old content (1400)', () => {
    expect(tracked(1400)).toEqual(["aira's oculus", 'argos', 'oreha preveza']);
  });

  it('ignores disabled raid tasks', () => {
    const withoutSerca = tasks.map(t => t.label === 'Serca' ? { ...t, enabled: false } : t);
    expect([...getDefaultTrackedRaidLabels(character(1780), withoutSerca)].sort()).toEqual(['armoche', 'horizon cathedral', 'kazeros']);
  });

  it('ignores custom tasks that reuse a raid label', () => {
    const custom = { ...task('Valtan'), custom: true, minIlvl: 1, $key: 'custom-valtan' };
    expect([...getDefaultTrackedRaidLabels(character(1780), [...tasks.filter(t => t.label !== 'Valtan'), custom])].sort())
      .toEqual(['horizon cathedral', 'kazeros', 'serca']);
  });
});

describe('isTaskTracked', () => {
  const c = character(1780, 42);

  it('tracks the 3 newest raids and untracks older raids by default', () => {
    expect(isTaskTracked({}, c, task('Horizon Cathedral'), tasks)).toBe(true);
    expect(isTaskTracked({}, c, task('Serca'), tasks)).toBe(true);
    expect(isTaskTracked({}, c, task('Kazeros'), tasks)).toBe(true);
    expect(isTaskTracked({}, c, task('Armoche'), tasks)).toBe(false);
    expect(isTaskTracked({}, c, task('Mordum'), tasks)).toBe(false);
    expect(isTaskTracked({}, c, task('Thaemine G4'), tasks)).toBe(false);
  });

  it('keeps non-raid tasks tracked by default', () => {
    expect(isTaskTracked({}, c, task('Chaos Dungeon'), tasks)).toBe(true);
    expect(isTaskTracked({}, c, task('Paradise'), tasks)).toBe(true);
    expect(isTaskTracked({}, c, { ...task('Valtan'), custom: true, $key: 'custom' }, tasks)).toBe(true);
  });

  it('lets an explicit false win over a default-tracked raid', () => {
    expect(isTaskTracked({ '42:Serca': false }, c, task('Serca'), tasks)).toBe(false);
  });

  it('lets an explicit true win over a default-untracked raid', () => {
    expect(isTaskTracked({ '42:Armoche': true }, c, task('Armoche'), tasks)).toBe(true);
  });

  it('lets an explicit false win over a non-raid task', () => {
    expect(isTaskTracked({ '42:Chaos Dungeon': false }, c, task('Chaos Dungeon'), tasks)).toBe(false);
  });

  it('only reads the override of this character', () => {
    expect(isTaskTracked({ '7:Armoche': true }, c, task('Armoche'), tasks)).toBe(false);
  });

  it('treats a non-boolean entry as no override', () => {
    const odd = { '42:Armoche': { pending: true } as unknown as boolean, '42:Serca': undefined };
    expect(getTrackedTaskOverride(odd, c, task('Armoche'))).toBeUndefined();
    expect(isTaskTracked(odd, c, task('Armoche'), tasks)).toBe(false);
    expect(isTaskTracked(odd, c, task('Serca'), tasks)).toBe(true);
  });

  it('copes with a missing trackedTasks map', () => {
    expect(isTaskTracked(undefined, c, task('Serca'), tasks)).toBe(true);
    expect(isTaskTracked(undefined, c, task('Armoche'), tasks)).toBe(false);
  });
});
