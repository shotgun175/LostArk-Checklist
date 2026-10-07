import { raidReleaseOrder, tasks as defaultTasks } from './tasks';
import {
  getDefaultTrackedRaidLabels,
  getExplicitTrackingKeys,
  countGridTrackingChoices,
  getExplicitTrackingKeysForCharacter,
  getSetForAllKeys,
  getTrackedTaskOverride,
  isRaidInMainList,
  isRaidTask,
  isTaskInIlvlRange,
  isTaskTracked
} from './task-tracking';
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

describe('getExplicitTrackingKeys', () => {
  it('lists every key that holds an explicit choice', () => {
    expect(getExplicitTrackingKeys({ '1:a': true, '2:b': false, 'Old:c': true })).toEqual(['1:a', '2:b', 'Old:c']);
  });

  it('skips undefined and non-boolean entries', () => {
    const odd = { '1:a': undefined, '1:b': { pending: true } as unknown as boolean, '1:c': false };
    expect(getExplicitTrackingKeys(odd)).toEqual(['1:c']);
  });

  it('copes with a missing map', () => {
    expect(getExplicitTrackingKeys(undefined)).toEqual([]);
  });
});

describe('getExplicitTrackingKeysForCharacter', () => {
  const trackedTasks = {
    '42:Serca': false,
    '42:Armoche': true,
    'Char42:Mordum': true,
    '7:Serca': true,
    '421:Serca': true,
    'Char7:Serca': false,
    '42:Kazeros': undefined
  };

  it('lists only the id keys of a character with an id, since the grid never reads its legacy name keys', () => {
    expect(getExplicitTrackingKeysForCharacter(trackedTasks, character(1700, 42)))
      .toEqual(['42:Serca', '42:Armoche']);
  });

  it('matches name keys for a character without an id', () => {
    const noId = { name: 'Char7', ilvl: 1700 } as Character;
    expect(getExplicitTrackingKeysForCharacter(trackedTasks, noId)).toEqual(['Char7:Serca']);
  });

  it('returns nothing for a character without choices or a missing map', () => {
    expect(getExplicitTrackingKeysForCharacter(trackedTasks, character(1700, 99))).toEqual([]);
    expect(getExplicitTrackingKeysForCharacter(undefined, character(1700, 42))).toEqual([]);
  });
});

describe('countGridTrackingChoices', () => {
  const gridTasks = [task('Serca'), task('Armoche')];
  const trackedTasks = {
    '42:Serca': false,
    '42:Armoche': true,
    '42:Gone': true,
    'Char42:Serca': true,
    'Char7:Serca': false,
    'Char7:Gone': true,
    '42:Mordum': undefined
  };

  it('counts only choices for tasks the grid shows, so keys of deleted or moved tasks are left out', () => {
    expect(countGridTrackingChoices(trackedTasks, character(1700, 42), gridTasks)).toBe(2);
  });

  it('ignores legacy name keys of a character with an id', () => {
    expect(countGridTrackingChoices({ 'Char42:Serca': true }, character(1700, 42), gridTasks)).toBe(0);
  });

  it('counts name keys for a character without an id', () => {
    const noId = { name: 'Char7', ilvl: 1700 } as Character;
    expect(countGridTrackingChoices(trackedTasks, noId, gridTasks)).toBe(1);
  });

  it('returns 0 for a missing map', () => {
    expect(countGridTrackingChoices(undefined, character(1700, 42), gridTasks)).toBe(0);
  });
});

describe('isTaskInIlvlRange', () => {
  const raid = { ...task('Serca'), minIlvl: 1710, maxIlvl: 1730 };

  it('is true from the min item level up to just below the max', () => {
    expect(isTaskInIlvlRange(character(1710), raid)).toBe(true);
    expect(isTaskInIlvlRange(character(1729), raid)).toBe(true);
  });

  it('is false below the min or at the max item level', () => {
    expect(isTaskInIlvlRange(character(1709), raid)).toBe(false);
    expect(isTaskInIlvlRange(character(1730), raid)).toBe(false);
  });

  it('treats a missing min or max as no limit', () => {
    const open = { ...raid, minIlvl: undefined as unknown as number, maxIlvl: undefined };
    expect(isTaskInIlvlRange(character(1), open)).toBe(true);
  });
});

describe('isRaidTask', () => {
  it('is true for tasks listed in raidReleaseOrder', () => {
    expect(isRaidTask(task('Serca'))).toBe(true);
    expect(isRaidTask(task('Brelshaza Gate 3'))).toBe(true);
  });

  it('is false for other tasks and for custom tasks that reuse a raid name', () => {
    expect(isRaidTask(task('Chaos Dungeon'))).toBe(false);
    expect(isRaidTask({ ...task('Serca'), custom: true })).toBe(false);
  });
});

describe('isRaidInMainList', () => {
  // 1780 tracks Horizon Cathedral, Serca and Kazeros by default; 1705 tracks Armoche, Horizon Cathedral and Mordum
  const grid = [character(1780, 1), character(1705, 2)];

  it('keeps a raid that is among the default newest 3 of at least one character', () => {
    expect(isRaidInMainList({}, grid, task('Serca'), tasks)).toBe(true);
    expect(isRaidInMainList({}, grid, task('Mordum'), tasks)).toBe(true);
  });

  it('moves a raid that is not the default of any character to Older raids', () => {
    expect(isRaidInMainList({}, grid, task('Aegir'), tasks)).toBe(false);
  });

  it('keeps an older raid in the main list when any character has an explicit true for it', () => {
    expect(isRaidInMainList({ '2:Aegir': true }, grid, task('Aegir'), tasks)).toBe(true);
  });

  it('still moves an older raid to Older raids when its only choices are explicit false', () => {
    expect(isRaidInMainList({ '1:Aegir': false, '2:Aegir': false }, grid, task('Aegir'), tasks)).toBe(false);
  });

  it('ignores choices the grid does not read (legacy name keys, characters not in the grid)', () => {
    expect(isRaidInMainList({ 'Char2:Aegir': true, '99:Aegir': true }, grid, task('Aegir'), tasks)).toBe(false);
  });

  it('follows item levels: the same raid moves back once a character tracks it by default', () => {
    expect(isRaidInMainList({}, [...grid, character(1665, 3)], task('Aegir'), tasks)).toBe(true);
  });

  it('sends every raid to Older raids when the grid has no characters', () => {
    expect(isRaidInMainList({}, [], task('Serca'), tasks)).toBe(false);
  });
});

describe('getSetForAllKeys', () => {
  it('lists the tracking key of every grid character whose item level fits the raid', () => {
    const noId = { name: 'Zed', ilvl: 1720 } as Character;
    expect(getSetForAllKeys([character(1780, 1), character(1705, 2), noId, character(1710, 4)], task('Serca')))
      .toEqual(['1:Serca', 'Zed:Serca', '4:Serca']);
  });

  it('is empty when nobody can enter the raid', () => {
    expect(getSetForAllKeys([character(1600, 1)], task('Serca'))).toEqual([]);
  });
});
