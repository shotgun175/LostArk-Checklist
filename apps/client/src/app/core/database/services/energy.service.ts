import { Inject, Injectable } from "@angular/core";
import { FirestoreStorage } from "../firestore-storage";
import { Firestore } from "firebase/firestore";
import { FIRESTORE } from "../../firebase/firebase.providers";
import { combineLatest, map, Observable, shareReplay, switchMap } from "rxjs";
import { AuthService } from "./auth.service";
import { Energy } from "../../../model/energy";
import { getCompletionEntry, moveNameKeysToIds, setCompletionEntry } from "../../get-completion-entry-key";
import { RosterService } from "./roster.service";
import { TimeService } from "../../time.service";
import { CompletionService } from "./completion.service";
import { TasksService } from "./tasks.service";
import { CompletionEntry } from "../../../model/completion-entry";
import { LostarkTask } from "../../../model/lostark-task";

@Injectable({
  providedIn: "root"
})
export class EnergyService extends FirestoreStorage<Energy> {
  private energyObj$: Observable<Energy> = this.auth.uid$.pipe(
    switchMap(uid => {
      return this.getOne(uid).pipe(
        map(energy => {
          if (energy.notFound) {
            return {
              ...energy,
              data: {},
              updated: 0
            };
          }
          return energy;
        })
      );
    }),
    shareReplay(1)
  );

  public energy$: Observable<Energy> = this.energyObj$.pipe(
    switchMap((energy) => {
      return combineLatest([
        this.timeService.lastDailyReset$,
        this.rosterService.roster$,
        this.tasksService.taskList$,
        this.completionService.completion$
      ]).pipe(
        map(([reset, roster, taskList, completion]) => {
          const tasks = taskList.tasks;
          // The daily reset and the key move replace both whole documents, so they wait until every
          // input is the server's copy: one computed from an older cached copy would undo ticks and
          // rest bonus saved on another device. Offline, the reset waits until the device is online.
          // The key move changes the kept documents in place, so it also waits: moved to the ids of a
          // cached roster, the entries could end up under ids that the saved roster does not have.
          if (energy.fromCache || completion.fromCache || roster.fromCache || taskList.fromCache) {
            return energy;
          }
          // Entries saved under a character's name (older data) move to its id first, so two characters
          // with the same name (one on NA, one on EU) never share ticks or rest bonus through that name
          const energyMoved = moveNameKeysToIds(energy.data, roster.characters);
          const completionMoved = moveNameKeysToIds(completion.data, roster.characters);
          const newEnergy = Object.keys(energy.data).length === 0;
          if (energy.updated < reset) {
            roster.characters.forEach(character => {
              tasks
                .filter(task => ["Una", "Guardian", "Chaos"].some(n => task.label?.startsWith(n)) && !task.custom)
                .forEach(task => {
                  const completionEntry = getCompletionEntry(completion.data, character, task);
                  const storedEntry = getCompletionEntry(energy.data, character, task);
                  const entry = storedEntry || {
                    amount: 0
                  };
                  if (completionEntry) {
                    setCompletionEntry(energy.data, character, task, this.getEnergyUpdate(reset, completionEntry, energy, task, entry));
                  } else if (!completionEntry && !newEnergy) {
                    // No completion entry (a restored backup or a bonus typed in Settings): keep the stored bonus
                    // and grow it as "not done since the last energy update" instead of wiping it.
                    setCompletionEntry(energy.data, character, task, storedEntry
                      ? this.getEnergyUpdate(reset, { amount: 0, updated: energy.updated }, energy, task, storedEntry)
                      : { amount: 0 });
                    setCompletionEntry(completion.data, character, task, {
                      amount: 0,
                      updated: Date.now()
                    });
                  }
                });
            });
            energy.updated = Date.now();
            this.setOneInBackground(energy.$key, energy);
            this.completionService.setOneInBackground(completion.$key, completion);
            return energy;
          }
          if (energyMoved) {
            this.setOneInBackground(energy.$key, energy);
          }
          if (completionMoved) {
            this.completionService.setOneInBackground(completion.$key, completion);
          }
          return energy;
        })
      );
    }),
    shareReplay(1)
  );

  constructor(@Inject(FIRESTORE) firestore: Firestore, private auth: AuthService,
              private rosterService: RosterService, private timeService: TimeService,
              private tasksService: TasksService, private completionService: CompletionService) {
    super(firestore);
  }

  public getEnergyUpdate(reset: number, completionEntry: CompletionEntry, energy: Energy, task: LostarkTask, entry: { amount: number }): { amount: number } {
    const energyPerEntry = task.label === 'Chaos Dungeon' ? 20 : 10
    const daysWithoutDoingTheTask = Math.ceil((reset - completionEntry.updated) / 86400000);
    const daysWithoutEnergyUpdate = Math.ceil((reset - energy.updated) / 86400000);
    const firstTaskUpdateSinceLastDone = daysWithoutDoingTheTask === daysWithoutEnergyUpdate;
    const baseBonus = firstTaskUpdateSinceLastDone ? (task.amount - completionEntry.amount) * energyPerEntry : 0;
    const timeBonus = (daysWithoutEnergyUpdate - (firstTaskUpdateSinceLastDone ? 1 : 0)) * task.amount * energyPerEntry;
    entry.amount = Math.max(Math.min(entry.amount + timeBonus + baseBonus, task.label === 'Chaos Dungeon' ? 200 : 100), 0);
    return entry;
  }

  public save(energy: Energy): void {
    this.setOne(energy.$key, energy);
  }

  protected getCollectionName(): string {
    return "energy";
  }
}
