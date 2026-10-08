import { Component, ChangeDetectionStrategy } from "@angular/core";
import { combineLatest, map, Observable, pluck } from "rxjs";
import { TaskFrequency } from "../../../model/task-frequency";
import { TaskScope } from "../../../model/task-scope";
import { LostarkTask } from "../../../model/lostark-task";
import { Energy } from "../../../model/energy";
import { getCompletionEntry, getCompletionEntryKey } from "../../../core/get-completion-entry-key";
import { RosterService } from "../../../core/database/services/roster.service";
import { Settings } from "../../../model/settings";
import { SettingsService } from "../../../core/database/services/settings.service";
import { EnergyService } from "../../../core/database/services/energy.service";
import { TasksService } from "../../../core/database/services/tasks.service";
import { AuthService } from "../../../core/database/services/auth.service";
import { Roster } from "../../../model/roster";
import { Character } from "../../../model/character/character";
import { NzMessageService } from "ng-zorro-antd/message";
import { DataTransferService } from "../../../core/import/data-transfer.service";
import { ExportValidation, parseExportFile } from "../../../core/import/validate-export";
import { LostarkExport } from "../../../core/import/lostark-export";
import {
  countGridTrackingChoices,
  getExplicitTrackingKeys,
  getExplicitTrackingKeysForCharacter,
  getSetForAllKeys,
  getTrackedTaskOverride,
  groupTrackingGridTasks,
  isTaskInIlvlRange,
  isTaskTracked
} from "../../../core/task-tracking";
import { deleteField } from "firebase/firestore";

/** Task tracking grid column widths in px; the grid scrolls sideways when they do not fit. */
const TRACKING_TASK_COLUMN_WIDTH = 150;
const TRACKING_CHARACTER_COLUMN_WIDTH = 64;

/** localStorage key that remembers whether the Older raids group of the Task tracking grid is expanded. */
const OLDER_RAIDS_OPEN_KEY = "settings:olderRaidsOpen";

function readOlderRaidsOpen(): boolean {
  try {
    return localStorage.getItem(OLDER_RAIDS_OPEN_KEY) === "true";
  } catch {
    return false;
  }
}

@Component({
  selector: "lostark-helper-settings",
  templateUrl: "./settings.component.html",
  styleUrls: ["./settings.component.less"],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false
})
export class SettingsComponent {
  public uid$ = this.auth.uid$;

  public anonymous$ = this.auth.isAnonymous$;

  public settings$: Observable<Settings> = this.settings.settings$;

  public lazyTracking$ = this.settings$.pipe(pluck("lazytracking"));

  public energy$ = this.energyService.energy$;

  public roster$ = this.rosterService.roster$.pipe(
    map(roster => roster.characters.filter(c => c.lazy))
  );

  public fullRoster$ = this.rosterService.roster$.pipe(
    pluck("characters")
  );

  public rawRoster$ = this.rosterService.roster$;

  public lazyFlags$ = combineLatest([
    this.tasksService.tasks$,
    this.roster$,
    this.lazyTracking$
  ]).pipe(
    map(([tasks, roster, tracking]) => {
      return tasks
        .filter(task => task.frequency === TaskFrequency.DAILY && task.scope === TaskScope.CHARACTER)
        .map(task => {
          return {
            task,
            flags: roster
              .map(character => {
                const flag = tracking[`${character.name}:${task.$key}`];
                return flag === undefined ? true : flag;
              })
          };
        });
    })
  );

  public restBonus$ = combineLatest([
    this.tasksService.tasks$,
    this.rosterService.roster$,
    this.energy$
  ]).pipe(
    map(([tasks, roster, energy]) => {
      return tasks
        .filter(task => task.frequency === TaskFrequency.DAILY
          && task.scope === TaskScope.CHARACTER
          && !task.custom
          && ["Chaos", "Guardian", "Una"].some(n => task.label?.startsWith(n)))
        .map(task => {
          return {
            task,
            energy: roster.characters.map(c => getCompletionEntry(energy.data, c, task)?.amount || 0)
          };
        });
    })
  );

  public taskTracking$ = combineLatest([
    this.tasksService.tasks$,
    this.rosterService.roster$
  ]).pipe(
    map(([tasks, roster]) => {
      // Visible characters decide the grouping (user choice): raids only hidden alts would run fold into Older raids.
      const visibleCharacters = roster.characters.filter(c => !c.isHide);
      const groups = groupTrackingGridTasks(roster.trackedTasks, visibleCharacters, tasks);
      const toRow = (task: LostarkTask) => ({
        task,
        eligibleCount: getSetForAllKeys(roster.characters, task).length,
        data: roster.characters.map(c => ({
          tracked: isTaskTracked(roster.trackedTasks, c, task, tasks),
          auto: getTrackedTaskOverride(roster.trackedTasks, c, task) === undefined,
          inIlvlRange: isTaskInIlvlRange(c, task)
        }))
      });
      // Tasks switched off in Tasks Manager have no row but still count, since the resets clear their choices too
      const countedTasks = tasks.filter(task => task.scope === TaskScope.CHARACTER);
      const perCharacter = roster.characters.map(c => countGridTrackingChoices(roster.trackedTasks, c, countedTasks));
      const raidRows = groups.raids.map(toRow);
      const olderRows = groups.olderRaids.map(toRow);
      const otherRows = groups.others.map(toRow);
      return {
        rows: [...raidRows, ...olderRows, ...otherRows],
        raidRows,
        olderRows,
        otherRows,
        setByYou: perCharacter.reduce((sum, count) => sum + count, 0),
        perCharacter,
        taskColumnWidth: `${TRACKING_TASK_COLUMN_WIDTH}px`,
        characterColumnWidth: `${TRACKING_CHARACTER_COLUMN_WIDTH}px`,
        scroll: {
          x: `${TRACKING_TASK_COLUMN_WIDTH + TRACKING_CHARACTER_COLUMN_WIDTH * roster.characters.length}px`,
          y: "300px"
        }
      };
    })
  );

  public hasLazyCharacters$ = this.roster$.pipe(
    map(roster => roster.some(c => c.lazy))
  );

  public pendingImport: { fileName: string; validation: ExportValidation; fromLostarkHelper: boolean } | null = null;

  /** Which button opened the file picker: Import from Lostark-helper (true) or Restore backup (false). */
  public importFromLostarkHelper = false;

  public transferBusy = false;

  public olderRaidsOpen = readOlderRaidsOpen();

  constructor(private rosterService: RosterService, private tasksService: TasksService,
              private settings: SettingsService, private energyService: EnergyService,
              private auth: AuthService,
              private dataTransfer: DataTransferService, private message: NzMessageService) {
  }

  saveSettings(settings: Settings): void {
    this.settings.save(settings);
  }

  trackByTask(index: number, row: { task: LostarkTask }): string | undefined {
    return row.task.label;
  }

  setLazyFlag(settingsKey: string, tracking: Record<string, boolean>, task: LostarkTask, character: Character, flag: boolean): void {
    tracking[`${character.name}:${task.$key}`] = flag;
    this.settings.patch({
      $key: settingsKey,
      lazytracking: tracking
    });
  }

  setRestBonus(energy: Energy, task: LostarkTask, character: Character, value: number): void {
    this.energyService.updateOne(energy.$key, {
      [`data.${getCompletionEntryKey(character, task)}`]: { amount: Math.max(Math.min(task.label === 'Chaos Dungeon' ? 200 : 100, value), 0) }
    });
  }

  setTrackedTask(roster: Roster, task: LostarkTask, character: Character, value: boolean): void {
    this.rosterService.updateOne(roster.$key, {
      [`trackedTasks.${getCompletionEntryKey(character, task)}`]: value
    });
  }

  resetTrackedTask(roster: Roster, task: LostarkTask, character: Character): void {
    this.rosterService.updateOne(roster.$key, {
      [`trackedTasks.${getCompletionEntryKey(character, task)}`]: deleteField()
    });
  }

  resetAllTracking(roster: Roster): void {
    this.clearTrackingKeys(roster, getExplicitTrackingKeys(roster.trackedTasks));
  }

  resetCharacterTracking(roster: Roster, character: Character): void {
    this.clearTrackingKeys(roster, getExplicitTrackingKeysForCharacter(roster.trackedTasks, character));
  }

  /** Removes the given explicit tracking choices in one write, so those cells follow the default again. */
  private clearTrackingKeys(roster: Roster, keys: string[]): void {
    if (keys.length === 0) {
      return;
    }
    this.rosterService.updateOne(roster.$key, Object.fromEntries(
      keys.map(key => [`trackedTasks.${key}`, deleteField()])
    ));
  }

  /**
   * Sets one task for every grid character whose item level fits it, in one write:
   * true or false saves that choice, null sends those cells back to automatic.
   */
  setTaskForAll(roster: Roster, task: LostarkTask, value: boolean | null): void {
    const keys = getSetForAllKeys(roster.characters, task);
    if (value === null) {
      this.clearTrackingKeys(roster, keys.filter(key => typeof roster.trackedTasks?.[key] === "boolean"));
      return;
    }
    if (keys.length === 0) {
      return;
    }
    this.rosterService.updateOne(roster.$key, Object.fromEntries(
      keys.map(key => [`trackedTasks.${key}`, value])
    ));
  }

  toggleOlderRaids(): void {
    this.olderRaidsOpen = !this.olderRaidsOpen;
    try {
      localStorage.setItem(OLDER_RAIDS_OPEN_KEY, String(this.olderRaidsOpen));
    } catch {
      // Storage can be blocked (private mode, site data off); the group then just opens for this visit.
    }
  }

  resetBonuses(key: string): void {
    this.energyService.setOne(key, { data: {}, updated: Date.now() });
  }

  async onImportFileSelected(input: HTMLInputElement): Promise<void> {
    const file = input.files?.item(0);
    input.value = "";
    if (!file) {
      return;
    }
    this.pendingImport = {
      fileName: file.name,
      validation: parseExportFile(await file.text()),
      fromLostarkHelper: this.importFromLostarkHelper
    };
  }

  confirmImport(data: LostarkExport, fromLostarkHelper: boolean): void {
    this.transferBusy = true;
    this.dataTransfer.importExport(data, fromLostarkHelper).then(() => {
      this.message.success("Import done, reloading");
      window.location.reload();
    }, (error: Error) => {
      this.transferBusy = false;
      console.error(error);
      this.message.error(`Import failed: ${error.message}`);
    });
  }

  downloadBackup(): void {
    this.transferBusy = true;
    this.dataTransfer.downloadBackup().then(() => {
      this.transferBusy = false;
    }, (error: Error) => {
      this.transferBusy = false;
      console.error(error);
      this.message.error(`Backup failed: ${error.message}`);
    });
  }
}
