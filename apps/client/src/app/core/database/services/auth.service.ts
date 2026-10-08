import { Inject, Injectable } from "@angular/core";
import { catchError, filter, first } from "rxjs/operators";
import { EMPTY, from, map, mapTo, Observable, shareReplay, switchMap } from "rxjs";
import { Auth, EmailAuthProvider, linkWithCredential, sendPasswordResetEmail, signInAnonymously, signInWithEmailAndPassword, signOut, UserCredential } from "firebase/auth";
import { FIREBASE_AUTH } from "../../firebase/firebase.providers";
import { authState$ } from "../../firebase/rx";
import { NzMessageService } from "ng-zorro-antd/message";
import { authErrorMessage, passwordResetMessage } from "../../firebase/auth-errors";
import { FirestoreStorage } from "../firestore-storage";

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

  public isAnonymous$ = this.authState$.pipe(
    filter(Boolean),
    map(state => state.isAnonymous),
    shareReplay(1)
  );

  constructor(@Inject(FIREBASE_AUTH) private auth: Auth, private message: NzMessageService) {
    this.authState$.subscribe((state) => {
      if (!state) {
        signInAnonymously(auth);
      }
    });
  }

  public register(email: string, password: string): Observable<UserCredential> {
    return this.authState$.pipe(
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

  public login(email: string, password: string): Observable<void> {
    // Send queued field changes while the user who made them is still signed in.
    FirestoreStorage.flushPending();
    return from(signInWithEmailAndPassword(this.auth, email, password)).pipe(
      catchError((err) => {
        this.message.error(authErrorMessage(err));
        return EMPTY;
      }),
      mapTo(void 0)
    );
  }


  disconnect(): void {
    // Send queued field changes while the user who made them is still signed in.
    FirestoreStorage.flushPending();
    signOut(this.auth);
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
