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
const character = { id: 1, name: 'Valtist', ilvl: 1800, weeklyGold: true } as Character;

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
    expect(info.mock.calls[0][0]).toMatch(/^Valtist: gold limit is 3 raids, unticked /);
    expect(patchFields.mock.calls[0][0]).toBe('settings-key');
    // Only unticked Taking Gold flags are written, each as its own field
    const writes: FieldWrite[] = patchFields.mock.calls[0][1];
    expect(writes.length).toBeGreaterThan(0);
    writes.forEach(write => expect(write).toEqual({ path: ['goldPlannerConfiguration', expect.stringMatching(/^Valtist:gold:taking:/)], value: false }));
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
