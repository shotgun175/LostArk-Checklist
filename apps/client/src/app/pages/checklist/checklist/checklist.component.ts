import { AfterViewInit, Component, ElementRef, HostListener, ChangeDetectionStrategy, NgZone, OnDestroy } from '@angular/core';
import { BehaviorSubject, combineLatest, map, Observable, pluck, startWith } from 'rxjs';
import { LostarkTask } from '../../../model/lostark-task';
import { TaskFrequency } from '../../../model/task-frequency';
import { TaskScope } from '../../../model/task-scope';
import { Completion } from '../../../model/completion';
import { Energy } from '../../../model/energy';
import { completionEntryFieldWrites, getCompletionEntry, getCompletionEntryKey, setCompletionEntry } from '../../../core/get-completion-entry-key';
import { RosterService } from '../../../core/database/services/roster.service';
import { SettingsService } from '../../../core/database/services/settings.service';
import { EnergyService } from '../../../core/database/services/energy.service';
import { TimeService } from '../../../core/time.service';
import { CompletionService } from '../../../core/database/services/completion.service';
import { TasksService } from '../../../core/database/services/tasks.service';
import { isTaskAvailable, isTaskDone } from '../../../core/is-task-done';
import { isTaskTracked } from '../../../core/task-tracking';
import { Roster } from '../../../model/roster';
import { LocalStorageBehaviorSubject } from '../../../core/local-storage-behavior-subject';
import { Character } from '../../../model/character/character';
import { tickets } from '../../../data/tickets';
import { addWeeks, getWeek } from 'date-fns';
import { goldTasks } from "../../gold-planner/gold-tasks";
import { Gate, getHigherModeForGate } from "../../gold-planner/gold-task";
import { filterVisibleCharacters } from '../../../core/visible-characters';
import { LayoutStateService } from '../../../core/services/layout-state.service';
import { checklistBodyHeight, checklistTaskColumnWidth, computeChecklistScroll, formatCountdown, formatModeBadge, getGoldBadge, goldBadgeTooltip, isWeeklyFrequency } from './checklist-layout';
import { capGoldTracking } from "../../gold-planner/gold-cap";
import { readCharacterFlag } from "../../../core/character-keys";

interface CategoriesDisplay {
  dailyCharacter: boolean,
  weeklyCharacter: boolean,
  biWeeklyCharacter: boolean,
  oneTimeCharacter: boolean,
  dailyRoster: boolean,
  weeklyRoster: boolean,
  biWeeklyRoster: boolean,
  oneTimeRoster: boolean,
}

const CATEGORIES_DISPLAY_DEFAULT: CategoriesDisplay = {
  dailyCharacter: true,
  weeklyCharacter: true,
  biWeeklyCharacter: true,
  oneTimeCharacter: true,
  dailyRoster: true,
  weeklyRoster: true,
  biWeeklyRoster: true,
  oneTimeRoster: true
};

@Component({
  selector: 'lostark-helper-checklist',
  templateUrl: './checklist.component.html',
  styleUrls: ['./checklist.component.less'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false
})
export class ChecklistComponent implements AfterViewInit, OnDestroy {

  public TaskFrequency = TaskFrequency;
  public TaskScope = TaskScope;
  public isWeeklyFrequency = isWeeklyFrequency;
  public formatCountdown = formatCountdown;

  public rawRoster$ = this.rosterService.roster$;
  public showHiddenCharacters$ = this.layoutState.showHiddenCharacters$;

  public categoriesDisplay$ = new LocalStorageBehaviorSubject<CategoriesDisplay>('checklist:displayed', CATEGORIES_DISPLAY_DEFAULT);

  public roster$: Observable<Character[]> = this.rawRoster$.pipe(
    pluck('characters')
  );

  public tiersAvailability$ = this.roster$.pipe(
    map(characters => {
      return {
        t1: characters.some(c => c.ilvl < 802),
        t2: characters.some(c => c.ilvl >= 802 && c.ilvl < 1302),
        t3: characters.some(c => c.ilvl >= 1302)
      };
    })
  );

  public tickets$ = this.tiersAvailability$.pipe(
    map(tiersAvailability => tickets.filter(t => !t.tier || tiersAvailability[`t${t.tier}`]))
  );

  public ticketsTrackingOpened = localStorage.getItem('checklist:tickets-opened') === 'true';

  public completion$: Observable<Completion> = this.completionService.completion$;

  public energy$ = this.energyService.energy$;

  public lastDailyReset$ = this.timeService.lastDailyReset$;
  public lastWeeklyReset$ = this.timeService.lastWeeklyReset$;
  public lastBiWeeklyReset$ = this.timeService.lastBiWeeklyReset$;
  public lastBiWeeklyOffsetReset$ = this.timeService.lastBiWeeklyOffsetReset$;

  public nextDailyReset$ = this.lastDailyReset$.pipe(
    map(reset => reset + 86400000)
  );

  public nextWeeklyReset$ = this.lastWeeklyReset$.pipe(
    map(reset => reset + 86400000 * 7)
  );

  public nextBiWeeklyReset$ = this.lastBiWeeklyReset$.pipe(
    map(reset => {
      const date = new Date(reset);
      // If we're on an odd week, it means that reset is in two weeks, else it's next week
      return addWeeks(reset, getWeek(date) % 2 === 1 ? 2 : 1).getTime();
    })
  );

  public nextBiWeeklyOffsetReset$ = this.lastBiWeeklyOffsetReset$.pipe(
    map(reset => {
      const date = new Date(reset);
      // If we're on an odd week, it means that reset is in one week, else it's in two
      return addWeeks(reset, getWeek(date) % 2 === 0 ? 2 : 1).getTime();
    })
  );

  // Each bi-weekly countdown only shows while an enabled task resets on it
  public resetFrequenciesInUse$ = this.tasksService.tasks$.pipe(
    map(tasks => {
      const enabled = tasks.filter(task => task.enabled);
      return {
        biWeekly: enabled.some(task => task.frequency === TaskFrequency.BIWEEKLY),
        biWeeklyOffset: enabled.some(task => task.frequency === TaskFrequency.BIWEEKLY_OFFSET)
      };
    })
  );

  public tasks$: Observable<LostarkTask[]> = combineLatest([
    this.rawRoster$,
    this.tasksService.tasks$,
    this.showHiddenCharacters$
  ]).pipe(
    map(([roster, tasks, showHidden]) => {
      // Rows follow the characters the table shows, so a hidden character does not keep blank rows.
      const visibleCharacters = filterVisibleCharacters(roster.characters, showHidden);
      return tasks.filter(task => {
        return task.enabled &&
          (!task.maxIlvl || visibleCharacters.some(c => c.ilvl < (task.maxIlvl || Infinity) && c.ilvl >= (task.minIlvl || 0) && isTaskTracked(roster.trackedTasks, c, task, tasks)));
      });
    })
  );

  public tableDisplay$ = combineLatest([
    this.rawRoster$,
    this.tasks$,
    this.completion$,
    this.lastDailyReset$,
    this.lastWeeklyReset$,
    this.lastBiWeeklyReset$,
    this.lastBiWeeklyOffsetReset$,
    this.settings.settings$.pipe(
      map(settings => ({
        lazytracking: settings.lazytracking,
        hiddenOnCompletion: settings.hiddenOnCompletion
      }))
    ),
    this.energy$,
    this.showHiddenCharacters$,
    this.settings.settings$.pipe(pluck("goldPlannerConfiguration")),
    this.settings.settings$.pipe(pluck("raidModesForGoldPlanner")),
    this.tasksService.tasks$
  ]).pipe(
    map(([roster, tasks, completion, dailyReset, weeklyReset, biWeeklyReset, biWeeklyOffsetReset, settings, energy, showHidden, savedGoldTracking, raidModesForGoldPlanner, allTasks]) => {
      // Same 3 gold raid cap as the Gold Planner, so no coin shows on a raid the planner unticks
      const goldTracking = capGoldTracking(roster.characters, savedGoldTracking, raidModesForGoldPlanner, allTasks, roster.trackedTasks).tracking;
      const data = tasks
        .map(task => {
          const lazyTracking = settings.lazytracking;
          const available = isTaskAvailable(task);
          const editDisabled = !task.canEditDaysFilter;
          const visible = available || editDisabled; // We always display tasks that can't be edited with "Not available today" flag
          const forceDone = (!available && visible); // If task is not available but is visible, we marked it as done
          const completionData = filterVisibleCharacters(roster.characters, showHidden)
            .map(character => {
              let runningMode = this.getRunningModeFlagForTask(raidModesForGoldPlanner, character, task.label);
              runningMode = runningMode === 'Nightmare' ? 'NiM' : runningMode;
              const modeBadge = formatModeBadge(runningMode);
              const goldBadge = getGoldBadge(modeBadge, this.getGoldTakingInfoForTask(character, task.label, goldTracking), character.weeklyGold);
              return {
                runningMode,
                modeBadge,
                higherModeInfo: this.getHigherModeInfoForTask(raidModesForGoldPlanner, character, task.label),
                done: Math.min(isTaskDone(
                  task,
                  character,
                  completion,
                  dailyReset,
                  weeklyReset,
                  biWeeklyReset,
                  biWeeklyOffsetReset,
                  lazyTracking
                ), task.amount),
                tracked: isTaskTracked(roster.trackedTasks, character, task, allTasks),
                doable: character.ilvl >= (task.minIlvl || 0) && character.ilvl < (task.maxIlvl || Infinity),
                energy: getCompletionEntry(energy.data, character, task) || 0,
                goldBadge,
                goldBadgeTooltip: goldBadgeTooltip(modeBadge, goldBadge.coin)
              };
            });

          const allDone = forceDone || completionData.every(
            ({ doable, done, tracked }) => !tracked || !doable || done >= task.amount
          );

          return {
            task,
            hasEnergy: ['Una', 'Guardian', 'Chaos'].some(n => task.label?.startsWith(n)),
            chaosDungeon: task.label === 'Chaos Dungeon',
            completion: completionData.map(row => row.done),
            energy: completionData.map(row => row.energy),
            completionData,
            allDone,
            visible,
            available
          };
        })
        .filter(({ visible, allDone }) => {
          if (allDone && settings.hiddenOnCompletion) return false; // If task is done and we hide done tasks, we don't display it
          return visible || roster.showAllTasks;
        })
        .reduce((acc, row) => {
          const frequencyKey = {
            [TaskFrequency.DAILY]: 'daily',
            [TaskFrequency.WEEKLY]: 'weekly',
            [TaskFrequency.BIWEEKLY]: 'biWeekly',
            [TaskFrequency.BIWEEKLY_OFFSET]: 'biWeekly',
            [TaskFrequency.ONE_TIME]: 'oneTime'
          }[row.task.frequency];
          const scopeKey = row.task.scope === TaskScope.CHARACTER ? 'Character' : 'Roster';
          const data = [
            ...acc[`${frequencyKey}${scopeKey}`].data,
            row
          ];
          return {
            ...acc,
            [`${frequencyKey}${scopeKey}`]: {
              data,
              done: data.every(t => t.allDone)
            }
          };
        }, {
          dailyCharacter: { data: [], done: false },
          weeklyCharacter: { data: [], done: false },
          biWeeklyCharacter: { data: [], done: false },
          oneTimeCharacter: { data: [], done: false },
          dailyRoster: { data: [], done: false },
          weeklyRoster: { data: [], done: false },
          biWeeklyRoster: { data: [], done: false },
          oneTimeRoster: { data: [], done: false }
        });

      return {
        roster: filterVisibleCharacters(roster.characters, showHidden)
          .map((c, i) => {
            const done = [...data.dailyCharacter.data, ...data.weeklyCharacter.data].every(
              (row: { completionData: { doable: boolean, done: number, tracked: boolean }[], task: LostarkTask }) => {
                const completion = row.completionData[i];
                return !completion.tracked || !completion.doable || !row.task.enabled || completion.done >= row.task.amount;
              });
            return {
              ...c,
              done
            };
          }),
        dailyReset,
        weeklyReset,
        biWeeklyReset,
        biWeeklyOffsetReset,
        data
      };
    })
  );

  private windowResize$ = new BehaviorSubject<void>(void 0);

  // Measured table body: the height that fits the window and the visible width (null until rendered)
  public tableBox$ = new BehaviorSubject<{ height: number | null, width: number | null }>({ height: null, width: null });

  public characters$ = combineLatest([this.roster$, this.showHiddenCharacters$]).pipe(
    map(([roster, showHidden]) => filterVisibleCharacters(roster, showHidden))
  );

  public charactersDisplay$ = combineLatest([this.tableDisplay$, this.showHiddenCharacters$]).pipe(
    map(([display, showHidden]) => filterVisibleCharacters(display.roster, showHidden))
  );

  public taskColumnWidth$ = combineLatest([this.characters$, this.layoutState.sidebarCollapsed$, this.layoutState.sidebarWidth$, this.windowResize$]).pipe(
    map(([characters, sidebarCollapsed, sidebarWidth]) => checklistTaskColumnWidth({
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      visibleCharacterCount: characters.length,
      sidebarCollapsed,
      sidebarWidth
    }))
  );

  public scrolling$ = combineLatest([this.characters$, this.layoutState.sidebarCollapsed$, this.layoutState.sidebarWidth$, this.windowResize$, this.tableBox$]).pipe(
    map(([characters, sidebarCollapsed, sidebarWidth, , tableBox]) => computeChecklistScroll({
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      visibleCharacterCount: characters.length,
      sidebarCollapsed,
      sidebarWidth,
      bodyHeight: tableBox.height
    })),
    startWith({ x: null, y: null })
  );

  private resizeObserver?: ResizeObserver;
  private mutationObserver?: MutationObserver;
  private measurePending = false;

  constructor(private rosterService: RosterService, private tasksService: TasksService,
    private settings: SettingsService, private energyService: EnergyService,
    private timeService: TimeService, private completionService: CompletionService,
    private layoutState: LayoutStateService, private host: ElementRef<HTMLElement>,
    private zone: NgZone) {
    // A choice saved before a section existed has no value for it, so that section starts visible
    this.categoriesDisplay$.next({ ...CATEGORIES_DISPLAY_DEFAULT, ...this.categoriesDisplay$.value });
    this.setTableHeight();
  }

  @HostListener('window:resize')
  setTableHeight(): void {
    this.windowResize$.next();
    // A height-only resize does not resize this page, so the observers below would miss it
    this.scheduleMeasure();
  }

  ngAfterViewInit(): void {
    // The table body is sized from where it really starts, so it is measured again whenever
    // something above it changes height: the page header, the Tickets panel, the table itself
    // (host resize) or the guest banner, which sits next to this page (the parent's children change).
    const host = this.host.nativeElement;
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.scheduleMeasure());
      this.resizeObserver.observe(host);
    }
    if (host.parentElement && typeof MutationObserver !== 'undefined') {
      this.mutationObserver = new MutationObserver(() => this.scheduleMeasure());
      this.mutationObserver.observe(host.parentElement, { childList: true });
    }
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.mutationObserver?.disconnect();
  }

  private scheduleMeasure(): void {
    if (this.measurePending) {
      return;
    }
    this.measurePending = true;
    // Next frame, so the new height is not applied inside the observer callback
    requestAnimationFrame(() => {
      this.measurePending = false;
      this.measureTable();
    });
  }

  private measureTable(): void {
    const host = this.host.nativeElement;
    const body = host.querySelector<HTMLElement>('.checklist-table .ant-table-body');
    const pageContent = host.parentElement;
    const scroller = pageContent?.parentElement;
    if (!body || !pageContent || !scroller) {
      return;
    }
    const bodyRect = body.getBoundingClientRect();
    // Under the body: the rest of this page (the table border), the page's bottom padding and the footer
    let belowBody = host.getBoundingClientRect().bottom - bodyRect.bottom + parseFloat(getComputedStyle(pageContent).paddingBottom || '0');
    for (let element = pageContent.nextElementSibling; element; element = element.nextElementSibling) {
      belowBody += element.getBoundingClientRect().height;
    }
    const height = checklistBodyHeight({
      viewportHeight: scroller.clientHeight,
      bodyTop: bodyRect.top - scroller.getBoundingClientRect().top + scroller.scrollTop,
      belowBody
    });
    const width = body.clientWidth;
    const current = this.tableBox$.value;
    if (current.height !== height || current.width !== width) {
      this.zone.run(() => this.tableBox$.next({ height, width }));
    }
  }

  public ticketsTrackingOpenedChange(opened: boolean): void {
    localStorage.setItem('checklist:tickets-opened', opened.toString());
    this.ticketsTrackingOpened = opened;
  }

  public markAsDone(completion: Completion, energy: Energy, character: Character, task: LostarkTask, roster: Character[], done: boolean, dailyReset: number, weeklyReset: number, biWeeklyReset: number, biWeeklyOffsetReset: number, clickEvent?: MouseEvent, shownAmount?: number): void {
    let reset = Infinity;
    switch (task.frequency) {
      case TaskFrequency.DAILY:
        reset = dailyReset;
        break;
      case TaskFrequency.WEEKLY:
        reset = weeklyReset;
        break;
      case TaskFrequency.BIWEEKLY:
        reset = biWeeklyReset;
        break;
      case TaskFrequency.BIWEEKLY_OFFSET:
        reset = biWeeklyOffsetReset;
        break;
    }
    if (done) {
      const setAllDone = clickEvent?.ctrlKey;
      // The counter shows a finished task as done (lazy tracking keeps yesterday's runs on screen),
      // so a click on it must not reset and count it again
      if ((shownAmount ?? 0) >= task.amount) {
        return;
      }
      const existingEntry = getCompletionEntry(completion.data, character, task);
      if (existingEntry?.updated < reset && reset !== Infinity) {
        existingEntry.amount = 0;
      }
      const currentAmount = existingEntry?.amount || 0;
      // A finished counter stays focusable (aria-disabled), so a click on it must not count past the amount
      if (currentAmount >= task.amount) {
        return;
      }
      // Ctrl+click fills only the runs left, so rest bonus is spent for those runs only
      const runs = setAllDone ? Math.max(task.amount - currentAmount, 0) : 1;

      setCompletionEntry(completion.data, character, task, {
        ...(existingEntry || {}),
        amount: setAllDone ? task.amount : currentAmount + 1,
        updated: Date.now()
      });

      if (task.scope === TaskScope.CHARACTER
        && task.frequency === TaskFrequency.DAILY
        && ['Chaos', 'Guardian', 'Una'].some(n => task.label?.startsWith(n))) {
        const energyEntry = getCompletionEntry(energy.data, character, task) || { amount: 0 };
        if (task.label === 'Chaos Dungeon') {
          if (energyEntry.amount >= 40) {
            energyEntry.amount = energyEntry.amount - 40; // Since Chaos Dungeon rework, max Chaos Dungeon per day is 1 and it consumes 40 energy if you have energy
            this.energyService.patchFields(energy.$key, [{ path: ["data", getCompletionEntryKey(character, task)], value: energyEntry }]);
          }
        } else {
          if (energyEntry.amount >= 20) {
            energyEntry.amount = Math.max(energyEntry.amount - (20 * runs), 0);
            this.energyService.patchFields(energy.$key, [{ path: ["data", getCompletionEntryKey(character, task)], value: energyEntry }]);
          }
        }
      }
    } else {
      completion.data[getCompletionEntryKey(character, task)] = {
        amount: 0,
        updated: Date.now()
      };
    }
    this.completionService.patchFields(completion.$key, completionEntryFieldWrites("data", completion.data, character, task));
  }

  trackByEntry(index: number, entry: { task: LostarkTask, completion: number[] }): string | undefined {
    return entry.task.$key;
  }

  trackByCharacter(index: number, character: Character): number | string {
    // Names can repeat and ids cannot; a character saved before ids existed falls back to its name
    return character.id ?? character.name;
  }

  showHiddenCharacters(): void {
    this.showHiddenCharacters$.next(true);
  }

  saveRoster(roster: Roster): void {
    this.rosterService.setOne(roster.$key, roster);
  }

  private getGoldTakingInfoForTask(character: Character, taskName: string, goldTracking): boolean | undefined {
    let goldTaskName
    let gate
    const goldTask = goldTasks.find(goldTask => goldTask.taskName === taskName)
    if (goldTask === undefined) {
      const specificGates = goldTasks.reduce(
        (acc: Gate[], goldTask) => {
          const specificGates = goldTask.gates.filter(gate => gate.taskName !== undefined)
          return [...acc, ...specificGates]
        },
        []
      )
      gate = specificGates.find(gate => gate.taskName && gate.taskName === taskName)
      goldTaskName = gate && gate.name
    } else {
      goldTaskName = goldTask.gates[0].name
    }
    return goldTaskName === undefined ? false : readCharacterFlag(goldTracking, character, `gold:taking:${goldTaskName}`)
  }

  private getRunningModeFlagForTask(raidModesForGoldPlanner: Record<string, string>, character: Character, taskName: string): string | undefined {
    const gates = this.getGoldGatesForTask(taskName)
    return gates.length ? this.settings.getRunningModeFlag(raidModesForGoldPlanner, character, gates.map(gate => gate.name)) : undefined
  }

  private getHigherModeInfoForTask(raidModesForGoldPlanner: Record<string, string>, character: Character, taskName: string): string | undefined {
    const gates = this.getGoldGatesForTask(taskName)
    if (!gates.length) return undefined

    const higherModes = gates.map(gate => getHigherModeForGate(
      gate,
      this.settings.getRunningModeFlag(raidModesForGoldPlanner, character, [gate.name]),
      character
    ))
    if (higherModes.some(mode => !mode)) return undefined

    const availableModes = [...new Set(higherModes)]
    if (availableModes.length === 0) return undefined
    const modeName = availableModes[0] === 'HM' ? 'Hard Mode' : 'Nightmare Mode'
    return `Can run ${modeName}`
  }

  private getGoldGatesForTask(taskName: string): Gate[] {
    const goldTask = goldTasks.find(goldTask => goldTask.taskName === taskName)
    if (goldTask) return goldTask.gates

    const gate = goldTasks.flatMap(goldTask => goldTask.gates).find(gate => gate.taskName === taskName)
    return gate ? [gate] : []
  }
}



