import { Inject, Injectable } from "@angular/core";
import { map, Observable, of, shareReplay, switchMap } from "rxjs";
import { FirestoreStorage } from "../firestore-storage";
import { Roster } from "../../../model/roster";
import { LostarkClass } from "../../../model/character/lostark-class";
import { AuthService } from "./auth.service";
import { Firestore } from "firebase/firestore";
import { FIRESTORE } from "../../firebase/firebase.providers";
import { mapTo } from "rxjs/operators";
import { applyWeeklyGoldDefaults } from "../../weekly-gold";
import { fixDuplicateCharacterIds, toClassNumber } from "../../roster-input";

/**
 * Repairs the stored character list in place and returns whether the result should be saved:
 * entries that are not objects are dropped (a bad import must not blank the app), Weekly Gold
 * defaults, ids and tickets are filled in, classes become numbers and an id used twice is replaced.
 */
export function normalizeRosterCharacters(roster: Roster): boolean {
  let shouldSave = false;
  roster.characters = (roster.characters || []).filter(c => typeof c === "object" && c !== null && !Array.isArray(c));
  if (applyWeeklyGoldDefaults(roster.characters)) {
    shouldSave = true;
  }
  roster.characters = roster.characters.map(c => {
    if (!c.id) {
      shouldSave = true;
      c.id = Math.floor(Math.random() * 1000000000);
    }
    if (!c.tickets) {
      shouldSave = true;
      c.tickets = {
        EbonyCubeLevel1: 0,
        EbonyCubeLevel2: 0,
        EbonyCubeLevel3: 0,
        EbonyCubeLevel4: 0,
        EbonyCubeLevel5: 0,
        EbonyCube1stUnlock: 0,
        EbonyCube2ndUnlock: 0,
        EbonyCube3rdUnlock: 0,
        EbonyCube4thUnlock: 0
      };
    }
    const characterClass = toClassNumber(c.class);
    if (characterClass !== undefined && characterClass !== c.class) {
      shouldSave = true;
      c.class = characterClass as LostarkClass;
    }
    return c;
  });
  if (fixDuplicateCharacterIds(roster.characters)) {
    shouldSave = true;
  }
  return shouldSave;
}

@Injectable({
  providedIn: "root"
})
export class RosterService extends FirestoreStorage<Roster> {
  public roster$: Observable<Roster> = this.auth.uid$.pipe(
    switchMap(uid => {
      return this.getOne(uid, true).pipe(
        map(roster => {
          if (roster.notFound) {
            return {
              $key: uid,
              characters: [],
              trackedTasks: {},
              showAllTasks: false,
            };
          }
          return roster;
        })
      );
    }),
    shareReplay(1)
  );

  constructor(private auth: AuthService, @Inject(FIRESTORE) firestore: Firestore) {
    super(firestore);
  }

  override getOne(key: string, isCurrentUser = false): Observable<Roster> {
    return super.getOne(key).pipe(
      switchMap(roster => {
        let shouldSave = normalizeRosterCharacters(roster);
        if (!roster.trackedTasks) {
          roster.trackedTasks = {};
        }
        if (roster.showAllTasks === undefined) {
          shouldSave = true;
          roster.showAllTasks = false;
        }
        if (shouldSave && isCurrentUser && roster.characters.length > 0) {
          return this.setOne(key, roster).pipe(
            mapTo(roster)
          );
        }
        return of(roster);
      })
    );
  }

  protected getCollectionName(): string {
    return "roster";
  }
}
