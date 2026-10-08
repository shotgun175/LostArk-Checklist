import { of, ReplaySubject, Subscription } from 'rxjs';
import { GoldPlannerComponent } from './gold-planner.component';
import { goldTasks } from '../gold-tasks';
import { capGoldTracking } from '../gold-cap';
import { tasks as defaultTasks } from '../../../core/tasks';
import { LostarkTask } from '../../../model/lostark-task';
import { Character } from '../../../model/character/character';
import { SettingsService } from '../../../core/database/services/settings.service';
import { applyFieldWrites, FieldWrite } from '../../../core/database/write-coalescer';

// No real Firebase in unit tests (same as energy.service.spec.ts): the services are stubbed below
jest.mock('firebase/app', () => ({}));
jest.mock('firebase/auth', () => ({}));
jest.mock('firebase/firestore', () => ({}));

const tasks: LostarkTask[] = defaultTasks.map(task => ({ ...task, $key: task.label }));
const character = { id: 1, name: 'Arwen', ilvl: 1800, weeklyGold: true } as Character;

// Every gold raid ticked for Taking Gold and switched on in Task tracking, so the character is well over the cap
const allRaidsTicked: Record<string, boolean> = Object.fromEntries(
  goldTasks.flatMap(gTask => gTask.gates.map(gate => [`${character.name}:gold:taking:${gate.name}`, true]))
);
const allRaidsTracked: Record<string, boolean> = Object.fromEntries(
  goldTasks.flatMap(gTask => [gTask.taskName, ...gTask.gates.map(gate => gate.taskName)])
    .filter((label): label is string => !!label)
    .map(label => [`${character.id}:${label}`, true])
);

describe('GoldPlannerComponent gold cap', () => {
  let settings$: ReplaySubject<Record<string, unknown>>;
  let patchFields: jest.Mock;
  let info: jest.Mock;
  let subscription: Subscription;

  const emitSettings = (goldPlannerConfiguration: Record<string, boolean>) => settings$.next({
    $key: 'settings-key',
    goldPlannerConfiguration,
    raidModesForGoldPlanner: {},
    manualGoldEntries: {}
  });

  beforeEach(() => {
    settings$ = new ReplaySubject<Record<string, unknown>>(1);
    patchFields = jest.fn();
    info = jest.fn();
    const roster$ = of({ $key: 'roster-key', characters: [character], trackedTasks: allRaidsTracked });
    const component = new GoldPlannerComponent(
      { roster$ } as never,
      { tasks$: of(tasks) } as never,
      { settings$, patchFields, getRunningModeFlag: SettingsService.prototype.getRunningModeFlag } as never,
      { lastWeeklyReset$: of(0), lastBiWeeklyReset$: of(0), lastBiWeeklyOffsetReset$: of(0) } as never,
      { completion$: of({ $key: 'completion-key', data: {} }) } as never,
      { showHiddenCharacters$: of(false) } as never,
      { info } as never
    );
    subscription = component.display$.subscribe();
  });

  afterEach(() => subscription.unsubscribe());

  // The settings as stored after the gold cap's field writes
  const savedConfiguration = (): Record<string, boolean> =>
    applyFieldWrites({ goldPlannerConfiguration: { ...allRaidsTicked } }, patchFields.mock.calls[0][1]).goldPlannerConfiguration;

  it('saves the untick in one write and shows one message, even when the same over-cap data emits again', () => {
    emitSettings(allRaidsTicked);
    emitSettings(allRaidsTicked);

    expect(patchFields).toHaveBeenCalledTimes(1);
    expect(info).toHaveBeenCalledTimes(1);
    expect(info.mock.calls[0][0]).toMatch(/^Arwen can take gold from 3 raids a week\. Kept .+; unticked .+\.$/);
    // Stays long enough to read
    expect(info.mock.calls[0][1]).toEqual({ nzDuration: 10000 });
    expect(patchFields.mock.calls[0][0]).toBe('settings-key');
    // Only unticked Taking Gold flags are written, each as its own field
    const writes: FieldWrite[] = patchFields.mock.calls[0][1];
    expect(writes.length).toBeGreaterThan(0);
    writes.forEach(write => expect(write).toEqual({ path: ['goldPlannerConfiguration', expect.stringMatching(/^Arwen:gold:taking:/)], value: false }));
    const saved = savedConfiguration();
    // Raids the character cannot enter stay ticked but never count, so check the saved data is within the cap
    expect(capGoldTracking([character], saved, {}, tasks, allRaidsTracked).unticked).toEqual([]);
    expect(Object.values(saved).filter(Boolean).length).toBeLessThan(Object.keys(allRaidsTicked).length);
  });

  it('does not write once the capped settings come back', () => {
    emitSettings(allRaidsTicked);
    emitSettings(savedConfiguration());

    expect(patchFields).toHaveBeenCalledTimes(1);
    expect(info).toHaveBeenCalledTimes(1);
  });

  it('writes nothing and shows no message for a character under the cap', () => {
    const lastTwo = goldTasks.slice(-2).flatMap(gTask => gTask.gates.map(gate => [`${character.name}:gold:taking:${gate.name}`, true]));
    emitSettings(Object.fromEntries(lastTwo));

    expect(patchFields).not.toHaveBeenCalled();
    expect(info).not.toHaveBeenCalled();
  });
});

describe('GoldPlannerComponent gold this week', () => {
  // Kazeros on Hard: gate 1 pays 16,000 tradable (chest 5,120), gate 2 pays 32,000 tradable (chest 10,240), no bound gold
  const kazerosHard: Record<string, boolean> = {
    'Arwen:gold:taking:Kazeros Gate 1': true,
    'Arwen:gold:taking:Kazeros Gate 2': true,
    'Arwen:gold:Kazeros Gate 1': true,
    'Arwen:gold:Kazeros Gate 2': true
  };

  // The display for Kazeros Hard with gate 1 ticked done on the Checklist this week (weekly reset at 0)
  const displayFor = (hideAlreadyDoneTasks: boolean, planned: Character = character) => {
    let display: unknown;
    const component = new GoldPlannerComponent(
      { roster$: of({ $key: 'roster-key', characters: [planned], trackedTasks: allRaidsTracked }) } as never,
      { tasks$: of(tasks) } as never,
      {
        settings$: of({
          $key: 'settings-key',
          goldPlannerConfiguration: { ...kazerosHard, hideAlreadyDoneTasks },
          raidModesForGoldPlanner: { 'Arwen:runningMode:Kazeros Gate 1': 'HM', 'Arwen:runningMode:Kazeros Gate 2': 'HM' },
          manualGoldEntries: {}
        }),
        patchFields: jest.fn(),
        getRunningModeFlag: SettingsService.prototype.getRunningModeFlag
      } as never,
      { lastWeeklyReset$: of(0), lastBiWeeklyReset$: of(0), lastBiWeeklyOffsetReset$: of(0) } as never,
      { completion$: of({ $key: 'completion-key', data: { '1:Kazeros': { amount: 1, updated: 10 } } }) } as never,
      { showHiddenCharacters$: of(false) } as never,
      { info: jest.fn() } as never
    );
    component.display$.subscribe(value => display = value).unsubscribe();
    return display as {
      characterSummaries: { possible: number, earnedGross: number, net: number, percent: number, earned: { tradable: number, bound: number, chests: number } }[],
      rosterSummary: { net: number, possible: number },
      total: { unboundGold: number, boundGold: number }[],
      chestCosts: number[],
      chestsData: { line: { name: string }, goldDetails: { completion?: string, runningMode: string, modeNotes: string[], unboundGoldReward: number }[] }[]
    };
  };

  it('pays chests from tradable when the character has no bound gold, so bound never goes negative', () => {
    const display = displayFor(false);
    expect(display.total[0]).toEqual({ unboundGold: 32640, boundGold: 0 });
    expect(display.chestCosts[0]).toBe(15360);
  });

  it('counts earned gold from the gates done on the Checklist, out of every planned gate', () => {
    const summary = displayFor(false).characterSummaries[0];
    expect(summary.possible).toBe(48000);
    expect(summary.earnedGross).toBe(16000);
    expect(summary.earned).toEqual(expect.objectContaining({ tradable: 10880, bound: 0, chests: 5120 }));
    expect(summary.net).toBe(10880);
    expect(summary.percent).toBe(33);
  });

  it('keeps the earned and possible numbers on Remaining for the week, while the totals show only what is left', () => {
    const display = displayFor(true);
    expect(display.characterSummaries[0]).toEqual(displayFor(false).characterSummaries[0]);
    expect(display.rosterSummary).toEqual(expect.objectContaining({ net: 10880, possible: 48000 }));
    expect(display.total[0]).toEqual({ unboundGold: 21760, boundGold: 0 });
    expect(display.chestCosts[0]).toBe(10240);
  });

  it('counts a saved Hard the item level cannot run as Normal, shows Normal selected and says why, without saving anything', () => {
    // The same Kazeros Hard plan on a 1712 character: Normal pays 5,500 + 10,500 tradable and the same again bound
    const display = displayFor(false, { ...character, ilvl: 1712 } as Character);
    const kazeros = display.chestsData.find(row => row.line.name === 'Kazeros');
    expect(kazeros?.goldDetails[0]).toEqual(expect.objectContaining({ runningMode: 'NM', modeNotes: ['Hard needs 1730, counted as Normal'], unboundGoldReward: 16000 }));
    expect(display.characterSummaries[0].possible).toBe(32000);
  });

  it('labels the raid and each gate with their Checklist completion', () => {
    const labels = Object.fromEntries(displayFor(false).chestsData
      .filter(row => row.line.name.startsWith('Kazeros'))
      .map(row => [row.line.name, row.goldDetails[0].completion]));
    expect(labels).toEqual({ 'Kazeros': '1 of 2 done', 'Kazeros Gate 1': 'done', 'Kazeros Gate 2': 'to do' });
  });
});
