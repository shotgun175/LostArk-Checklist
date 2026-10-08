import { UntypedFormControl, UntypedFormGroup } from '@angular/forms';
import { createTask, LostarkTask } from '../../model/lostark-task';
import { TaskFrequency } from '../../model/task-frequency';
import { TaskScope } from '../../model/task-scope';
import { customTasksExport, ilvlRangeValidator, nextTaskIndex, parseTasksImport } from './task-input';

const task = (label: string, index: number, extra: Partial<LostarkTask> = {}): LostarkTask =>
  ({ ...createTask(label, 1600, TaskFrequency.WEEKLY, TaskScope.CHARACTER, 1, 9999, undefined, { custom: true }), index, $key: `k-${label}`, authorId: 'me', ...extra });

describe('nextTaskIndex', () => {
  it('puts a new task after the last one', () => {
    expect(nextTaskIndex([task('A', 0), task('B', 52), task('C', 7)])).toBe(53);
  });

  it('starts at 0 on an empty list', () => {
    expect(nextTaskIndex([])).toBe(0);
  });
});

describe('customTasksExport', () => {
  it('exports custom tasks only, without $key, authorId or index', () => {
    const exported = customTasksExport([task('Mine', 3), task('Built in', 4, { custom: false })]);
    expect(exported).toHaveLength(1);
    expect(exported[0]).not.toHaveProperty('$key');
    expect(exported[0]).not.toHaveProperty('authorId');
    expect(exported[0]).not.toHaveProperty('index');
    expect(exported[0].label).toBe('Mine');
  });
});

describe('parseTasksImport', () => {
  const existing = [task('Guild Chores', 0), task('Bifrost Run', 9)];

  it('re-importing your own export adds 0 and reports the skipped duplicates', () => {
    const text = JSON.stringify(customTasksExport(existing));
    const result = parseTasksImport(text, existing, 'me');
    expect(result.ok).toBe(true);
    expect(result.tasks).toEqual([]);
    expect(result.skipped).toBe(2);
  });

  it('rejects an object instead of a list with a plain sentence', () => {
    const result = parseTasksImport('{}', existing, 'me');
    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(['That does not look like exported custom tasks.']);
    expect(parseTasksImport('nope', existing, 'me').errors).toEqual(['That does not look like exported custom tasks.']);
  });

  it('rejects junk entries without importing any task', () => {
    const result = parseTasksImport(JSON.stringify([
      { label: 'Fine', frequency: TaskFrequency.DAILY, scope: TaskScope.ROSTER, minIlvl: 0 },
      'junk',
      { label: ' ', frequency: TaskFrequency.DAILY, scope: TaskScope.CHARACTER, minIlvl: 0 },
      { label: 'Odd', frequency: 42, scope: TaskScope.CHARACTER, minIlvl: 0 },
      { label: 'Odd scope', frequency: TaskFrequency.DAILY, scope: 'x', minIlvl: 0 },
      { label: 'No ilvl', frequency: TaskFrequency.DAILY, scope: TaskScope.CHARACTER, minIlvl: 'high' }
    ]), existing, 'me');
    expect(result.ok).toBe(false);
    expect(result.tasks).toEqual([]);
    expect(result.errors.map(e => e.slice(0, 6))).toEqual(['Task 2', 'Task 3', 'Task 4', 'Task 5', 'Task 6']);
  });

  it('reports an empty list', () => {
    expect(parseTasksImport('[]', existing, 'me').errors).toEqual(['No tasks found.']);
  });

  it('builds new custom tasks after the last index, owned by the importer', () => {
    const result = parseTasksImport(JSON.stringify([
      { label: 'Island Run', frequency: TaskFrequency.DAILY, scope: TaskScope.ROSTER, minIlvl: 1500, maxIlvl: 1700, amount: 2, iconPath: 'island.webp', daysFilter: [0, 6], $key: 'theirs', authorId: 'them', index: 0 },
      { label: 'island run', frequency: TaskFrequency.DAILY, scope: TaskScope.ROSTER, minIlvl: 1500 },
      { label: 'Cube', frequency: TaskFrequency.WEEKLY, scope: TaskScope.CHARACTER, minIlvl: '1600' }
    ]), existing, 'me');
    expect(result.ok).toBe(true);
    expect(result.skipped).toBe(1);
    expect(result.tasks.map(t => [t.label, t.index, t.authorId, t.custom, t.minIlvl, t.maxIlvl, t.amount])).toEqual([
      ['Island Run', 10, 'me', true, 1500, 1700, 2],
      ['Cube', 11, 'me', true, 1600, 9999, 1]
    ]);
    expect(result.tasks[0].daysFilter).toEqual([0, 6]);
    expect(result.tasks[0].iconPath).toBe('island.webp');
    expect(result.tasks[0]).not.toHaveProperty('$key');
  });
});

describe('ilvlRangeValidator', () => {
  const group = (min: unknown, max: unknown) => new UntypedFormGroup({ minIlvl: new UntypedFormControl(min), maxIlvl: new UntypedFormControl(max) }, { validators: ilvlRangeValidator });

  it('flags a minimum above the maximum', () => {
    expect(group(1700, 1600).errors).toEqual({ ilvlRange: true });
  });

  it('accepts an equal or lower minimum, and blanks (left to the required check)', () => {
    expect(group(1600, 1600).errors).toBeNull();
    expect(group(1500, 1600).errors).toBeNull();
    expect(group(null, 1600).errors).toBeNull();
  });
});
