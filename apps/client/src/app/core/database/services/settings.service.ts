import { Inject, Injectable } from "@angular/core";
import { FirestoreStorage } from "../firestore-storage";
import { Firestore } from "firebase/firestore";
import { FIRESTORE } from "../../firebase/firebase.providers";
import { Settings } from "../../../model/settings";
import { combineLatest, filter, map, mapTo, Observable, of, shareReplay, switchMap } from "rxjs";
import { AuthService } from "./auth.service";
import { RosterService } from "./roster.service";
import { characterKeyMigrationWrites } from "../../character-keys";

@Injectable({
  providedIn: "root"
})
export class SettingsService extends FirestoreStorage<Settings> {
  public settings$: Observable<Settings> = this.auth.uid$.pipe(
    switchMap(uid => {
      return this.getOne(uid).pipe(
        switchMap(settings => {
          if (settings.notFound || Object.keys(settings).length < 7) {
            const result = {
              ...settings,
              hiddenOnCompletion: false,
              crystallineAura: true, // unused; keeps the key count the check above expects
              lazytracking: {},
              chestConfiguration: {},
              goldPlannerConfiguration: {},
              forceAbyss: {}
            };
            return this.setOne(uid, result).pipe(
              mapTo({
                ...result,
                $key: uid
              })
            );
          }

          // Smooth migration for goldPlannerConfiguration
          if (settings.goldPlannerConfiguration === undefined) {
            settings.goldPlannerConfiguration = {}
            return this.setOne(uid, settings).pipe(
              mapTo({
                ...settings,
                $key: uid
              })
            );
          }

          // Smooth migration for goldPlannerConfiguration
          if (settings.raidModesForGoldPlanner === undefined) {
            settings.raidModesForGoldPlanner = {}
            return this.setOne(uid, settings).pipe(
              mapTo({
                ...settings,
                $key: uid
              })
            );
          }

          return of(settings);
        })
      );
    }),
    shareReplay(1)
  );

  constructor(@Inject(FIRESTORE) firestore: Firestore, private auth: AuthService, rosterService: RosterService) {
    super(firestore);
    // Per-character settings keys move from the character's name to its id once both documents
    // have loaded for the same user (see character-keys.ts). The local write makes the next
    // settings emission clean, so this writes once.
    combineLatest([this.settings$, rosterService.roster$]).pipe(
      filter(([settings, roster]) => settings.$key === roster.$key),
      map(([settings, roster]) => ({ key: settings.$key, writes: characterKeyMigrationWrites(settings as unknown as Record<string, unknown>, roster.characters) })),
      filter(({ writes }) => writes.length > 0)
    ).subscribe(({ key, writes }) => this.patchFields(key, writes));
  }

  protected getCollectionName(): string {
    return "settings";
  }
}
