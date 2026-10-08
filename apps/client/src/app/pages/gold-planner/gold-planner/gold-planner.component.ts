import { Component, ChangeDetectionStrategy } from "@angular/core";
import { BehaviorSubject, combineLatest, map, Observable, of, pluck, tap } from "rxjs";
import { goldTasks } from "../gold-tasks";
import { GoldTask, Gate, resetType, canRunHardModeForGateAndCharacter, canRunNightmareModeForGateAndCharacter, pickDefaultRunningMode, shouldAutoPickRunningMode, getGoldRaids, isGateCountedForGoldCap, earnsGold, getGoldTakingDisabledReason, shouldAutoPickModeOnChest, groupPlannerCharacters, getRosterSummary, GoldTotal, MAX_GOLD_RAIDS } from "../gold-task";
import { LostarkTask } from "../../../model/lostark-task";
import { RosterService } from "../../../core/database/services/roster.service";
import { SettingsService } from "../../../core/database/services/settings.service";
import { TasksService } from "../../../core/database/services/tasks.service";
import { CompletionService } from '../../../core/database/services/completion.service';
import { Character } from "../../../model/character/character";
import { TimeService } from "../../../core/time.service";
import { ManualWeeklyGoldEntry, Settings } from "../../../model/settings";
import { UpdateData } from "firebase/firestore";
import { getCompletionEntry } from '../../../core/get-completion-entry-key';
import { Completion } from "../../../model/completion";
import { LayoutStateService } from "../../../core/services/layout-state.service";
import { filterVisibleCharacters } from "../../../core/visible-characters";
import { isTaskTracked } from "../../../core/task-tracking";
import { capGoldTracking, formatGoldCapMessage, GoldCapUntick } from "../gold-cap";
import { NzMessageService } from "ng-zorro-antd/message";

interface chestsData {
  task?: LostarkTask,
  line: PlannerLine,
  goldDetails: {
    hide: boolean | false,
    takingChest: boolean,
    indeterminateTakingChest: boolean,
    takingGold: boolean,
    indeterminateTakingGold: boolean,
    countsForGoldCap: boolean,
    goldTakingDisabledReason?: string,
    canRunHM: boolean,
    canRunNightmare: boolean,
    soloModeExists: boolean,
    normalModeExists: boolean,
    hardModeExists: boolean,
    nightmareModeExists: boolean,
    unboundGoldReward: number,
    boundGoldReward: number,
    chestPrice: number,
    runningMode: string,
  }[],
  // Gate rows of a raid with several gates, shown under it when expanded
  children?: chestsData[],
}

interface PlannerLine {
  name: string;
  gTask: GoldTask;
  expand?: boolean;
  gate?: Gate;
  parent?: PlannerLine
}

interface GoldPlannerDisplay {
  chestsData: chestsData[];
  chaos: Record<string, number>;
  other: Record<string, number>;
  tracking: Record<string, boolean>;
  raidModesForGoldPlanner: Record<string, string>;
  total: GoldTotal[];
  grandTotal: GoldTotal & { goldEarners: number };
  goldRaidCounts: number[];
  chestCosts: number[];
  settingsKey: string;
  goldCapUnticked: GoldCapUntick[];
  groups: { goldEarners: number[], others: number[] };
  plannerLines: PlannerLine[]
}

const SELECTED_CHARACTER_KEY = "gold-planner:selected-character";

@Component({
  selector: "lostark-helper-gold-planner",
  templateUrl: "./gold-planner.component.html",
  styleUrls: ["./gold-planner.component.less"],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false
})
export class GoldPlannerComponent {
  public rawRoster$ = this.rosterService.roster$;
  public roster$ = combineLatest([this.rosterService.roster$, this.layoutState.showHiddenCharacters$]).pipe(
    map(([roster, showHidden]) => filterVisibleCharacters(roster.characters, showHidden))
  );

  public settings$ = this.settings.settings$;
  public tasks$ = this.tasksService.tasks$;
  public completion$ = this.completionService.completion$;

  public manualGoldEntries$ = this.settings.settings$.pipe(pluck("manualGoldEntries"));
  public raidModesForGoldPlanner$ = this.settings.settings$.pipe(pluck("raidModesForGoldPlanner"))

  public display$: Observable<GoldPlannerDisplay> = combineLatest([
    this.roster$,
    this.tasks$,
    this.settings$,
    of(goldTasks),
    this.manualGoldEntries$,
    this.raidModesForGoldPlanner$,
    this.timeService.lastWeeklyReset$,
    this.timeService.lastBiWeeklyReset$,
    this.timeService.lastBiWeeklyOffsetReset$,
    this.rawRoster$,
    this.completion$
  ]).pipe(
    map(([roster, tasks, settings, gTasks, manualGoldEntries, raidModesForGoldPlanner, lastWeeklyReset, lastBiWeeklyReset, lastBiWeeklyOffsetReset, rawRoster, completion]) => {
      // At most 3 gold raids per character, applied before anything is counted; the write follows in saveGoldCap
      const goldCap = capGoldTracking(rawRoster.characters, settings.goldPlannerConfiguration, raidModesForGoldPlanner, tasks, rawRoster.trackedTasks, gTasks);
      const tracking = goldCap.tracking;
      const plannerLines: PlannerLine[] = [];
      gTasks.forEach(gTask => {

        const raidLine: PlannerLine = {
          name: gTask.name,
          gTask: gTask,
          expand: tracking[this.getExpandRaidFlag(gTask)]
        }

        if (gTask.gates.length === 1) {
          // For raids with only 1 gate, we add that gate to the main raid line
          // Further code will check for its presence to adapt display
          raidLine.gate = gTask.gates[0]
          plannerLines.push(raidLine)
        } else {
          // If a raid has several gates, we need several lines
          // - 1 main line for the raid that will always be visible and explandable
          // - 1 child line (which has the main line as parent) per gate, that will only be visible when parent line is expanded
          plannerLines.push(raidLine)
          gTask.gates.forEach(gate => {
            plannerLines.push({
              name: gate.name,
              gTask: gTask,
              gate: gate,
              parent: raidLine
            })
          })
        }
      })

      const allRows: chestsData[] = plannerLines
        .map(line => {
          let task: LostarkTask | undefined
          if (line.gate && line.gate.taskName) {
            task = tasks.find(t => t.label === line.gate?.taskName && !t.custom);
          } else {
            task = tasks.find(t => t.label === line.gTask.taskName && !t.custom);
          }
          return {
            task,
            line
          };
        })
        .filter(({ task }) => {
          return !task || (task.enabled
            && roster.some(c => c.ilvl >= (task.minIlvl || 0) && c.ilvl <= (task.maxIlvl || Infinity)));
        })
        .map(({ line, task }) => {
          const lineReset = this.findLineReset(lastWeeklyReset, lastBiWeeklyReset, lastBiWeeklyOffsetReset, line)

          const goldDetails = roster.map((character) => {

            const cantDoTask = task && (!task.enabled || character.ilvl < (task.minIlvl || 0) || character.ilvl >= (task.maxIlvl || Infinity));

            // Check if the cell (raid or gate) should be visible when looking at Remaining for the week
            let hideAlreadyDoneRaidOrGate

            if (line.gate) {
              hideAlreadyDoneRaidOrGate = this.shouldHideGateBasedOnWeeklyCompletion(line.gate, character, tasks, tracking, completion, lineReset, task)
            } else {
              hideAlreadyDoneRaidOrGate = line.gTask.gates.every(gate => {
                return this.shouldHideGateBasedOnWeeklyCompletion(gate, character, tasks, tracking, completion, lineReset, task)
              })
            }

            // Used to activate/deactivate the Hard and Nightmare options on the mode selection radio 
            let canRunHM
            if (line.gate) {
              canRunHM = canRunHardModeForGateAndCharacter(line.gate, character)
            } else {
              canRunHM = line.gTask.gates.every(gate => {
                return canRunHardModeForGateAndCharacter(gate, character)
              })
            }

            let canRunNightmare
            if (line.gate) {
              canRunNightmare = canRunNightmareModeForGateAndCharacter(line.gate, character)
            } else {
              canRunNightmare = line.gTask.gates.every(gate => {
                return canRunNightmareModeForGateAndCharacter(gate, character)
              })
            }

            // Determine state of Taking Gold and Taking Chest tick boxes
            // They can be indeterminate for main raid line if gate lines have different values
            let takingGold = false
            let indeterminateTakingGold = false
            let takingChest = false
            let indeterminateTakingChest = false

            if (line.gate) {
              takingGold = tracking[this.getGoldTakingFlagNameForGate(character.name, line.gate)];
              indeterminateTakingGold = false
              takingChest = tracking[this.getChestTakingFlagNameForGate(character.name, line.gate)];
              indeterminateTakingChest = false
            } else {
              if (tracking['hideAlreadyDoneTasks']) {
                const firstUndoneGate = line.gTask.gates.find(gate => !this.shouldHideGateBasedOnWeeklyCompletion(gate, character, tasks, tracking, completion, lineReset, task))

                takingGold = firstUndoneGate ? tracking[this.getGoldTakingFlagNameForGate(character.name, firstUndoneGate)] : false
                indeterminateTakingGold = firstUndoneGate ? !line.gTask.gates.every(gate => {
                  if (this.shouldHideGateBasedOnWeeklyCompletion(gate, character, tasks, tracking, completion, lineReset, task)) {
                    return true
                  } else {
                    return tracking[this.getGoldTakingFlagNameForGate(character.name, gate)] === takingGold
                  }
                }) : false

                takingChest = firstUndoneGate ? tracking[this.getChestTakingFlagNameForGate(character.name, firstUndoneGate)] : false
                indeterminateTakingChest = firstUndoneGate ? !line.gTask.gates.every(gate => {
                  if (this.shouldHideGateBasedOnWeeklyCompletion(gate, character, tasks, tracking, completion, lineReset, task)) {
                    return true
                  } else {
                    return tracking[this.getChestTakingFlagNameForGate(character.name, gate)] === takingChest
                  }
                }) : false
              } else {
                takingGold = tracking[this.getGoldTakingFlagNameForGate(character.name, line.gTask.gates[0])]
                indeterminateTakingGold = !line.gTask.gates.every(gate => {
                  return this.characterHasRequiredILvlForGate(gate, character, tasks, task) ?
                    tracking[this.getGoldTakingFlagNameForGate(character.name, gate)] === takingGold
                    : true
                })

                takingChest = tracking[this.getChestTakingFlagNameForGate(character.name, line.gTask.gates[0])];
                indeterminateTakingChest = !line.gTask.gates.every(gate => {
                  return this.characterHasRequiredILvlForGate(gate, character, tasks, task) ?
                    tracking[this.getChestTakingFlagNameForGate(character.name, gate)] === takingChest
                    : true
                })
              }
            }

            let unboundGoldReward = 0
            let boundGoldReward = 0
            let chestPrice = 0
            if (line.gate) {
              const gate = line.gate
              const runningMode = gate.modes.find(mode => mode.name === this.settings.getRunningModeFlag(raidModesForGoldPlanner, character.name, [gate.name]))
              unboundGoldReward = runningMode ? runningMode.goldILvlLimit > character.ilvl ? runningMode.unboundGoldReward : 0 : 0
              boundGoldReward = runningMode ? runningMode.goldILvlLimit > character.ilvl ? runningMode.boundGoldReward : 0 : 0
              chestPrice = runningMode ? runningMode.chestPrice : 0
            } else {
              line.gTask.gates.forEach(gate => {
                if (!this.shouldHideGateBasedOnWeeklyCompletion(gate, character, tasks, tracking, completion, lineReset, task)) {
                  const runningMode = gate.modes.find(mode => mode.name === this.settings.getRunningModeFlag(raidModesForGoldPlanner, character.name, [gate.name]))
                  unboundGoldReward += runningMode ? runningMode.goldILvlLimit > character.ilvl ? runningMode.unboundGoldReward : 0 : 0
                  boundGoldReward += runningMode ? runningMode.goldILvlLimit > character.ilvl ? runningMode.boundGoldReward : 0 : 0
                  chestPrice += runningMode ? runningMode.chestPrice : 0
                }
              })
            }

            // A character without Weekly Gold never takes gold; a tick stored from before is not shown
            if (!character.weeklyGold) {
              takingGold = false
              indeterminateTakingGold = false
            }

            const hiddenByTracking = cantDoTask || (task ? !isTaskTracked(rawRoster.trackedTasks, character, task, tasks) : false)

            const goldDetail = {
              hide: false || hiddenByTracking || hideAlreadyDoneRaidOrGate,
              runningMode: this.settings.getRunningModeFlag(
                raidModesForGoldPlanner,
                character.name,
                line.gate ? [line.gate.name] : line.gTask.gates.map(gate => gate.name)
              ),
              takingChest,
              indeterminateTakingChest,
              takingGold,
              indeterminateTakingGold,
              // Gold cap counts gate cells shown by tracking, including ones already done this week
              countsForGoldCap: isGateCountedForGoldCap({
                hiddenByTracking,
                isGateLine: !!line.gate,
                meetsGateIlvl: !!line.gate && this.characterHasRequiredILvlForGate(line.gate, character, tasks, task)
              }),
              goldTakingDisabledReason: undefined as string | undefined,
              canRunHM,
              canRunNightmare,
              soloModeExists: line.gTask.gates[0].modes.find(mode => mode.name === 'Solo') !== undefined,
              normalModeExists: line.gTask.gates[0].modes.find(mode => mode.name === 'NM') !== undefined,
              hardModeExists: line.gTask.gates[0].modes.find(mode => mode.name === 'HM') !== undefined,
              nightmareModeExists: line.gTask.gates[0].modes.find(mode => mode.name === 'Nightmare') !== undefined,
              unboundGoldReward,
              boundGoldReward,
              chestPrice
            }

            return goldDetail;
          })

          return {
            task,
            line,
            goldDetails
          };
        });

      // Gold cap: per character, the raids taking gold on a gate cell; counted before rows done this week are filtered out
      const goldRaids = roster.map((character, i) => getGoldRaids(allRows
        .filter(row => row.line.gate)
        .map(row => ({
          raidName: row.line.gTask.name,
          takingGold: earnsGold(row.goldDetails[i].takingGold, character.weeklyGold),
          counted: row.goldDetails[i].countsForGoldCap
        }))));
      allRows.forEach(row => row.goldDetails.forEach((detail, i) => {
        detail.goldTakingDisabledReason = getGoldTakingDisabledReason(roster[i].weeklyGold, goldRaids[i], row.line.gTask.name);
      }));

      const chestsData = allRows
        .filter(({ goldDetails }) => {
          return goldDetails.some(f => !f.hide);
        });
      chestsData.forEach(row => {
        if (!row.line.gate) {
          row.children = chestsData.filter(child => child.line.parent === row.line);
        }
      });

      const chaos = roster.reduce((acc, c) => {
        return {
          ...acc,
          [c.name]: this.getManualGoldEntry("chaos", c.name, lastWeeklyReset, manualGoldEntries || {})
        };
      }, {});

      const other = roster.reduce((acc, c) => {
        return {
          ...acc,
          [c.name]: this.getManualGoldEntry("other", c.name, lastWeeklyReset, manualGoldEntries || {})
        };
      }, {});

      const chestCosts: number[] = roster.map(() => 0);
      const total = chestsData
        .filter(row => row.task && row.line && row.line.gate)
        .reduce((acc, row) => {
          const { goldDetails } = row;
          goldDetails.forEach((flag, i) => {
            if (!flag.hide) {
              if (earnsGold(flag.takingGold, roster[i].weeklyGold)) {
                acc[i].unboundGold += flag.unboundGoldReward
                acc[i].boundGold += flag.boundGoldReward
              }

              if (flag.takingChest) {
                acc[i].boundGold -= flag.chestPrice
                chestCosts[i] += flag.chestPrice
              }
            }
          });
          return acc;
        }, new Array(roster.length).fill(undefined).map(u => { return { unboundGold: 0, boundGold: 0 } }));

      roster.forEach((char, i) => {
        total[i].unboundGold += chaos[char.name];
        total[i].unboundGold += other[char.name];
      });

      const grandTotal = getRosterSummary(total, roster)

      return {
        chestsData: chestsData,
        total,
        tracking,
        raidModesForGoldPlanner,
        grandTotal,
        goldRaidCounts: goldRaids.map(raids => raids.size),
        chestCosts,
        settingsKey: settings.$key,
        goldCapUnticked: goldCap.unticked,
        groups: groupPlannerCharacters(roster),
        chaos,
        other,
        plannerLines
      };
    }),
    tap(display => this.saveGoldCap(display))
  );

  // Gold cap writes already sent, by the raids they untick, so an emission before the write lands does not send it again
  private sentGoldCaps = new Set<string>();

  /** Saves the gold cap's unticks in one settings write and says which raids were unticked; does nothing when under the cap. */
  private saveGoldCap(display: GoldPlannerDisplay): void {
    if (display.goldCapUnticked.length === 0) {
      return;
    }
    const signature = JSON.stringify(display.goldCapUnticked);
    if (this.sentGoldCaps.has(signature)) {
      return;
    }
    this.sentGoldCaps.add(signature);
    this.settings.patch({
      $key: display.settingsKey,
      goldPlannerConfiguration: display.tracking
    });
    this.message.info(formatGoldCapMessage(display.goldCapUnticked));
  }

  public readonly maxGoldRaids = MAX_GOLD_RAIDS;

  // Character shown in the panel, remembered in this browser (by id, or by name for a character without one)
  private selectedCharacterKey$ = new BehaviorSubject<string | null>(this.readSelectedCharacterKey());

  /** Index (in roster$) of the character in the panel: the remembered one, else the first gold earner, else the first character. */
  public selection$: Observable<{ index: number }> = combineLatest([this.roster$, this.selectedCharacterKey$]).pipe(
    map(([roster, key]) => {
      const remembered = roster.findIndex(character => this.getCharacterKey(character) === key);
      if (remembered >= 0) {
        return { index: remembered };
      }
      const firstEarner = roster.findIndex(character => character.weeklyGold);
      return { index: firstEarner >= 0 ? firstEarner : 0 };
    })
  );

  selectCharacter(character: Character): void {
    const key = this.getCharacterKey(character);
    this.selectedCharacterKey$.next(key);
    try {
      localStorage.setItem(SELECTED_CHARACTER_KEY, key);
    } catch {
      // Storage unavailable (private window, blocked site data): the choice lasts until reload
    }
  }

  private readSelectedCharacterKey(): string | null {
    try {
      return localStorage.getItem(SELECTED_CHARACTER_KEY);
    } catch {
      return null;
    }
  }

  private getCharacterKey(character: Character): string {
    return character.id !== undefined ? `id:${character.id}` : `name:${character.name}`;
  }

  private shouldHideGateBasedOnWeeklyCompletion(gate: Gate, character: Character, taskList: LostarkTask[], tracking: Record<string, boolean>, completion: Completion, weeklyReset: number, task?: LostarkTask): boolean {
    const tempTask = taskList.find(t => t.label === gate.taskName && !t.custom);

    if (!this.characterHasRequiredILvlForGate(gate, character, taskList, task)) {
      return true
    } else {
      const completionFlag = task && getCompletionEntry(completion.data, character, tempTask ? tempTask : task);
      const gateAlreadyDone = completionFlag && completionFlag.amount >= parseInt(gate.completionId.substring(gate.completionId.length - 1)) && completionFlag.updated > weeklyReset
      const hideAlreadyDoneGate = tracking['hideAlreadyDoneTasks'] && gateAlreadyDone === true
      return hideAlreadyDoneGate
    }
  }

  private characterHasRequiredILvlForGate(gate: Gate, character: Character, taskList: LostarkTask[], task?: LostarkTask): boolean {
    const tempTask = taskList.find(t => t.label === gate.taskName && !t.custom);
    if (tempTask && tempTask.minIlvl > character.ilvl) {
      return false
    } else if (task && task.minIlvl > character.ilvl) {
      return false
    } else {
      return true
    }
  }

  private findLineReset(lastWeeklyReset: number, lastBiWeeklyReset: number, lastBiWeeklyOffsetReset: number, line: PlannerLine) {
    if (line.gate && line.gate.reset) {
      switch (line.gate.reset) {
        case resetType.biWeekly:
          return lastBiWeeklyReset
        case resetType.biWeeklyOffset:
          return lastBiWeeklyOffsetReset
        default:
          return lastWeeklyReset
      }
    } else {
      return lastWeeklyReset
    }
  }

  // Taking Gold tick box
  private getGoldTakingFlagNameForGate(characterName: string, gate: Gate): string {
    return `${characterName}:gold:taking:${gate.name}`;
  }

  setGoldTakingFlag(settingsKey: string, currentTracking: Record<string, boolean>, currentRaidModes: Record<string, string>, line: PlannerLine, character: Character, flag: boolean): void {
    // Edit copies: mutating the emitted settings makes the next snapshot look unchanged to getOne's
    // distinctUntilChanged, so the gold cap (disabled boxes) would not refresh until reload
    const tracking = { ...currentTracking };
    const raidModesForGoldPlanner = { ...currentRaidModes };
    if (!line.gate) {
      line.gTask.gates.forEach(gate => {
        this.setGoldTakingFlagForGate(settingsKey, tracking, raidModesForGoldPlanner, gate, character, flag)
      })
    } else {
      this.setGoldTakingFlagForGate(settingsKey, tracking, raidModesForGoldPlanner, line.gate, character, flag)
    }
  }

  // Ticking gold on a gate with no running mode yet also sets the highest mode the character can run
  setGoldTakingFlagForGate(settingsKey: string, tracking: Record<string, boolean>, raidModesForGoldPlanner: Record<string, string>, gate: Gate, character: Character, flag: boolean): void {
    tracking[this.getGoldTakingFlagNameForGate(character.name, gate)] = flag;
    const modeKey = this.getRunningModeFlagNameForGate(character.name, gate);
    const pickedMode = shouldAutoPickRunningMode(flag, raidModesForGoldPlanner[modeKey]) ? pickDefaultRunningMode(gate, character) : undefined;
    if (pickedMode) {
      raidModesForGoldPlanner[modeKey] = pickedMode;
    }
    this.settings.patch({
      $key: settingsKey,
      goldPlannerConfiguration: tracking,
      ...(pickedMode ? { raidModesForGoldPlanner } : {})
    });
  }

  //Taking Chest tick box
  private getChestTakingFlagNameForGate(characterName: string, gate: Gate): string {
    return `${characterName}:gold:${gate.name}`;
  }

  setChestTakingFlag(settingsKey: string, tracking: Record<string, boolean>, currentRaidModes: Record<string, string>, line: PlannerLine, character: Character, flag: boolean): void {
    // Edit a copy of the modes, as in setGoldTakingFlag, so an auto-picked mode shows without reload
    const raidModesForGoldPlanner = { ...currentRaidModes };
    if (!line.gate) {
      line.gTask.gates.forEach(gate => {
        this.setChestTakingFlagForGate(settingsKey, tracking, raidModesForGoldPlanner, gate, character, flag)
      })
    } else {
      this.setChestTakingFlagForGate(settingsKey, tracking, raidModesForGoldPlanner, line.gate, character, flag)
    }
  }

  // For a character without Weekly Gold, ticking a chest on a gate with no running mode also sets the highest mode it can run
  setChestTakingFlagForGate(settingsKey: string, tracking: Record<string, boolean>, raidModesForGoldPlanner: Record<string, string>, gate: Gate, character: Character, flag: boolean): void {
    tracking[this.getChestTakingFlagNameForGate(character.name, gate)] = flag;
    const modeKey = this.getRunningModeFlagNameForGate(character.name, gate);
    const pickedMode = shouldAutoPickModeOnChest(character.weeklyGold, flag, raidModesForGoldPlanner[modeKey]) ? pickDefaultRunningMode(gate, character) : undefined;
    if (pickedMode) {
      raidModesForGoldPlanner[modeKey] = pickedMode;
    }
    this.settings.patch({
      $key: settingsKey,
      goldPlannerConfiguration: tracking,
      ...(pickedMode ? { raidModesForGoldPlanner } : {})
    });
  }

  // Running mode selection utilities
  setRunningModeFlag(settingsKey: string, raidModesForGoldPlanner: Record<string, string>, line: PlannerLine, character: Character, flag: string): void {
    if (!line.gate || flag === "Solo") {
      line.gTask.gates.forEach(gate => {
        this.setRunningModeFlagForGate(settingsKey, raidModesForGoldPlanner, gate, character, flag)
      })
    } else if (raidModesForGoldPlanner[this.getRunningModeFlagNameForGate(character.name, line.gate)] === 'Solo') {
      line.gTask.gates.forEach(gate => {
        this.setRunningModeFlagForGate(settingsKey, raidModesForGoldPlanner, gate, character, "")
      })
      this.setRunningModeFlagForGate(settingsKey, raidModesForGoldPlanner, line.gate, character, flag)
    } else {
      this.setRunningModeFlagForGate(settingsKey, raidModesForGoldPlanner, line.gate, character, flag)
    }
  }

  setRunningModeFlagForGate(settingsKey: string, raidModesForGoldPlanner: Record<string, string>, gate: Gate, character: Character, flag: string): void {
    raidModesForGoldPlanner[this.getRunningModeFlagNameForGate(character.name, gate)] = flag;
    this.settings.patch({
      $key: settingsKey,
      raidModesForGoldPlanner: raidModesForGoldPlanner
    });
  }

  private getRunningModeFlagNameForGate(characterName: string, gate: Gate): string {
    return `${characterName}:runningMode:${gate.name}`;
  }

  // Raid Row Expander utilities
  private getExpandRaidFlag(gTask: GoldTask): string {
    return `expandRaid:${gTask.name}`;
  }

  setExpandRaidFlag(settingsKey: string, tracking: Record<string, boolean>, gTask: GoldTask, flag: boolean): void {
    tracking[this.getExpandRaidFlag(gTask)] = flag;
    this.settings.patch({
      $key: settingsKey,
      goldPlannerConfiguration: tracking
    });
  }

  // Toggle between Full Planning and Remaining for the week
  setHideAlreadyDoneTasksFlag(settingsKey: string, tracking: Record<string, boolean>, flag: boolean): void {
    tracking['hideAlreadyDoneTasks'] = flag;
    this.settings.patch({
      $key: settingsKey,
      goldPlannerConfiguration: tracking
    });
  }

  // Manuel gold entries utilities
  private getManualGoldEntry(type: string, characterName: string, weeklyReset: number, data: Record<string, ManualWeeklyGoldEntry>): number {
    const entry: ManualWeeklyGoldEntry = data[`${type}:${characterName}`] || { amount: 0, timestamp: Date.now() };
    if (entry.timestamp < weeklyReset) {
      return 0;
    }
    return entry.amount || 0;
  }

  public setManualGold(settingsKey: string, type: string, characterName: string, newValue: number): void {
    this.settings.updateOne(settingsKey, {
      [`manualGoldEntries.${type}:${characterName}`]: { amount: this.manualGoldFormatter(newValue) || 0, timestamp: Date.now() }
    } as unknown as UpdateData<Settings>);
  }

  // Show/Hide explanations
  toggleExplanations(settingsKey: string, tracking: Record<string, boolean>): void {
    tracking['showExplanations'] = tracking['showExplanations'] ? !tracking['showExplanations'] : true;
    this.settings.patch({
      $key: settingsKey,
      goldPlannerConfiguration: tracking
    });
  }

  //Miscellaneous
  manualGoldFormatter(value: number | string): number {
    if (!value || typeof value === 'string') {
      return 0;
    }
    return Math.floor(value);
  }

  // nz-input-number formatter: shows the same whole-gold value that setManualGold stores.
  manualGoldDisplay = (value: number): string => String(this.manualGoldFormatter(value));

  constructor(private rosterService: RosterService,
    private tasksService: TasksService,
    private settings: SettingsService,
    private timeService: TimeService,
    private completionService: CompletionService,
    private layoutState: LayoutStateService,
    private message: NzMessageService) {
  }
}
