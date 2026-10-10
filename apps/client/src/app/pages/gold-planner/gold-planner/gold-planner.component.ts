import { Component, ChangeDetectionStrategy } from "@angular/core";
import { BehaviorSubject, combineLatest, map, Observable, of, pluck, tap } from "rxjs";
import { goldTasks } from "../gold-tasks";
import { GoldTask, Gate, resetType, canRunHardModeForGateAndCharacter, canRunNightmareModeForGateAndCharacter, pickDefaultRunningMode, shouldAutoPickRunningMode, getGoldRaids, isGateCountedForGoldCap, earnsGold, getGoldTakingDisabledReason, shouldAutoPickModeOnChest, groupPlannerCharacters, getRosterSummary, GoldTotal, MAX_GOLD_RAIDS, getCountedRunningMode, getCountedLineMode, getCountedModeNotes, getModeLabel } from "../gold-task";
import { LostarkTask } from "../../../model/lostark-task";
import { RosterService } from "../../../core/database/services/roster.service";
import { SettingsService } from "../../../core/database/services/settings.service";
import { TasksService } from "../../../core/database/services/tasks.service";
import { CompletionService } from '../../../core/database/services/completion.service';
import { Character } from "../../../model/character/character";
import { TimeService } from "../../../core/time.service";
import { ManualWeeklyGoldEntry } from "../../../model/settings";
import { getCompletionEntry } from '../../../core/get-completion-entry-key';
import { Completion } from "../../../model/completion";
import { LayoutStateService } from "../../../core/services/layout-state.service";
import { filterVisibleCharacters } from "../../../core/visible-characters";
import { isTaskTracked } from "../../../core/task-tracking";
import { capGoldTracking, formatGoldCapMessage, GoldCapUntick } from "../gold-cap";
import { NzMessageService } from "ng-zorro-antd/message";
import { FieldWrite } from "../../../core/database/write-coalescer";
import { characterFlagKey, characterKey, manualGoldKey, readCharacterFlag, readManualGold } from "../../../core/character-keys";
import { completionLabel, formatCompactGold, getGoldBar, GoldBarSegment, GoldCell, GoldSummary, summarizeCharacterGold, sumGoldSummaries } from "../gold-summary";

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
    // Saved modes the character's item level cannot run, with the mode they count as instead
    modeNotes: string[],
    // The counted mode to save when a note shows it (not Mixed); its button is already selected
    savableMode?: string,
    // Gate line: the gate is done this week on the Checklist
    done: boolean,
    // Checklist completion shown next to the raid or gate: done, to do, or how many gates are done
    completion?: string,
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
  // The gold cap's unticks as field writes, one per changed flag
  goldCapWrites: FieldWrite[];
  // Earned so far and possible this week, whatever the Full Planning switch shows
  characterSummaries: GoldSummary[];
  characterBars: GoldBarSegment[][];
  rosterSummary: GoldSummary;
  rosterBar: GoldBarSegment[];
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
      // The mode a gate counts as: a saved Hard or Nightmare the item level cannot run counts as the highest mode it can (never saved back)
      const savedMode = (gate: Gate, character: Character): string | undefined => readCharacterFlag(raidModesForGoldPlanner, character, `runningMode:${gate.name}`);
      const countedMode = (gate: Gate, character: Character) => getCountedRunningMode(gate, character, savedMode(gate, character));
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
            let indeterminateTakingGold: boolean
            let takingChest = false
            let indeterminateTakingChest: boolean

            if (line.gate) {
              takingGold = this.goldTakingFlag(tracking, character, line.gate);
              indeterminateTakingGold = false
              takingChest = this.chestTakingFlag(tracking, character, line.gate);
              indeterminateTakingChest = false
            } else {
              if (tracking['hideAlreadyDoneTasks']) {
                const firstUndoneGate = line.gTask.gates.find(gate => !this.shouldHideGateBasedOnWeeklyCompletion(gate, character, tasks, tracking, completion, lineReset, task))

                takingGold = firstUndoneGate ? this.goldTakingFlag(tracking, character, firstUndoneGate) : false
                indeterminateTakingGold = firstUndoneGate ? !line.gTask.gates.every(gate => {
                  if (this.shouldHideGateBasedOnWeeklyCompletion(gate, character, tasks, tracking, completion, lineReset, task)) {
                    return true
                  } else {
                    return this.goldTakingFlag(tracking, character, gate) === takingGold
                  }
                }) : false

                takingChest = firstUndoneGate ? this.chestTakingFlag(tracking, character, firstUndoneGate) : false
                indeterminateTakingChest = firstUndoneGate ? !line.gTask.gates.every(gate => {
                  if (this.shouldHideGateBasedOnWeeklyCompletion(gate, character, tasks, tracking, completion, lineReset, task)) {
                    return true
                  } else {
                    return this.chestTakingFlag(tracking, character, gate) === takingChest
                  }
                }) : false
              } else {
                takingGold = this.goldTakingFlag(tracking, character, line.gTask.gates[0])
                indeterminateTakingGold = !line.gTask.gates.every(gate => {
                  return this.characterHasRequiredILvlForGate(gate, character, tasks, task) ?
                    this.goldTakingFlag(tracking, character, gate) === takingGold
                    : true
                })

                takingChest = this.chestTakingFlag(tracking, character, line.gTask.gates[0]);
                indeterminateTakingChest = !line.gTask.gates.every(gate => {
                  return this.characterHasRequiredILvlForGate(gate, character, tasks, task) ?
                    this.chestTakingFlag(tracking, character, gate) === takingChest
                    : true
                })
              }
            }

            let unboundGoldReward = 0
            let boundGoldReward = 0
            let chestPrice = 0
            if (line.gate) {
              const gate = line.gate
              const runningMode = gate.modes.find(mode => mode.name === countedMode(gate, character).mode)
              unboundGoldReward = runningMode ? runningMode.goldILvlLimit > character.ilvl ? runningMode.unboundGoldReward : 0 : 0
              boundGoldReward = runningMode ? runningMode.goldILvlLimit > character.ilvl ? runningMode.boundGoldReward : 0 : 0
              chestPrice = runningMode ? runningMode.chestPrice : 0
            } else {
              line.gTask.gates.forEach(gate => {
                if (!this.shouldHideGateBasedOnWeeklyCompletion(gate, character, tasks, tracking, completion, lineReset, task)) {
                  const runningMode = gate.modes.find(mode => mode.name === countedMode(gate, character).mode)
                  unboundGoldReward += runningMode ? runningMode.goldILvlLimit > character.ilvl ? runningMode.unboundGoldReward : 0 : 0
                  boundGoldReward += runningMode ? runningMode.goldILvlLimit > character.ilvl ? runningMode.boundGoldReward : 0 : 0
                  chestPrice += runningMode ? runningMode.chestPrice : 0
                }
              })
            }

            // Done this week on the Checklist, whatever the Full Planning switch shows
            const gatesInReach = line.gate ? [line.gate] : line.gTask.gates
            const reachableGates = gatesInReach.filter(gate => this.characterHasRequiredILvlForGate(gate, character, tasks, task))
            const doneGates = reachableGates.filter(gate => this.isGateDoneThisWeek(gate, character, tasks, completion, lineReset, task)).length

            // A character without Weekly Gold never takes gold; a tick stored from before is not shown
            if (!character.weeklyGold) {
              takingGold = false
              indeterminateTakingGold = false
            }

            // The line's mode as the buttons show it: the counted mode of its gates, or Mixed when they differ
            const lineMode = getCountedLineMode(gatesInReach, character, gate => savedMode(gate, character))
            const modeNotes = getCountedModeNotes(reachableGates, character, gate => savedMode(gate, character))

            const hiddenByTracking = cantDoTask || (task ? !isTaskTracked(rawRoster.trackedTasks, character, task, tasks) : false)

            const goldDetail = {
              hide: false || hiddenByTracking || hideAlreadyDoneRaidOrGate,
              runningMode: lineMode as string,
              modeNotes,
              savableMode: modeNotes.length && lineMode && lineMode !== "Mixed" ? lineMode : undefined,
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
              chestPrice,
              done: !!line.gate && doneGates === 1,
              completion: task ? completionLabel(doneGates, reachableGates.length) : undefined
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
          [characterKey(c)]: this.getManualGoldEntry("chaos", c, lastWeeklyReset, manualGoldEntries || {})
        };
      }, {});

      const other = roster.reduce((acc, c) => {
        return {
          ...acc,
          [characterKey(c)]: this.getManualGoldEntry("other", c, lastWeeklyReset, manualGoldEntries || {})
        };
      }, {});

      // Every gate cell of each character with its gold, chest and Checklist completion
      const goldRows = allRows.filter(row => row.task && row.line.gate);
      const goldCell = (row: chestsData, i: number): GoldCell => {
        const flag = row.goldDetails[i];
        const gold = earnsGold(flag.takingGold, roster[i].weeklyGold);
        return {
          tradable: gold ? flag.unboundGoldReward : 0,
          bound: gold ? flag.boundGoldReward : 0,
          chest: flag.takingChest ? flag.chestPrice : 0,
          done: flag.done
        };
      };
      const manualGold = (character: Character) => [chaos[characterKey(character)], other[characterKey(character)]];

      // The summary cards ignore the switch: every planned gate (as counted for the gold cap), done or not
      const characterSummaries = roster.map((character, i) => summarizeCharacterGold(
        goldRows.filter(row => row.goldDetails[i].countsForGoldCap).map(row => goldCell(row, i)),
        manualGold(character)
      ));
      const rosterSummary = sumGoldSummaries(characterSummaries);

      // Totals follow the Full Planning switch: the whole plan, or only the gates still to do (Chaos and Other entries are
      // already earned); done and to-do gates each pay their own chests, bound gold first, then tradable
      const shownTotals = characterSummaries.map(summary => tracking['hideAlreadyDoneTasks'] ? summary.remaining : summary.plan);
      const total: GoldTotal[] = shownTotals.map(settled => ({ unboundGold: settled.tradable, boundGold: settled.bound }));
      const chestCosts: number[] = shownTotals.map(settled => settled.chests);

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
        characterSummaries,
        characterBars: characterSummaries.map(summary => getGoldBar(summary)),
        rosterSummary,
        rosterBar: getGoldBar(rosterSummary),
        goldCapUnticked: goldCap.unticked,
        goldCapWrites: tracking === settings.goldPlannerConfiguration ? [] : Object.keys(tracking)
          .filter(key => tracking[key] !== settings.goldPlannerConfiguration[key])
          .map(key => ({ path: ["goldPlannerConfiguration", key], value: tracking[key] })),
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
    // Only the unticked flags, so a tick saved meanwhile from another tab is kept
    this.settings.patchFields(display.settingsKey, display.goldCapWrites);
    // Long enough to read which raids were kept and which were unticked
    this.message.info(formatGoldCapMessage(display.goldCapUnticked), { nzDuration: 10000 });
  }

  public readonly maxGoldRaids = MAX_GOLD_RAIDS;

  // Mode names as the buttons show them, for the "Save as" action next to a counted-mode note
  public readonly modeLabel = getModeLabel;

  // Manual gold amounts are listed by character id, so two characters with the same name keep their own
  public readonly characterKey = characterKey;

  // Short gold amounts in the character list
  public readonly compactGold = formatCompactGold;

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
    if (!this.characterHasRequiredILvlForGate(gate, character, taskList, task)) {
      return true
    } else {
      const hideAlreadyDoneGate = tracking['hideAlreadyDoneTasks'] && this.isGateDoneThisWeek(gate, character, taskList, completion, weeklyReset, task)
      return hideAlreadyDoneGate
    }
  }

  /** Whether the Checklist has this gate done since its last reset (the raid's count reaches the gate's number). */
  private isGateDoneThisWeek(gate: Gate, character: Character, taskList: LostarkTask[], completion: Completion, weeklyReset: number, task?: LostarkTask): boolean {
    const tempTask = taskList.find(t => t.label === gate.taskName && !t.custom);
    const completionFlag = task && getCompletionEntry(completion.data, character, tempTask ? tempTask : task);
    return !!completionFlag && completionFlag.amount >= parseInt(gate.completionId.substring(gate.completionId.length - 1)) && completionFlag.updated > weeklyReset
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
  private getGoldTakingFlagNameForGate(character: Character, gate: Gate): string {
    return characterFlagKey(character, `gold:taking:${gate.name}`);
  }

  private goldTakingFlag(tracking: Record<string, boolean>, character: Character, gate: Gate): boolean {
    return readCharacterFlag(tracking, character, `gold:taking:${gate.name}`) as boolean;
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
    const flagName = this.getGoldTakingFlagNameForGate(character, gate);
    tracking[flagName] = flag;
    const modeKey = this.getRunningModeFlagNameForGate(character, gate);
    const pickedMode = shouldAutoPickRunningMode(flag, readCharacterFlag(raidModesForGoldPlanner, character, `runningMode:${gate.name}`)) ? pickDefaultRunningMode(gate, character) : undefined;
    if (pickedMode) {
      raidModesForGoldPlanner[modeKey] = pickedMode;
    }
    this.settings.patchFields(settingsKey, [
      { path: ["goldPlannerConfiguration", flagName], value: flag },
      ...(pickedMode ? [{ path: ["raidModesForGoldPlanner", modeKey], value: pickedMode }] : [])
    ]);
  }

  //Taking Chest tick box
  private getChestTakingFlagNameForGate(character: Character, gate: Gate): string {
    return characterFlagKey(character, `gold:${gate.name}`);
  }

  private chestTakingFlag(tracking: Record<string, boolean>, character: Character, gate: Gate): boolean {
    return readCharacterFlag(tracking, character, `gold:${gate.name}`) as boolean;
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
    const flagName = this.getChestTakingFlagNameForGate(character, gate);
    tracking[flagName] = flag;
    const modeKey = this.getRunningModeFlagNameForGate(character, gate);
    const pickedMode = shouldAutoPickModeOnChest(character.weeklyGold, flag, readCharacterFlag(raidModesForGoldPlanner, character, `runningMode:${gate.name}`)) ? pickDefaultRunningMode(gate, character) : undefined;
    if (pickedMode) {
      raidModesForGoldPlanner[modeKey] = pickedMode;
    }
    this.settings.patchFields(settingsKey, [
      { path: ["goldPlannerConfiguration", flagName], value: flag },
      ...(pickedMode ? [{ path: ["raidModesForGoldPlanner", modeKey], value: pickedMode }] : [])
    ]);
  }

  // Running mode selection utilities
  setRunningModeFlag(settingsKey: string, raidModesForGoldPlanner: Record<string, string>, line: PlannerLine, character: Character, flag: string): void {
    if (!line.gate || flag === "Solo") {
      line.gTask.gates.forEach(gate => {
        this.setRunningModeFlagForGate(settingsKey, raidModesForGoldPlanner, gate, character, flag)
      })
    } else if (readCharacterFlag(raidModesForGoldPlanner, character, `runningMode:${line.gate.name}`) === 'Solo') {
      line.gTask.gates.forEach(gate => {
        this.setRunningModeFlagForGate(settingsKey, raidModesForGoldPlanner, gate, character, "")
      })
      this.setRunningModeFlagForGate(settingsKey, raidModesForGoldPlanner, line.gate, character, flag)
    } else {
      this.setRunningModeFlagForGate(settingsKey, raidModesForGoldPlanner, line.gate, character, flag)
    }
  }

  /**
   * Saves the mode a line counts as, on each of its gates, in one write: used when a note says a saved
   * mode counts as another one. That mode's button is already selected, so the radio group alone
   * would never save it.
   */
  saveCountedMode(settingsKey: string, raidModesForGoldPlanner: Record<string, string>, line: PlannerLine, character: Character, mode: string): void {
    const writes: FieldWrite[] = (line.gate ? [line.gate] : line.gTask.gates).map(gate => {
      const flagName = this.getRunningModeFlagNameForGate(character, gate);
      raidModesForGoldPlanner[flagName] = mode;
      return { path: ["raidModesForGoldPlanner", flagName], value: mode };
    });
    this.settings.patchFields(settingsKey, writes);
  }

  /** A click on a mode button: the already selected counted mode is saved here; any other mode is saved by the radio group's change. */
  onModeButtonClick(settingsKey: string, raidModesForGoldPlanner: Record<string, string>, line: PlannerLine, character: Character, flag: { savableMode?: string }, mode: string): void {
    if (flag.savableMode === mode) {
      this.saveCountedMode(settingsKey, raidModesForGoldPlanner, line, character, mode);
    }
  }

  setRunningModeFlagForGate(settingsKey: string, raidModesForGoldPlanner: Record<string, string>, gate: Gate, character: Character, flag: string): void {
    const flagName = this.getRunningModeFlagNameForGate(character, gate);
    raidModesForGoldPlanner[flagName] = flag;
    this.settings.patchFields(settingsKey, [{ path: ["raidModesForGoldPlanner", flagName], value: flag }]);
  }

  private getRunningModeFlagNameForGate(character: Character, gate: Gate): string {
    return characterFlagKey(character, `runningMode:${gate.name}`);
  }

  // Raid Row Expander utilities
  private getExpandRaidFlag(gTask: GoldTask): string {
    return `expandRaid:${gTask.name}`;
  }

  setExpandRaidFlag(settingsKey: string, tracking: Record<string, boolean>, gTask: GoldTask, flag: boolean): void {
    const flagName = this.getExpandRaidFlag(gTask);
    tracking[flagName] = flag;
    this.settings.patchFields(settingsKey, [{ path: ["goldPlannerConfiguration", flagName], value: flag }]);
  }

  // Toggle between Full Planning and Remaining for the week
  setHideAlreadyDoneTasksFlag(settingsKey: string, tracking: Record<string, boolean>, flag: boolean): void {
    tracking['hideAlreadyDoneTasks'] = flag;
    this.settings.patchFields(settingsKey, [{ path: ["goldPlannerConfiguration", "hideAlreadyDoneTasks"], value: flag }]);
  }

  // Manuel gold entries utilities
  private getManualGoldEntry(type: string, character: Character, weeklyReset: number, data: Record<string, ManualWeeklyGoldEntry>): number {
    const entry: ManualWeeklyGoldEntry = readManualGold(data, type, character) || { amount: 0, timestamp: Date.now() };
    if (entry.timestamp < weeklyReset) {
      return 0;
    }
    return entry.amount || 0;
  }

  public setManualGold(settingsKey: string, type: string, character: Character, newValue: number): void {
    this.settings.patchFields(settingsKey, [{
      path: ["manualGoldEntries", manualGoldKey(type, character)],
      value: { amount: this.manualGoldFormatter(newValue) || 0, timestamp: Date.now() }
    }]);
  }

  // Show/Hide explanations
  toggleExplanations(settingsKey: string, tracking: Record<string, boolean>): void {
    tracking['showExplanations'] = tracking['showExplanations'] ? !tracking['showExplanations'] : true;
    this.settings.patchFields(settingsKey, [{ path: ["goldPlannerConfiguration", "showExplanations"], value: tracking['showExplanations'] }]);
  }

  //Miscellaneous
  manualGoldFormatter(value: number | string): number {
    if (!value || typeof value === 'string') {
      return 0;
    }
    return Math.floor(value);
  }

  // nz-input-number parser: drops the decimals of a typed amount (1234.56 is 1234), the same whole gold setManualGold stores
  manualGoldParser = (value: string): number => {
    const text = value.trim().replace(/,/g, '');
    return text.length ? Math.trunc(Number(text)) : NaN;
  };

  constructor(private rosterService: RosterService,
    private tasksService: TasksService,
    private settings: SettingsService,
    private timeService: TimeService,
    private completionService: CompletionService,
    private layoutState: LayoutStateService,
    private message: NzMessageService) {
  }
}
