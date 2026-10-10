import { Inject, Injectable } from "@angular/core";
import { catchError, distinctUntilChanged, filter, first } from "rxjs/operators";
import { EMPTY, from, map, Observable, shareReplay, switchMap } from "rxjs";
import { Auth, EmailAuthProvider, linkWithCredential, sendPasswordResetEmail, signInAnonymously, signInWithEmailAndPassword, signOut, UserCredential } from "firebase/auth";
import { FIREBASE_AUTH } from "../../firebase/firebase.providers";
import { authState$, idTokenState$ } from "../../firebase/rx";
import { NzMessageService } from "ng-zorro-antd/message";
import { authErrorMessage, passwordResetMessage } from "../../firebase/auth-errors";
import { FirestoreStorage } from "../firestore-storage";
import { LocalDataService, localDataClearRequested } from "../../firebase/local-data.service";
import { ServerConnectionService } from "../../firebase/server-connection.service";

@Injectable({
  providedIn: "root"
})
export class AuthService {

  private authState$ = authState$(this.auth);

  public uid$ = this.authState$.pipe(
    filter(Boolean),
    map(state => state.uid),
    filter(Boolean),
    shareReplay(1)
  );

  // From the ID token stream: registering a guest links the same user in place, which
  // onAuthStateChanged does not report, so the header and banner would stay on "guest" until a reload.
  public isAnonymous$ = idTokenState$(this.auth).pipe(
    filter(Boolean),
    map(state => state.isAnonymous),
    distinctUntilChanged(),
    shareReplay(1)
  );

  constructor(@Inject(FIREBASE_AUTH) private auth: Auth, private message: NzMessageService,
              private localData: LocalDataService, private connection: ServerConnectionService) {
    this.authState$.subscribe((state) => {
      // While an account change waits for the reload that clears this device's data, starting a
      // guest account would race that clear (in this tab and in the others, which Auth also signs out).
      if (!state && !localDataClearRequested()) {
        this.startGuest();
      }
    });
  }

  /** Signs in a new guest. Offline that fails, so it tries again when the browser is back online. */
  private startGuest(): void {
    signInAnonymously(this.auth).catch((error: unknown) => {
      console.error("Could not start a guest account:", error);
      window.addEventListener("online", () => {
        if (!this.auth.currentUser && !localDataClearRequested()) {
          this.startGuest();
        }
      }, { once: true });
    });
  }

  public register(email: string, password: string): Observable<UserCredential> {
    return from(this.connection.requireServer("register")).pipe(
      switchMap(() => this.authState$),
      filter(Boolean),
      first(),
      switchMap((user) => {
        return from(linkWithCredential(user, EmailAuthProvider.credential(email, password)));
      }),
      catchError((err) => {
        this.message.error(authErrorMessage(err));
        return EMPTY;
      })
    );
  }

  /**
   * Signs in to another account, then reloads the page, which deletes the previous account's data
   * from this device. Emits once signed in; an error (offline, wrong password) is shown and nothing
   * is emitted.
   */
  public login(email: string, password: string): Observable<void> {
    return from(this.switchAccount(email, password)).pipe(
      catchError((err) => {
        this.message.error(authErrorMessage(err));
        return EMPTY;
      })
    );
  }

  private async switchAccount(email: string, password: string): Promise<void> {
    // Every change must reach the server while the user who made it is still signed in.
    await this.localData.syncBeforeAccountChange("sign in");
    // Nothing more is written for this account; a failed sign-in keeps it, and writing resumes.
    FirestoreStorage.pauseWrites();
    try {
      await signInWithEmailAndPassword(this.auth, email, password);
    } catch (error) {
      FirestoreStorage.resumeWrites();
      throw error;
    }
    this.localData.clearOnNextLoad();
    this.localData.reloadPage();
  }

  /**
   * Logs out and reloads the page, which deletes this account's data from this device and starts
   * a new guest. Rejects with a ConnectionRequiredError offline or while changes are still unsent:
   * logging out then would lose them.
   */
  public async disconnect(): Promise<void> {
    await this.localData.syncBeforeAccountChange("log out");
    this.localData.clearOnNextLoad();
    try {
      await signOut(this.auth);
    } catch (error) {
      this.localData.cancelClear();
      throw error;
    }
    this.localData.reloadPage();
  }

  async sendResetPassword(email: string): Promise<void> {
    const error = await sendPasswordResetEmail(this.auth, email).then(() => null, (err: unknown) => err);
    const outcome = passwordResetMessage(error);
    if (outcome.ok) {
      this.message.success(outcome.text);
    } else {
      this.message.error(outcome.text);
    }
  }
}
