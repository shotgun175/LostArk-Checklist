import { Inject, Injectable } from "@angular/core";
import { FirestoreStorage } from "../firestore-storage";
import { Completion } from "../../../model/completion";
import { Firestore } from "firebase/firestore";
import { FIRESTORE } from "../../firebase/firebase.providers";
import { map, Observable, shareReplay, switchMap } from "rxjs";
import { AuthService } from "./auth.service";

@Injectable({
  providedIn: "root"
})
export class CompletionService extends FirestoreStorage<Completion> {
  protected override shouldClone = false;

  public completion$: Observable<Completion> = this.auth.uid$.pipe(
    switchMap(uid => {
      return this.getOne(uid, true).pipe(
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

  /**
   * Replaces the in-memory completion without writing it. completion$ keeps only its first
   * server snapshot, so a write made outside this service (the data import batch) would
   * otherwise stay invisible, and stale ticks could be written back over it.
   */
  public setLocal(key: string, completion: Completion): void {
    this.setSources[key]?.next(completion);
  }

  protected getCollectionName(): string {
    return "completion";
  }
}
