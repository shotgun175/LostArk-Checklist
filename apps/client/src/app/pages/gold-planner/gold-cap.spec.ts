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

// Stored keys start with the character id (Char1 has id 1)
const keyOf = (name: string): string => name.replace(/^Char/, '');
const ticked = (name: string, labels: string[]): Record<string, boolean> => Object.fromEntries(
  labels.flatMap(label => [1, 2].map(gate => [`${keyOf(name)}:gold:taking:${label} Gate ${gate}`, true]))
);
const modes = (name: string, labels: string[], mode = 'NM'): Record<string, string> => Object.fromEntries(
  labels.flatMap(label => [1, 2].map(gate => [`${keyOf(name)}:runningMode:${label} Gate ${gate}`, mode]))
);
const takingRaids = (tracking: Record<string, boolean>, name: string): string[] => [...new Set(Object.keys(tracking)
  .filter(key => key.startsWith(`${keyOf(name)}:gold:taking:`) && tracking[key])
  .map(key => key.slice(`${keyOf(name)}:gold:taking:`.length).replace(/ Gate \d$/, '')))].sort();

// A 1780 character tracks Horizon Cathedral, Serca and Kazeros by default; Armoche and Mordum need an explicit true
const allTracked = { '1:Armoche': true, '1:Mordum': true };
const five = ['Horizon Cathedral', 'Serca', 'Kazeros', 'Armoche', 'Mordum'];

describe('capGoldTracking', () => {
  const gTasks = [raid('Horizon Cathedral', 100), raid('Serca', 500), raid('Kazeros', 400), raid('Armoche', 300), raid('Mordum', 200)];

  it('keeps the 3 raids paying the most gold and unticks every gate of the others', () => {
    const tracking = ticked('Char1', five);
    const result = capGoldTracking([character(1780)], tracking, modes('Char1', five), tasks, allTracked, gTasks);
    expect(takingRaids(result.tracking, 'Char1')).toEqual(['Armoche', 'Kazeros', 'Serca']);
    expect(result.tracking['1:gold:taking:Mordum Gate 2']).toBe(false);
    expect(result.unticked).toEqual([{ characterName: 'Char1', raids: ['Mordum', 'Horizon Cathedral'], kept: ['Serca', 'Kazeros', 'Armoche'] }]);
    expect(tracking['1:gold:taking:Mordum Gate 1']).toBe(true);
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
    expect(result.unticked).toEqual([{ characterName: 'Char1', raids: ['Serca'], kept: ['Kazeros', 'Armoche', 'Horizon Cathedral'] }]);
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

  it('ranks a saved Hard the item level cannot run by the Normal amounts it counts as', () => {
    // Hard pays far more, but needs 1730 on every raid; at 1712 Armoche counts as Normal and pays the least
    const withHard = (label: string, gold: number): GoldTask => ({
      ...raid(label, gold),
      gates: raid(label, gold).gates.map(gate => ({
        ...gate,
        modes: [{ ...gate.modes[0], HMThreashold: 1730 }, { ...gate.modes[0], name: 'HM', unboundGoldReward: 100000 }]
      }))
    });
    const four = ['Horizon Cathedral', 'Serca', 'Kazeros', 'Armoche'];
    const hardRaids = [withHard('Horizon Cathedral', 300), withHard('Serca', 400), withHard('Kazeros', 500), withHard('Armoche', 100)];
    const raidModes = { ...modes('Char1', ['Horizon Cathedral', 'Serca', 'Kazeros']), ...modes('Char1', ['Armoche'], 'HM') };
    const result = capGoldTracking([character(1712)], ticked('Char1', four), raidModes, tasks, { '1:Armoche': true }, hardRaids);
    expect(result.unticked).toEqual([{ characterName: 'Char1', raids: ['Armoche'], kept: ['Kazeros', 'Serca', 'Horizon Cathedral'] }]);
    // The saved mode is not rewritten
    expect(raidModes['1:runningMode:Armoche Gate 1']).toBe('HM');
  });

  it('Brakka at 1712 with Hard saved on four raids keeps the three paying the most on Normal (real gold data)', () => {
    const four = ['Horizon Cathedral', 'Serca', 'Kazeros', 'Armoche'];
    const brakka = { id: 2, name: 'Brakka', ilvl: 1712, weeklyGold: true } as Character;
    const result = capGoldTracking([brakka], ticked('Brakka', four), modes('Brakka', four, 'HM'), tasks, { '2:Armoche': true });
    expect(result.unticked).toEqual([{ characterName: 'Brakka', raids: ['Armoche'], kept: ['Serca', 'Kazeros', 'Horizon Cathedral'] }]);
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
    expect(formatGoldCapMessage([{ characterName: 'Brakka', raids: ['Armoche'], kept: ['Kazeros', 'Serca', 'Horizon Cathedral'] }]))
      .toBe('Brakka can take gold from 3 raids a week. Kept Kazeros, Serca, Horizon Cathedral; unticked Armoche.');
    expect(formatGoldCapMessage([{ characterName: 'A', raids: ['X', 'Y'], kept: ['K'] }, { characterName: 'B', raids: ['Z'], kept: ['L'] }]))
      .toBe('A can take gold from 3 raids a week. Kept K; unticked X, Y. B can take gold from 3 raids a week. Kept L; unticked Z.');
  });
});

describe('capGoldTracking with keys saved under the character name', () => {
  const gTasks = [raid('Horizon Cathedral', 100), raid('Serca', 500), raid('Kazeros', 400), raid('Armoche', 300), raid('Mordum', 200)];
  const byName = (labels: string[]): Record<string, boolean> => Object.fromEntries(
    labels.flatMap(label => [1, 2].map(gate => [`Char1:gold:taking:${label} Gate ${gate}`, true]))
  );

  it('still counts them, and unticks under the id key, which wins over the name key', () => {
    const modesByName = Object.fromEntries(five.flatMap(label => [1, 2].map(gate => [`Char1:runningMode:${label} Gate ${gate}`, 'NM'])));
    const result = capGoldTracking([character(1780)], byName(five), modesByName, tasks, allTracked, gTasks);
    expect(result.unticked).toEqual([{ characterName: 'Char1', raids: ['Mordum', 'Horizon Cathedral'], kept: ['Serca', 'Kazeros', 'Armoche'] }]);
    expect(result.tracking['1:gold:taking:Mordum Gate 1']).toBe(false);
    expect(capGoldTracking([character(1780)], result.tracking, modesByName, tasks, allTracked, gTasks).unticked).toEqual([]);
  });
});
