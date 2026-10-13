import { Inject, Injectable } from "@angular/core";
import { FirestoreStorage } from "../firestore-storage";
import { Completion } from "../../../model/completion";
import { Firestore } from "firebase/firestore";
import { FIRESTORE } from "../../firebase/firebase.providers";
import { map, Observable, shareReplay, switchMap } from "rxjs";
import { AuthService } from "./auth.service";

/**
 * The current user's ticks, live: changes from other tabs and devices show without a reload, and
 * this device's cached copy shows at once on startup. Clicks edit the emitted object in place and
 * save with patchFields, which keeps them on screen until the server has them (see getOne).
 */
@Injectable({
  providedIn: "root"
})
export class CompletionService extends FirestoreStorage<Completion> {
  public completion$: Observable<Completion> = this.auth.uid$.pipe(
    switchMap(uid => {
      return this.getOne(uid).pipe(
        map(completion => {
          if (completion.notFound) {
            return {
              $key: uid,
              data: {}
            };
          }
          return completion;
        })
      );
    }),
    shareReplay(1)
  );

  constructor(@Inject(FIRESTORE) firestore: Firestore, private auth: AuthService) {
    super(firestore);
  }

  protected getCollectionName(): string {
    return "completion";
  }
}
