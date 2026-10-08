import { ElementRef, NgZone } from '@angular/core';
import { NEVER, Observable, firstValueFrom, of } from 'rxjs';
import { ChecklistComponent } from './checklist.component';
import { tasks } from '../../../core/tasks';
import { Completion } from '../../../model/completion';
import { Energy } from '../../../model/energy';
import { Character } from '../../../model/character/character';
import { LostarkTask } from '../../../model/lostark-task';
import { TaskFrequency } from '../../../model/task-frequency';
import { RosterService } from '../../../core/database/services/roster.service';
import { TasksService } from '../../../core/database/services/tasks.service';
import { SettingsService } from '../../../core/database/services/settings.service';
import { EnergyService } from '../../../core/database/services/energy.service';
import { TimeService } from '../../../core/time.service';
import { CompletionService } from '../../../core/database/services/completion.service';
import { LayoutStateService } from '../../../core/services/layout-state.service';

// No real Firebase in unit tests.
jest.mock('firebase/app', () => ({}));
jest.mock('firebase/auth', () => ({}));
jest.mock('firebase/firestore', () => ({}));

describe('ChecklistComponent', () => {
  const day = 86400000;
  const now = Date.now();
  const dailyReset = now - 3600000;
  const weeklyReset = now - 2 * day;
  const biWeeklyReset = now - 3 * day;
  const biWeeklyOffsetReset = now - 10 * day;
  const unaTask: LostarkTask = { ...tasks.find(task => task.label === "Una's Task"), $key: 'una' };
  const arwen = { id: 1, name: 'Arwen', ilvl: 1700 } as Character;

  let energyService: { patchFields: jest.Mock };
  let completionService: { patchFields: jest.Mock };

  function createComponent(tasks$: Observable<LostarkTask[]> = NEVER): ChecklistComponent {
    energyService = { patchFields: jest.fn() };
    completionService = { patchFields: jest.fn() };
    return new ChecklistComponent(
      { roster$: NEVER } as unknown as RosterService,
      { tasks$ } as unknown as TasksService,
      { settings$: NEVER } as unknown as SettingsService,
      energyService as unknown as EnergyService,
      {
        lastDailyReset$: NEVER,
        lastWeeklyReset$: NEVER,
        lastBiWeeklyReset$: NEVER,
        lastBiWeeklyOffsetReset$: NEVER
      } as unknown as TimeService,
      completionService as unknown as CompletionService,
      { showHiddenCharacters$: of(false), sidebarCollapsed$: of(false) } as unknown as LayoutStateService,
      new ElementRef(document.createElement('div')),
      { run: (fn: () => void) => fn() } as unknown as NgZone
    );
  }

  beforeEach(() => {
    localStorage.clear();
  });

  describe('markAsDone', () => {
    it('Ctrl+click spends rest bonus only for the runs it fills', () => {
      const component = createComponent();
      const completion: Completion = { $key: 'uid', data: { '1:una': { amount: 1, updated: now - 60000 } } };
      const energy: Energy = { $key: 'uid', data: { '1:una': { amount: 100 } }, updated: dailyReset };

      component.markAsDone(completion, energy, arwen, unaTask, [arwen], true, dailyReset, weeklyReset, biWeeklyReset, biWeeklyOffsetReset,
        { ctrlKey: true } as MouseEvent);

      // 2 runs left at 1/3: 100 - 2 x 20
      expect(energy.data['1:una']).toEqual({ amount: 60 });
      expect(completion.data['1:una'].amount).toBe(3);
      expect(energyService.patchFields).toHaveBeenCalledTimes(1);
      expect(completionService.patchFields).toHaveBeenCalledTimes(1);
    });

    it('Ctrl+click on an entry from before the reset spends rest bonus for every run', () => {
      const component = createComponent();
      const completion: Completion = { $key: 'uid', data: { '1:una': { amount: 2, updated: dailyReset - 60000 } } };
      const energy: Energy = { $key: 'uid', data: { '1:una': { amount: 100 } }, updated: dailyReset };

      component.markAsDone(completion, energy, arwen, unaTask, [arwen], true, dailyReset, weeklyReset, biWeeklyReset, biWeeklyOffsetReset,
        { ctrlKey: true } as MouseEvent);

      // Yesterday's 2/3 is stale, so all 3 runs are filled: 100 - 3 x 20
      expect(energy.data['1:una']).toEqual({ amount: 40 });
      expect(completion.data['1:una'].amount).toBe(3);
    });

    it('resets a Thaemine G4 entry from the last cycle before counting the click', () => {
      const component = createComponent();
      const thaemineG4: LostarkTask = { ...tasks.find(task => task.label === 'Thaemine G4'), $key: 'thaemine-g4' };
      const completion: Completion = { $key: 'uid', data: { '1:thaemine-g4': { amount: 1, updated: biWeeklyOffsetReset - day } } };
      const energy: Energy = { $key: 'uid', data: {}, updated: dailyReset };

      component.markAsDone(completion, energy, arwen, thaemineG4, [arwen], true, dailyReset, weeklyReset, biWeeklyReset, biWeeklyOffsetReset);

      expect(completion.data['1:thaemine-g4'].amount).toBe(1);
    });

    it('a plain click spends rest bonus for one run', () => {
      const component = createComponent();
      const completion: Completion = { $key: 'uid', data: {} };
      const energy: Energy = { $key: 'uid', data: { '1:una': { amount: 100 } }, updated: dailyReset };

      component.markAsDone(completion, energy, arwen, unaTask, [arwen], true, dailyReset, weeklyReset, biWeeklyReset, biWeeklyOffsetReset);

      expect(energy.data['1:una']).toEqual({ amount: 80 });
      expect(completion.data['1:una'].amount).toBe(1);
    });

    it('does nothing on a finished counter, which stays clickable for keyboard focus', () => {
      const component = createComponent();
      const completion: Completion = { $key: 'uid', data: { '1:una': { amount: 3, updated: now - 60000 } } };
      const energy: Energy = { $key: 'uid', data: { '1:una': { amount: 100 } }, updated: dailyReset };

      component.markAsDone(completion, energy, arwen, unaTask, [arwen], true, dailyReset, weeklyReset, biWeeklyReset, biWeeklyOffsetReset);
      component.markAsDone(completion, energy, arwen, unaTask, [arwen], true, dailyReset, weeklyReset, biWeeklyReset, biWeeklyOffsetReset,
        { ctrlKey: true } as MouseEvent);

      expect(completion.data['1:una'].amount).toBe(3);
      expect(energy.data['1:una']).toEqual({ amount: 100 });
      expect(completionService.patchFields).not.toHaveBeenCalled();
      expect(energyService.patchFields).not.toHaveBeenCalled();
    });

    it('does nothing on a counter shown as finished from yesterday (lazy tracking)', () => {
      const component = createComponent();
      const completion: Completion = { $key: 'uid', data: { '1:una': { amount: 3, updated: dailyReset - 3600000 } } };
      const energy: Energy = { $key: 'uid', data: { '1:una': { amount: 100 } }, updated: dailyReset };

      component.markAsDone(completion, energy, arwen, unaTask, [arwen], true, dailyReset, weeklyReset, biWeeklyReset, biWeeklyOffsetReset,
        {} as MouseEvent, 3);
      component.markAsDone(completion, energy, arwen, unaTask, [arwen], true, dailyReset, weeklyReset, biWeeklyReset, biWeeklyOffsetReset,
        { ctrlKey: true } as MouseEvent, 3);

      expect(completion.data['1:una'].amount).toBe(3);
      expect(energy.data['1:una']).toEqual({ amount: 100 });
      expect(completionService.patchFields).not.toHaveBeenCalled();
      expect(energyService.patchFields).not.toHaveBeenCalled();
    });

    it('still resets a finished counter', () => {
      const component = createComponent();
      const completion: Completion = { $key: 'uid', data: { '1:una': { amount: 3, updated: now - 60000 } } };
      const energy: Energy = { $key: 'uid', data: {}, updated: dailyReset };

      component.markAsDone(completion, energy, arwen, unaTask, [arwen], false, dailyReset, weeklyReset, biWeeklyReset, biWeeklyOffsetReset);

      expect(completion.data['1:una'].amount).toBe(0);
      expect(completionService.patchFields).toHaveBeenCalledTimes(1);
    });
  });

  describe('resetFrequenciesInUse$', () => {
    const task = (frequency: TaskFrequency, enabled = true) => ({ ...unaTask, frequency, enabled });

    it('shows a bi-weekly countdown only while an enabled task uses that reset', async () => {
      const component = createComponent(of([task(TaskFrequency.DAILY), task(TaskFrequency.BIWEEKLY_OFFSET)]));

      expect(await firstValueFrom(component.resetFrequenciesInUse$)).toEqual({ biWeekly: false, biWeeklyOffset: true });
    });

    it('ignores disabled tasks', async () => {
      const component = createComponent(of([task(TaskFrequency.BIWEEKLY, false), task(TaskFrequency.BIWEEKLY_OFFSET, false)]));

      expect(await firstValueFrom(component.resetFrequenciesInUse$)).toEqual({ biWeekly: false, biWeeklyOffset: false });
    });
  });

  describe('trackByCharacter', () => {
    it('tracks by id, so two characters with the same name stay apart', () => {
      const component = createComponent();

      expect(component.trackByCharacter(0, { ...arwen, id: 1 })).toBe(1);
      expect(component.trackByCharacter(1, { ...arwen, id: 2 })).toBe(2);
    });

    it('falls back to the name for a character without an id', () => {
      const component = createComponent();

      expect(component.trackByCharacter(0, { ...arwen, id: undefined })).toBe('Arwen');
    });
  });

  describe('categoriesDisplay$', () => {
    it('shows both One Time sections by default', () => {
      const component = createComponent();

      expect(component.categoriesDisplay$.value).toEqual(expect.objectContaining({ oneTimeCharacter: true, oneTimeRoster: true }));
    });

    it('fills in the One Time sections for a choice saved before they existed', () => {
      localStorage.setItem('checklist:displayed', JSON.stringify({
        dailyCharacter: false, weeklyCharacter: true, biWeeklyCharacter: true,
        dailyRoster: true, weeklyRoster: true, biWeeklyRoster: true
      }));

      const component = createComponent();

      expect(component.categoriesDisplay$.value).toEqual({
        dailyCharacter: false, weeklyCharacter: true, biWeeklyCharacter: true,
        dailyRoster: true, weeklyRoster: true, biWeeklyRoster: true,
        oneTimeCharacter: true, oneTimeRoster: true
      });
    });

    it('keeps a saved choice to hide a One Time section', () => {
      localStorage.setItem('checklist:displayed', JSON.stringify({ oneTimeCharacter: false }));

      const component = createComponent();

      expect(component.categoriesDisplay$.value.oneTimeCharacter).toBe(false);
      expect(component.categoriesDisplay$.value.oneTimeRoster).toBe(true);
    });
  });
});
