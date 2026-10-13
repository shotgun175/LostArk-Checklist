import { Inject, Injectable } from "@angular/core";
import { FirestoreStorage } from "../firestore-storage";
import { Completion } from "../../../model/completion";
import { Firestore } from "firebase/firestore";
import { FIRESTORE } from "../../firebase/firebase.providers";
import { map, Observable, shareReplay, switchMap, tap } from "rxjs";
import { AuthService } from "./auth.service";

/** Shown when a checklist click is refused because the ticks on screen are still this device's cached copy. */
export const CHECKLIST_NOT_LOADED_MESSAGE = "Your checklist is still loading from the server. Try again in a moment.";

/**
 * The current user's ticks, live: changes from other tabs and devices show without a reload, and
 * this device's cached copy shows at once on startup. Clicks edit the emitted object in place and
 * save with patchFields, which keeps them on screen until the server has them (see getOne).
 */
@Injectable({
  providedIn: "root"
})
export class CompletionService extends FirestoreStorage<Completion> {
  /**
   * How long clicks on the cached copy wait for the server's copy after the ticks start loading.
   * After that the device counts as offline, and the cached copy can be changed.
   */
  public static readonly SERVER_COPY_WAIT_MS = 2000;

  /** Until when the shown cached copy may still be replaced by the server's copy (0 once it arrived). */
  private serverCopyDeadline = 0;

  public completion$: Observable<Completion> = this.auth.uid$.pipe(
    switchMap(uid => {
      this.serverCopyDeadline = Date.now() + CompletionService.SERVER_COPY_WAIT_MS;
      return this.getOne(uid).pipe(
        tap(completion => {
          if (!completion.fromCache) {
            this.serverCopyDeadline = 0;
          }
        }),
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
   * True while the shown ticks are a cached copy that the server's copy is still expected to replace.
   * Clicks write absolute counts worked out from what is shown, so a click on an older cached copy
   * would write over a newer count saved on another device; online, the server's copy arrives within
   * moments. Offline it never does, so after SERVER_COPY_WAIT_MS the cached copy can be changed.
   */
  public waitsForServerCopy(completion: Completion): boolean {
    return !!completion.fromCache && Date.now() < this.serverCopyDeadline;
  }

  protected getCollectionName(): string {
    return "completion";
  }
}
