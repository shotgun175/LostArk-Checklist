import { Component, ChangeDetectionStrategy, inject, signal } from "@angular/core";
import { BehaviorSubject, combineLatest, map, Observable, pluck } from "rxjs";
import { NgModel } from "@angular/forms";
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
import { AccountDeletionService } from "../../../core/account/account-deletion.service";
import { authErrorMessage, WRONG_CREDENTIALS } from "../../../core/firebase/auth-errors";
import { characterFlagKey, characterKey, readCharacterFlag } from "../../../core/character-keys";
import { normalizeRestBonus, restBonusMax } from "./rest-bonus";

/** Task tracking grid column widths in px; the grid scrolls sideways when they do not fit. */
const TRACKING_TASK_COLUMN_WIDTH = 150;
const TRACKING_CHARACTER_COLUMN_WIDTH = 64;

/** Lazy tasks and Rest bonus column widths in px: they scroll sideways with the Task column pinned, like the Task tracking grid. */
const TASK_COLUMN_WIDTH = 160;
const LAZY_CHARACTER_COLUMN_WIDTH = 110;
const REST_CHARACTER_COLUMN_WIDTH = 84;

/** localStorage key that remembers whether the Older raids group of the Task tracking grid is expanded. */
const OLDER_RAIDS_OPEN_KEY = "settings:olderRaidsOpen";

/** localStorage key that remembers whether Rest bonus also shows characters marked Hide on the Roster page. */
const REST_SHOW_HIDDEN_KEY = "settings:restBonusShowHidden";

function readStoredFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === "true";
  } catch {
    return false;
  }
}

function storeFlag(key: string, value: boolean): void {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // Storage can be blocked (private mode, site data off); the choice then just lasts for this visit.
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

  public rawRoster$ = this.rosterService.roster$;

  public lazyFlags$ = combineLatest([
    this.tasksService.tasks$,
    this.roster$,
    this.lazyTracking$
  ]).pipe(
    map(([tasks, roster, tracking]) => {
      return tasks
        .filter(task => task.frequency === TaskFrequency.DAILY && task.scope === TaskScope.CHARACTER && task.enabled !== false)
        .map(task => {
          return {
            task,
            flags: roster
              .map(character => {
                const flag = readCharacterFlag(tracking, character, task.$key);
                return flag === undefined ? true : flag;
              })
          };
        });
    })
  );

  public lazyTable = {
    taskColumnWidth: `${TASK_COLUMN_WIDTH}px`,
    characterColumnWidth: `${LAZY_CHARACTER_COLUMN_WIDTH}px`
  };

  public restShowHidden$ = new BehaviorSubject<boolean>(readStoredFlag(REST_SHOW_HIDDEN_KEY));

  public restBonus$ = combineLatest([
    this.tasksService.tasks$,
    this.rosterService.roster$,
    this.energy$,
    this.restShowHidden$
  ]).pipe(
    map(([tasks, roster, energy, showHidden]) => {
      // The headers, the cells and the writes all use this one list, so a cell always belongs to its column's character
      const characters = roster.characters.filter(c => showHidden || !c.isHide);
      const rows = tasks
        .filter(task => task.frequency === TaskFrequency.DAILY
          && task.scope === TaskScope.CHARACTER
          && task.enabled !== false
          && !task.custom
          && ["Chaos", "Guardian", "Una"].some(n => task.label?.startsWith(n)))
        .map(task => {
          return {
            task,
            max: restBonusMax(task.label),
            energy: characters.map(c => getCompletionEntry(energy.data, c, task)?.amount || 0)
          };
        });
      return {
        characters,
        rows,
        hiddenCount: roster.characters.filter(c => c.isHide).length,
        taskColumnWidth: `${TASK_COLUMN_WIDTH}px`,
        characterColumnWidth: `${REST_CHARACTER_COLUMN_WIDTH}px`,
        scroll: { x: `${TASK_COLUMN_WIDTH + REST_CHARACTER_COLUMN_WIDTH * characters.length}px` }
      };
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
          x: `${TRACKING_TASK_COLUMN_WIDTH + TRACKING_CHARACTER_COLUMN_WIDTH * roster.characters.length}px`
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

  private readonly accountDeletion = inject(AccountDeletionService);

  public readonly deletePassword = signal("");

  public readonly deleteBusy = signal(false);

  /** The delete confirm opens from the button or from Enter in the password field. */
  public deleteConfirmVisible = false;

  public olderRaidsOpen = readStoredFlag(OLDER_RAIDS_OPEN_KEY);

  constructor(private rosterService: RosterService, private tasksService: TasksService,
              private settings: SettingsService, private energyService: EnergyService,
              private auth: AuthService,
              private dataTransfer: DataTransferService, private message: NzMessageService) {
  }

  saveSetting(settings: Settings, field: "crystallineAura" | "hiddenOnCompletion"): void {
    this.settings.patchFields(settings.$key, [{ path: [field], value: settings[field] }]);
  }

  trackByTask(index: number, row: { task: LostarkTask }): string | undefined {
    return row.task.label;
  }

  /** Columns are tracked by character id (name when there is none), so a write does not rebuild every column. */
  trackCharacter(character: Character): string {
    return characterKey(character);
  }

  lazyScrollX(characterCount: number): string {
    return `${TASK_COLUMN_WIDTH + LAZY_CHARACTER_COLUMN_WIDTH * characterCount}px`;
  }

  /** "1 character", "2 characters"; the plural is the singular plus "s" unless given. */
  countLabel(count: number, singular: string, plural = `${singular}s`): string {
    return `${count} ${count === 1 ? singular : plural}`;
  }

  setLazyFlag(settingsKey: string, tracking: Record<string, boolean>, task: LostarkTask, character: Character, flag: boolean): void {
    const flagName = characterFlagKey(character, task.$key);
    tracking[flagName] = flag;
    this.settings.patchFields(settingsKey, [{ path: ["lazytracking", flagName], value: flag }]);
  }

  /**
   * Saves a rest bonus cell. When the typed value is changed on the way (cleared, a decimal, out of range),
   * the cell is set to the saved value right away: the table's own value may not change, so it would not redraw.
   */
  setRestBonus(energy: Energy, task: LostarkTask, character: Character, value: number | null, cell: NgModel): void {
    const amount = normalizeRestBonus(value, restBonusMax(task.label));
    if (amount !== value) {
      cell.control.setValue(amount, { emitViewToModelChange: false });
    }
    this.energyService.patchFields(energy.$key, [{
      path: ["data", getCompletionEntryKey(character, task)],
      value: { amount }
    }]);
  }

  setRestShowHidden(show: boolean): void {
    storeFlag(REST_SHOW_HIDDEN_KEY, show);
    this.restShowHidden$.next(show);
  }

  setTrackedTask(roster: Roster, task: LostarkTask, character: Character, value: boolean): void {
    this.rosterService.patchFields(roster.$key, [{ path: ["trackedTasks", getCompletionEntryKey(character, task)], value }]);
  }

  resetTrackedTask(roster: Roster, task: LostarkTask, character: Character): void {
    this.rosterService.patchFields(roster.$key, [{ path: ["trackedTasks", getCompletionEntryKey(character, task)], delete: true }]);
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
    this.rosterService.patchFields(roster.$key, keys.map(key => ({ path: ["trackedTasks", key], delete: true as const })));
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
    this.rosterService.patchFields(roster.$key, keys.map(key => ({ path: ["trackedTasks", key], value })));
  }

  toggleOlderRaids(): void {
    this.olderRaidsOpen = !this.olderRaidsOpen;
    storeFlag(OLDER_RAIDS_OPEN_KEY, this.olderRaidsOpen);
  }

  /** A row menu that opens moves focus to its first item, and focus goes back to its button when it closes. */
  onTaskMenuVisibleChange(visible: boolean, button: HTMLButtonElement): void {
    if (visible) {
      requestAnimationFrame(() => this.focusTaskMenuItem(0));
    } else if (!document.activeElement || document.activeElement === document.body || document.activeElement.closest(".task-menu")) {
      button.focus();
    }
  }

  /** Arrow keys move between the row menu items, Enter or Space picks one. */
  onTaskMenuKeydown(event: KeyboardEvent): void {
    const items = this.taskMenuItems();
    const index = items.indexOf(document.activeElement as HTMLElement);
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      this.focusTaskMenuItem((index + step + items.length) % items.length);
    } else if ((event.key === "Enter" || event.key === " ") && index >= 0) {
      event.preventDefault();
      items[index].click();
    }
  }

  private taskMenuItems(): HTMLElement[] {
    return Array.from(document.querySelectorAll<HTMLElement>(".ant-dropdown .task-menu li[tabindex]"))
      .filter(item => !item.classList.contains("ant-dropdown-menu-item-disabled") && !item.classList.contains("ant-menu-item-disabled"));
  }

  private focusTaskMenuItem(index: number): void {
    this.taskMenuItems()[index]?.focus();
  }

  resetBonuses(key: string): void {
    this.energyService.setOne(key, { data: {}, updated: Date.now() });
  }

  cancelImport(): void {
    this.pendingImport = null;
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

  /** Enter in the password field opens the same confirm as the button. */
  requestDelete(): void {
    if (this.deletePassword() && !this.deleteBusy()) {
      this.deleteConfirmVisible = true;
    }
  }

  async deleteAccount(): Promise<void> {
    this.deleteBusy.set(true);
    try {
      const result = await this.accountDeletion.deleteAccountAndData(this.deletePassword());
      this.message.success(result === "account-deleted"
        ? "Your account and data were deleted. Starting a new guest account."
        : "Your guest data was deleted. Starting a new guest account.");
      setTimeout(() => window.location.reload(), 1500);
    } catch (error) {
      this.deleteBusy.set(false);
      console.error(error);
      const message = authErrorMessage(error);
      // Here only the password can be wrong, since the email is the signed-in account's own
      this.message.error(message === WRONG_CREDENTIALS ? "That password is not right." : message);
    }
  }
}
