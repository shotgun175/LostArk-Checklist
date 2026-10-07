import { capGoldTracking, formatGoldCapMessage } from './gold-cap';
import { GoldTask } from './gold-task';
import { tasks as defaultTasks } from '../../core/tasks';
import { LostarkTask } from '../../model/lostark-task';
import { Character } from '../../model/character/character';

const tasks: LostarkTask[] = defaultTasks.map(task => ({ ...task, $key: task.label }));
const character = (ilvl: number, weeklyGold = true, id = 1): Character => ({ id, name: `Char${id}`, ilvl, weeklyGold } as Character);

// One two-gate raid per label; each gate pays `gold` in NM (half unbound, half bound) and nothing above goldILvlLimit
function raid(label: string, gold: number, goldILvlLimit = Infinity): GoldTask {
  return {
    name: label,
    taskName: label,
    gates: [1, 2].map(gate => ({
      name: `${label} Gate ${gate}`,
      completionId: `X.G${gate}`,
      modes: [{ name: 'NM', unboundGoldReward: gold / 2, boundGoldReward: gold / 2, chestPrice: 0, goldILvlLimit }]
    }))
  };
}

const ticked = (name: string, labels: string[]): Record<string, boolean> => Object.fromEntries(
  labels.flatMap(label => [1, 2].map(gate => [`${name}:gold:taking:${label} Gate ${gate}`, true]))
);
const modes = (name: string, labels: string[], mode = 'NM'): Record<string, string> => Object.fromEntries(
  labels.flatMap(label => [1, 2].map(gate => [`${name}:runningMode:${label} Gate ${gate}`, mode]))
);
const takingRaids = (tracking: Record<string, boolean>, name: string): string[] => [...new Set(Object.keys(tracking)
  .filter(key => key.startsWith(`${name}:gold:taking:`) && tracking[key])
  .map(key => key.slice(`${name}:gold:taking:`.length).replace(/ Gate \d$/, '')))].sort();

// A 1780 character tracks Horizon Cathedral, Serca and Kazeros by default; Armoche and Mordum need an explicit true
const allTracked = { '1:Armoche': true, '1:Mordum': true };
const five = ['Horizon Cathedral', 'Serca', 'Kazeros', 'Armoche', 'Mordum'];

describe('capGoldTracking', () => {
  const gTasks = [raid('Horizon Cathedral', 100), raid('Serca', 500), raid('Kazeros', 400), raid('Armoche', 300), raid('Mordum', 200)];

  it('keeps the 3 raids paying the most gold and unticks every gate of the others', () => {
    const tracking = ticked('Char1', five);
    const result = capGoldTracking([character(1780)], tracking, modes('Char1', five), tasks, allTracked, gTasks);
    expect(takingRaids(result.tracking, 'Char1')).toEqual(['Armoche', 'Kazeros', 'Serca']);
    expect(result.tracking['Char1:gold:taking:Mordum Gate 2']).toBe(false);
    expect(result.unticked).toEqual([{ characterName: 'Char1', raids: ['Mordum', 'Horizon Cathedral'] }]);
    expect(tracking['Char1:gold:taking:Mordum Gate 1']).toBe(true);
  });

  it('breaks gold ties in favour of the newer raid', () => {
    const tied = five.map(label => raid(label, 100));
    const result = capGoldTracking([character(1780)], ticked('Char1', five), modes('Char1', five), tasks, allTracked, tied);
    expect(takingRaids(result.tracking, 'Char1')).toEqual(['Horizon Cathedral', 'Kazeros', 'Serca']);
  });

  it('drops raids that pay nothing for the selected modes first', () => {
    const noGoldAtThisIlvl = [raid('Horizon Cathedral', 100), raid('Serca', 500, 1700), raid('Kazeros', 400), raid('Armoche', 300)];
    const four = ['Horizon Cathedral', 'Serca', 'Kazeros', 'Armoche'];
    const result = capGoldTracking([character(1780)], ticked('Char1', four), modes('Char1', four), tasks, allTracked, noGoldAtThisIlvl);
    expect(result.unticked).toEqual([{ characterName: 'Char1', raids: ['Serca'] }]);
  });

  it('counts gold of the selected mode, and a raid without a mode as paying nothing', () => {
    const twoModes = five.map(label => ({
      ...raid(label, 100),
      gates: raid(label, 100).gates.map(gate => ({ ...gate, modes: [...gate.modes, { ...gate.modes[0], name: 'HM', unboundGoldReward: 1000 }] }))
    }));
    const raidModes = { ...modes('Char1', ['Horizon Cathedral', 'Serca', 'Kazeros']), ...modes('Char1', ['Mordum'], 'HM') };
    const result = capGoldTracking([character(1780)], ticked('Char1', five), raidModes, tasks, allTracked, twoModes);
    expect(takingRaids(result.tracking, 'Char1')).toEqual(['Horizon Cathedral', 'Mordum', 'Serca']);
  });

  it('changes nothing at 3 raids or fewer and returns the same tracking object', () => {
    const tracking = ticked('Char1', ['Serca', 'Kazeros', 'Armoche']);
    const result = capGoldTracking([character(1780)], tracking, modes('Char1', five), tasks, allTracked, gTasks);
    expect(result.tracking).toBe(tracking);
    expect(result.unticked).toEqual([]);
  });

  it('is idempotent: capping the capped tracking changes nothing', () => {
    const first = capGoldTracking([character(1780)], ticked('Char1', five), modes('Char1', five), tasks, allTracked, gTasks);
    const second = capGoldTracking([character(1780)], first.tracking, modes('Char1', five), tasks, allTracked, gTasks);
    expect(second.tracking).toBe(first.tracking);
    expect(second.unticked).toEqual([]);
  });

  it('does not count raids the character does not track or cannot enter', () => {
    // Without explicit choices Armoche and Mordum are not tracked at 1780, so only 3 raids count
    const result = capGoldTracking([character(1780)], ticked('Char1', five), modes('Char1', five), tasks, {}, gTasks);
    expect(result.unticked).toEqual([]);
    const disabled = tasks.map(t => t.label === 'Mordum' ? { ...t, enabled: false } : t);
    expect(capGoldTracking([character(1780)], ticked('Char1', ['Serca', 'Kazeros', 'Armoche', 'Mordum']), modes('Char1', five), disabled, allTracked, gTasks).unticked).toEqual([]);
  });

  it('leaves characters without Weekly Gold alone', () => {
    const tracking = ticked('Char1', five);
    expect(capGoldTracking([character(1780, false)], tracking, modes('Char1', five), tasks, allTracked, gTasks).tracking).toBe(tracking);
  });

  it('caps nothing before the task list is known', () => {
    const tracking = ticked('Char1', five);
    expect(capGoldTracking([character(1780)], tracking, modes('Char1', five), [], allTracked, gTasks).tracking).toBe(tracking);
  });

  it('caps each character on its own', () => {
    const two = [character(1780, true, 1), character(1780, true, 2)];
    const tracking = { ...ticked('Char1', five), ...ticked('Char2', ['Serca', 'Kazeros']) };
    const result = capGoldTracking(two, tracking, { ...modes('Char1', five), ...modes('Char2', five) }, tasks, { ...allTracked, '2:Armoche': true }, gTasks);
    expect(result.unticked.map(u => u.characterName)).toEqual(['Char1']);
    expect(takingRaids(result.tracking, 'Char2')).toEqual(['Kazeros', 'Serca']);
  });

  it('works on the real gold data: at most 3 raids stay', () => {
    const result = capGoldTracking([character(1780)], ticked('Char1', five), modes('Char1', five), tasks, allTracked);
    expect(takingRaids(result.tracking, 'Char1')).toHaveLength(3);
    expect(result.unticked[0].raids).toHaveLength(2);
  });
});

describe('formatGoldCapMessage', () => {
  it('names the character and the unticked raids', () => {
    expect(formatGoldCapMessage([{ characterName: 'Valtist', raids: ['Echidna'] }])).toBe('Valtist: gold limit is 3 raids, unticked Echidna');
    expect(formatGoldCapMessage([{ characterName: 'A', raids: ['X', 'Y'] }, { characterName: 'B', raids: ['Z'] }]))
      .toBe('A: gold limit is 3 raids, unticked X, Y. B: gold limit is 3 raids, unticked Z');
  });
});
